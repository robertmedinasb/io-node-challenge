import { Context } from "aws-lambda";
import { handler, Result } from "../../lib/services/payments/lambdas/execute-payments";

describe("Execute payments handler tests", () => {
  it("should return 201 with transaction and user answer", async () => {
    const fakeUser = { userId: "validId", lastName: "lastName", name: "name" };
    const testAmount = 100;

    const resp: Result = (await handler(
      {
        user: fakeUser,
        amount: testAmount,
      },
      {} as Context,
      jest.fn() // Callback
    )) as Result;

    expect(resp.user).toEqual(fakeUser);
    expect(resp.transaction.amount).toEqual(testAmount.toString());
  });
});
