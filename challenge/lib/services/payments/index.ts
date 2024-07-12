import {
  PassthroughBehavior,
  RestApi,
  StepFunctionsIntegration,
} from "aws-cdk-lib/aws-apigateway";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import {
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

import { StateMachine } from "aws-cdk-lib/aws-stepfunctions";
import { PaymentsServiceFunctions } from "./constructs/functions";
import { PaymentStateMachine } from "./constructs/state-machine";

interface PaymentsServiceProps {
  usersTable: Table;
  transactionsTable: Table;
  activityTable: Table;
  restApi: RestApi;
}

class PaymentsService extends Construct {
  readonly stateMachine: StateMachine;
  readonly paymentStateMachine: PaymentStateMachine;
  readonly stateMachineIntegration: StepFunctionsIntegration;

  constructor(scope: Construct, id: string, props: PaymentsServiceProps) {
    super(scope, id);

    const { executePayments: executePaymentsLambda } = new PaymentsServiceFunctions(
      this,
      "PaymentsServiceFunctions",
      {
        activityTable: props.activityTable,
        transactionsTable: props.transactionsTable,
      }
    );

    const paymentStateMachine = new PaymentStateMachine(this, "PaymentsStateMachine", {
      ...props,
      executePaymentsLambda,
    });

    this.paymentStateMachine = paymentStateMachine;

    this.stateMachine = paymentStateMachine.stateMachine;

    const invokeStepfunctionApiRole = new Role(this, `${id}-role`, {
      assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
      inlinePolicies: {
        allowInvokeStepFunctions: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ["states:StartSyncExecution"],
              resources: [paymentStateMachine.stateMachine.stateMachineArn],
            }),
          ],
        }),
      },
    });

    const stateMachineIntegration = StepFunctionsIntegration.startExecution(
      paymentStateMachine.stateMachine,
      {
        integrationResponses: [
          {
            selectionPattern: "200",
            statusCode: "201",
            responseTemplates: {
              "application/json": `
                #if($input.path('$.status').toString().equals("FAILED"))
                  #set($context.responseOverride.status = 400)
                  {
                    "message": "$input.path('$.cause')"
                  }
                #else
                  #set($outputString = $input.path('$.output'))
                  #set($outputJson = $util.parseJson($outputString))
                  {
                      "message": "$util.escapeJavaScript($outputJson.value.message)",
                      "transactionId": "$util.escapeJavaScript($outputJson.value.transactionId)"
                  }
                #end
            `,
            },
            responseParameters: {
              "method.response.header.Access-Control-Allow-Methods":
                "'OPTIONS,GET,PUT,POST,DELETE,PATCH,HEAD'",
              "method.response.header.Access-Control-Allow-Headers":
                "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
              "method.response.header.Access-Control-Allow-Origin": "'*'",
            },
          },
        ],
        requestTemplates: {
          "application/json": `{
            "input": "$util.escapeJavaScript($input.json('$'))",
            "stateMachineArn": "${paymentStateMachine.stateMachine.stateMachineArn}"
          }`,
        },
        passthroughBehavior: PassthroughBehavior.NEVER,
        credentialsRole: invokeStepfunctionApiRole,
      }
    );

    this.stateMachineIntegration = stateMachineIntegration;

    props.restApi.root
      .addResource("payments")
      .addMethod("POST", stateMachineIntegration, {
        methodResponses: [
          {
            statusCode: "201",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Methods": true,
              "method.response.header.Access-Control-Allow-Headers": true,
              "method.response.header.Access-Control-Allow-Origin": true,
            },
          },
        ],
      });
  }
}

export default PaymentsService;
