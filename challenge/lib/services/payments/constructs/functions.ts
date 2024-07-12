import { Duration } from "aws-cdk-lib";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { Architecture} from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import path = require("path");


export class PaymentsServiceFunctions extends Construct {
  readonly executePayments: NodejsFunction;
  readonly registerActivity: NodejsFunction;

  constructor(scope: Construct, id: string) {
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
  }
}
