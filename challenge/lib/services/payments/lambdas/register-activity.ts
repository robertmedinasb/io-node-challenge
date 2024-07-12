import { BatchWriteItemCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBStreamHandler } from "aws-lambda";
import { randomUUID } from "crypto";

type DynamoDBTransaction = {
  transactionId: { S: string };
  userId: { S: string };
  amount: { S: string };
};

type DynamoDBActivity = {
  transactionId: { S: string };
  activityId: { S: string };
  date: { S: string };
};

const region = process.env.AWS_REGION;
const activityTableName = process.env.ACTIVITY_TABLE_NAME;

const dynamoDBClient = new DynamoDBClient({ region });

const registerActivity: DynamoDBStreamHandler = async (event) => {
  console.log("records", JSON.stringify(event.Records));

  const records = event.Records;

  const registersToAdd: DynamoDBTransaction[] = [];

  records.map(({ eventName, ...record }) => {
    if (eventName == "INSERT")
      registersToAdd.push(record.dynamodb!.NewImage as DynamoDBTransaction);
  });

  const requestWriteItems = registersToAdd.map(({ transactionId }) => ({
    PutRequest: {
      Item: {
        transactionId: { S: transactionId.S },
        activityId: { S: randomUUID().toString() },
        date: { S: new Date().toISOString() },
      } as DynamoDBActivity,
    },
  }));

  if (registersToAdd.length) {
    const batchWriteItemCommand = new BatchWriteItemCommand({
      RequestItems: {
        [activityTableName!]: requestWriteItems,
      },
    });

    const response = await dynamoDBClient.send(batchWriteItemCommand);

    console.log("response", response);

    if (response.$metadata.httpStatusCode === 200) {
      return {
        batchItemFailures: event.Records.map(({ dynamodb }) => ({
          itemIdentifier: dynamodb!.Keys!.transactionId.S as string,
        })),
      };
    }
  }

  return {
    batchItemFailures: [],
  };
};

export const handler = registerActivity;
