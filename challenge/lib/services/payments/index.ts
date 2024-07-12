import {
  Integration,
  IntegrationType,
  PassthroughBehavior,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import {
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { PaymentsServiceFunctions } from "./constructs/functions";
import { PaymentStateMachine } from "./constructs/state-machine";

interface PaymentsServiceProps {
  usersTable: Table;
  transactionsTable: Table;
  activityTable: Table;
  restApi: RestApi;
}

class PaymentsService extends Construct {
  constructor(scope: Construct, id: string, props: PaymentsServiceProps) {
    super(scope, id);

    const { executePayments: executePaymentsLambda } = new PaymentsServiceFunctions(
      this,
      "PaymentsServiceFunctions",
    );

    const { stateMachine } = new PaymentStateMachine(this, "PaymentsStateMachine", {
      ...props,
      executePaymentsLambda,
    });

    const invokeStepfunctionApiRole = new Role(this, `${id}-role`, {
      assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
      inlinePolicies: {
        allowInvokeStepFunctions: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ["states:StartSyncExecution"],
              resources: [stateMachine.stateMachineArn],
            }),
          ],
        }),
      },
    });

    const stateMachineIntegration = new Integration({
      type: IntegrationType.AWS,
      integrationHttpMethod: "POST",
      uri: `arn:aws:apigateway:${process.env.AWS_REGION}:states:action/StartSyncExecution`,
      options: {
        passthroughBehavior: PassthroughBehavior.NEVER,
        requestTemplates: {
          "application/json": `{
              "input": "{\\"body\\": $util.escapeJavaScript($input.json('$'))}",
            "stateMachineArn": "${stateMachine.stateMachineArn}"
          }`,
        },
        credentialsRole: invokeStepfunctionApiRole,
        integrationResponses: [
          {
            selectionPattern: "200",
            statusCode: "201",
            responseTemplates: {
              "application/json": `
                #set($outputString = $input.path('$.output'))
                #set($outputJson = $util.parseJson($outputString))
                {
                    "message": "$util.escapeJavaScript($outputJson.value.message)",
                    #if($util.escapeJavaScript($outputJson.value.transactionId) != "")
                        "transactionId": "$util.escapeJavaScript($outputJson.value.transactionId)"
                    #end
                }
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
      },
    });

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
