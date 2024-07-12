import { Duration } from "aws-cdk-lib";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { Architecture, StartingPosition } from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import path from "path";

interface PaymentsServiceFunctionsProps {
  activityTable: Table;
  transactionsTable: Table;
}

export class PaymentsServiceFunctions extends Construct {
  readonly executePayments: NodejsFunction;
  readonly registerActivity: NodejsFunction;

  constructor(scope: Construct, id: string, props: PaymentsServiceFunctionsProps) {
    super(scope, id);

    this.executePayments = new NodejsFunction(this, "ExecutePayments", {
      architecture: Architecture.ARM_64,
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ["@aws-sdk/*"],
      },
      entry: path.join(__dirname, "../lambdas/execute-payments.ts"),
      memorySize: 512,
      timeout: Duration.seconds(30),
      description: "Executes payment lambda",
    });

    this.registerActivity = new NodejsFunction(this, "RegisterActivity", {
      architecture: Architecture.ARM_64,
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ["@aws-sdk/*"],
      },
      entry: path.join(__dirname, "../lambdas/register-activity.ts"),
      memorySize: 512,
      timeout: Duration.seconds(30),
      description: "Register activity lambda",
      environment: {
        ACTIVITY_TABLE_NAME: props.activityTable.tableName,
      },
    });

    this.registerActivity.addEventSource(
      new DynamoEventSource(props.transactionsTable, {
        startingPosition: StartingPosition.LATEST,
        batchSize: 1,
        reportBatchItemFailures: true,
      })
    );
    props.activityTable.grantWriteData(this.registerActivity);
    props.transactionsTable.grantStreamRead(this.registerActivity);
  }
}
