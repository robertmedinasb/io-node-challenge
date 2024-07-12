import { AttributeType, StreamViewType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

class DynamoDBTables extends Construct {
  readonly users: Table;
  readonly transactions: Table;
  readonly activity: Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.users = new Table(this, "users", {
      tableName: "users",
      partitionKey: { name: "userId", type: AttributeType.STRING },
    });

    this.transactions = new Table(this, "transactions", {
      tableName: "transactions",
      partitionKey: { name: "transactionId", type: AttributeType.STRING },
      stream: StreamViewType.NEW_IMAGE,
    });

    this.activity = new Table(this, "activity", {
      tableName: "activity",
      partitionKey: { name: "activityId", type: AttributeType.STRING },
    });
  }
}

export default DynamoDBTables;
