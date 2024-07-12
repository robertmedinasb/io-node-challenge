import { Handler } from "aws-lambda";
import { v4 as UUID } from "uuid";

type Event = {
  user: {
    userId: string;
    name: string;
    lastName: string;
  };
  amount: number;
};

export type Result = {
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
      transactionId: UUID(),
      amount: event.amount.toString(),
    },
    user: event.user,
  };
};

export const handler = executePayments;
