import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { ApiGatewayRestApi } from "./infrastructure/api/api-gateway-rest-api";
import DynamoDBTables from "./infrastructure/tables/dynamodb-tables";
import PaymentsService from "./services/payments";
import { TransactionsService } from "./services/transactions";

export class ChallengeStack extends cdk.Stack {
  readonly paymentService: PaymentsService;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const {
      activity: activityTable,
      transactions: transactionsTable,
      users: usersTable,
    } = new DynamoDBTables(this, "DynamoDBTables");

    const { restApi } = new ApiGatewayRestApi(this, "RestApi");

    this.paymentService = new PaymentsService(this, "PaymentsService", {
      transactionsTable,
      usersTable,
      activityTable,
      restApi,
    });

    new TransactionsService(this, "TransactionsService", { restApi, transactionsTable });
  }
}
