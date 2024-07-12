import { RemovalPolicy } from "aws-cdk-lib";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import {
  Choice,
  Condition,
  DefinitionBody,
  JsonPath,
  LogLevel,
  Pass,
  StateMachine,
  StateMachineType,
  TaskInput,
} from "aws-cdk-lib/aws-stepfunctions";
import {
  DynamoAttributeValue,
  DynamoGetItem,
  DynamoPutItem,
  LambdaInvoke,
} from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";

interface PaymentStateMachineProps {
  usersTable: Table;
  transactionsTable: Table;
  executePaymentsLambda: NodejsFunction;
}

export class PaymentStateMachine extends Construct {
  readonly stateMachine: StateMachine;

  constructor(scope: Construct, id: string, props: PaymentStateMachineProps) {
    super(scope, id);

    const logGroup = new LogGroup(this, "PaymentsStateMachineLogGroup", {
      logGroupName: `/aws/vendedlogs/states/payments-log-group`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: RetentionDays.ONE_DAY,
    });

    const errorMessage = new Pass(this, "Something was wrong", {
      parameters: TaskInput.fromObject({ message: "Something was wrong" }),
    });

    const validateUserPass = new Pass(this, "Validate User");

    const getUserById = new DynamoGetItem(this, "Get User By Id", {
      resultPath: "$.dynamodGetItemResponse",
      table: props.usersTable,
      key: {
        userId: DynamoAttributeValue.fromString(JsonPath.stringAt("$.body.userId")),
      },
    });

    const unmarshalDynamoDBResponse = new Pass(this, "Unmarshal DynamoDB user response", {
      inputPath: JsonPath.stringAt("$.dynamodGetItemResponse.Item"),
      resultPath: "$.user",
      parameters: {
        "userId.$": "$.userId.S",
        "name.$": "$.name.S",
        "lastName.$": "$.lastName.S",
      },
    });

    const putTransactionIntoDynamoDB = new DynamoPutItem(
      this,
      "Save transaction Into DynamoDB",
      {
        item: {
          userId: DynamoAttributeValue.fromString(JsonPath.stringAt("$.user.userId")),
          transactionId: DynamoAttributeValue.fromString(
            JsonPath.stringAt("$.transaction.transactionId")
          ),
          amount: DynamoAttributeValue.fromString(
            JsonPath.stringAt("$.transaction.amount")
          ),
        },
        table: props.transactionsTable,
        resultPath: "$.putItemResponse",
      }
    );

    const executePaymentsLambdaInvoke = new LambdaInvoke(
      this,
      "Execute Payments Lambda",
      {
        lambdaFunction: props.executePaymentsLambda,
        outputPath: "$.Payload",
        payload: TaskInput.fromObject({
          user: JsonPath.objectAt("$.user"),
          amount: JsonPath.stringAt("$.body.amount"),
        }),
      }
    );

    const paymentExecutionResultChoice = new Choice(this, "Payment execution success?")
      .when(
        Condition.numberEquals("$.putItemResponse.SdkHttpMetadata.HttpStatusCode", 200),
        new Pass(this, "Success", {
          parameters: TaskInput.fromObject({
            message: "Payment registered successfully",
            transactionId: JsonPath.stringAt("$.transaction.transactionId"),
          }),
        })
      )
      .otherwise(errorMessage);

    const validateUserSuccessChoice = new Choice(this, "User validation success?")
      .when(Condition.isNotPresent("$.dynamodGetItemResponse.Item"), errorMessage)
      .otherwise(
        unmarshalDynamoDBResponse
          .next(executePaymentsLambdaInvoke)
          .next(putTransactionIntoDynamoDB)
          .next(paymentExecutionResultChoice)
      );

    const definition = validateUserPass.next(getUserById).next(validateUserSuccessChoice);

    this.stateMachine = new StateMachine(this, "PaymentsStateMachine", {
      definitionBody: DefinitionBody.fromChainable(definition),
      stateMachineType: StateMachineType.EXPRESS,
      logs: {
        destination: logGroup,
        level: LogLevel.ALL,
        includeExecutionData: true,
      },
    });

    this.stateMachine.addToRolePolicy(
      new PolicyStatement({
        actions: ["dynamodb:GetItem"],
        resources: [props.usersTable.tableArn],
      })
    );

    this.stateMachine.addToRolePolicy(
      new PolicyStatement({
        actions: ["dynamodb:PutItem"],
        resources: [props.usersTable.tableArn],
      })
    );
  }
}
