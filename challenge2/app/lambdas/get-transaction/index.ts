import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import {
  APIGatewayEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
} from "aws-lambda";
import { DynamoDBTransaction } from "../../types/dynamodb";

const awsRegion = process.env.AWS_REGION;
const transactionTableName = process.env.TRANSACTION_TABLE_NAME;

const dynamoDBClient = new DynamoDBClient({ region: awsRegion });

const getTransaction: APIGatewayProxyHandler = async (event: APIGatewayEvent) => {
  console.log("event", JSON.stringify(event));
  const res: APIGatewayProxyResult = {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: "{}",
  };

  try {
    if (event.queryStringParameters && "transaction_id" in event.queryStringParameters) {
      if ("transaction_id" in event.queryStringParameters) {
        const response = await dynamoDBClient.send(
          new GetItemCommand({
            TableName: transactionTableName,
            Key: {
              transactionId: {
                S: event.queryStringParameters.transaction_id!,
              },
            },
          })
        );

        const item = response.Item as DynamoDBTransaction;

        if (item) {
          res.body = JSON.stringify({
            transactionId: item.transactionId.S || "",
            userId: item.userId.S || "",
            paymentAmount: item.amount.S ? parseFloat(item.amount.S) : null,
          });

          return res;
        }
      }
    }
  } catch (error) {
    console.error("ERROR", error);
  }

  res.statusCode = 404;
  res.body = JSON.stringify({ message: "Transaction not found" });
  return res;
};

export const handler = getTransaction;
