import { Duration } from "aws-cdk-lib";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { Architecture } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import path from "path";

interface TransactionsServiceProps {
  restApi: RestApi;
  transactionsTable: Table;
}

export class TransactionsService extends Construct {
  constructor(scope: Construct, id: string, props: TransactionsServiceProps) {
    super(scope, id);

    const getTransaction = new NodejsFunction(this, "GetTransactionFunction", {
      architecture: Architecture.ARM_64,
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ["@aws-sdk/*"],
      },
      entry: path.join(__dirname, "./lambdas/get-transaction.ts"),
      memorySize: 512,
      timeout: Duration.seconds(100),
      description: "Get transaction handler",
      environment: {
        TRANSACTION_TABLE_NAME: props.transactionsTable.tableName,
      },
    });

    const integration = new LambdaIntegration(getTransaction);

    props.restApi.root.addResource("transactions").addMethod("GET", integration);

    props.transactionsTable.grantReadData(getTransaction);
  }
}
