import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import {
  APIGatewayEvent,
  APIGatewayProxyEventQueryStringParameters,
  Context,
} from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { handler } from "../../lib/services/transactions/lambdas/get-transaction";
import { DynamoDBTransaction } from "../../lib/types/dynamodb";

describe("get transaction lambda tests", () => {
  let ddbMock: ReturnType<typeof mockClient>;

  const mockTransaction: DynamoDBTransaction = {
    transactionId: { S: "1234" },
    amount: { S: "100" },
    userId: { S: "validId" },
  };

  beforeAll(() => {
    ddbMock = mockClient(DynamoDBClient);
  });

  afterEach(() => {
    ddbMock.reset();
  });

  it("should return 200 with transaction when it exists", async () => {
    ddbMock.on(GetItemCommand).resolves({
      Item: mockTransaction as DynamoDBTransaction,
    });

    const response = await handler(
      {
        body: null,
        queryStringParameters: {
          transaction_id: mockTransaction.transactionId.S,
        } as APIGatewayProxyEventQueryStringParameters,
      } as APIGatewayEvent,
      {} as Context,
      jest.fn()
    );

    expect(response).toStrictEqual({
      statusCode: 200,
      body: JSON.stringify({
        transactionId: mockTransaction.transactionId.S,
        userId: mockTransaction.userId.S,
        paymentAmount: parseFloat(mockTransaction.amount.S),
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should return 200 with transaction when it exists", async () => {
    ddbMock.on(GetItemCommand).rejects();

    const response = await handler(
      {
        body: null,
        queryStringParameters: {
          transaction_id: mockTransaction.transactionId.S,
        } as APIGatewayProxyEventQueryStringParameters,
      } as APIGatewayEvent,
      {} as Context,
      jest.fn()
    );

    expect(response).toStrictEqual({
      statusCode: 404,
      body: JSON.stringify({ message: "Transaction not found" }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });
});
