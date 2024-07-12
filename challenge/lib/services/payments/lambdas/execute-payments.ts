import { Handler } from "aws-lambda";
import { randomUUID } from "crypto";

type Event = {
  user: {
    userId: string;
    name: string;
    lastName: string;
  };
  amount: number;
};

type Result = {
  transaction: {
    message: string;
    transactionId: string;
    amount: string;
  };
  user: Event["user"];
};

const executePayments: Handler<Event, Result> = async (event) => {
  console.log("event information", JSON.stringify(event));

  return {
    transaction: {
      message: "Payment registered successfully",
      transactionId: randomUUID(),
      amount: event.amount.toString(),
    },
    user: event.user,
  };
};

export const handler = executePayments;
