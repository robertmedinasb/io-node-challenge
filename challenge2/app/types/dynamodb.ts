export type DynamoDBTransaction = {
  transactionId: { S: string };
  userId: { S: string };
  amount: { S: string };
};

export type DynamoDBActivity = {
  transactionId: { S: string };
  activityId: { S: string };
  date: { S: string };
};
