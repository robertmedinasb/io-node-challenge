import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { mockClient } from "aws-sdk-client-mock";

import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import axios from "axios";
import * as path from "path";
import { ChallengeStack } from "../../lib/challenge-stack";
import { PaymentStateMachine } from "../../lib/services/payments/constructs/state-machine";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("PaymentStateMachine", () => {
  let app: App;
  let stack: ChallengeStack;
  let usersTable: Table;
  let transactionsTable: Table;
  let executePaymentsLambda: NodejsFunction;
  let paymentStateMachine: PaymentStateMachine;
  let ddbMock: ReturnType<typeof mockClient>;
  let lambdaMock: ReturnType<typeof mockClient>;

  beforeAll(() => {
    ddbMock = mockClient(DynamoDBClient);
    lambdaMock = mockClient(LambdaClient);
  });

  beforeEach(() => {
    app = new App();
    stack = new ChallengeStack(app, "ChallengeStack");

    usersTable = new Table(stack, "UsersTable", {
      partitionKey: { name: "userId", type: AttributeType.STRING },
    });

    transactionsTable = new Table(stack, "TransactionsTable", {
      partitionKey: { name: "transactionId", type: AttributeType.STRING },
    });

    executePaymentsLambda = new NodejsFunction(stack, "ExecutePaymentsLambda", {
      entry: path.join(
        __dirname,
        "../../lib/services/payments/lambdas/execute-payments.ts"
      ),
      handler: "handler",
      runtime: Runtime.NODEJS_14_X,
    });

    const props = {
      usersTable,
      transactionsTable,
      executePaymentsLambda,
    };

    paymentStateMachine = new PaymentStateMachine(stack, "PaymentStateMachine", props);
  });

  afterEach(() => {
    ddbMock.reset();
    lambdaMock.reset();
  });

  test("State machine is defined correctly", () => {
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::StepFunctions::StateMachine", {
      StateMachineType: "EXPRESS",
    });
  });

  test("State machine succeeds when user is found and payment is executed", async () => {
    ddbMock.on(GetItemCommand).resolves({
      Item: {
        userId: { S: "user123" },
        name: { S: "John" },
        lastName: { S: "Doe" },
      },
    });

    ddbMock.on(PutItemCommand).resolves({});

    lambdaMock.on(InvokeCommand).resolves({});

    const executionArn =
      "arn:aws:states:us-east-1:123456789012:execution:PaymentStateMachine:execution-123";

    mockedAxios.post.mockResolvedValueOnce({
      data: { executionArn },
    });

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: "SUCCEEDED",
        output: JSON.stringify({ message: "Payment registered successfully" }),
      },
    });

    const response = await axios.post("http://localhost:8083/execution", {
      stateMachineArn: paymentStateMachine.stateMachine.stateMachineArn,
      input: JSON.stringify({ userId: "user123", amount: "100" }),
    });

    expect(response.data.executionArn).toBe(executionArn);

    const result = await axios.get(`http://localhost:8083/execution/${executionArn}`);
    expect(result.data.status).toBe("SUCCEEDED");
    expect(JSON.parse(result.data.output)).toEqual({
      message: "Payment registered successfully",
    });
  });

  test("State machine fails when user is not found", async () => {
    ddbMock.on(GetItemCommand).resolves({ Item: undefined });

    const executionArn =
      "arn:aws:states:us-east-1:123456789012:execution:PaymentStateMachine:execution-456";

    const response = await axios.post("http://localhost:8083/execution", {
      stateMachineArn: paymentStateMachine.stateMachine.stateMachineArn,
      input: JSON.stringify({ userId: "user123", amount: "100" }),
    });

    expect(response.data.executionArn).toBe(executionArn);

    const result = await axios.get(`http://localhost:8083/execution/${executionArn}`);
    expect(result.data.status).toBe("FAILED");
    expect(JSON.parse(result.data.output)).toEqual({
      cause: "Something was wrong",
    });
  });

  test("State machine fails when DynamoDB put operation fails", async () => {
    ddbMock.on(GetItemCommand).resolves({
      Item: {
        userId: { S: "user123" },
        name: { S: "John" },
        lastName: { S: "Doe" },
      },
    });

    ddbMock.on(PutItemCommand).rejects(new Error("DynamoDB error"));

    const executionArn =
      "arn:aws:states:us-east-1:123456789012:execution:PaymentStateMachine:execution-789";

    mockedAxios.post.mockResolvedValueOnce({
      data: { executionArn },
    });

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: "FAILED",
        output: JSON.stringify({ cause: "Something was wrong" }),
      },
    });

    const response = await axios.post("http://localhost:8083/execution", {
      stateMachineArn: stack.paymentService.stateMachine.stateMachineArn,
      input: JSON.stringify({ userId: "user123", amount: "100" }),
    });

    expect(response.data.executionArn).toBe(executionArn);

    const result = await axios.get(`http://localhost:8083/execution/${executionArn}`);
    expect(result.data.status).toBe("FAILED");
    expect(JSON.parse(result.data.output)).toEqual({
      cause: "Something was wrong",
    });
  });

  test("State machine fails when Lambda invocation fails", async () => {
    ddbMock.on(GetItemCommand).resolves({
      Item: {
        userId: { S: "user123" },
        name: { S: "John" },
        lastName: { S: "Doe" },
      },
    });

    ddbMock.on(PutItemCommand).resolves({});

    lambdaMock.on(InvokeCommand).rejects(new Error("Lambda error"));

    const executionArn =
      "arn:aws:states:us-east-1:123456789012:execution:PaymentStateMachine:execution-101112";

    mockedAxios.post.mockResolvedValueOnce({
      data: { executionArn },
    });

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: "FAILED",
        output: JSON.stringify({ cause: "Something was wrong" }),
      },
    });

    const response = await axios.post("http://localhost:8083/execution", {
      stateMachineArn: paymentStateMachine.stateMachine.stateMachineArn,
      input: JSON.stringify({ userId: "user123", amount: "100" }),
    });

    expect(response.data.executionArn).toBe(executionArn);

    const result = await axios.get(`http://localhost:8083/execution/${executionArn}`);
    expect(result.data.status).toBe("FAILED");
    expect(JSON.parse(result.data.output)).toEqual({
      cause: "Something was wrong",
    });
  });

  test("State machine fails when user is not found", async () => {
    ddbMock.on(GetItemCommand).resolves({ Item: undefined });

    const executionArn =
      "arn:aws:states:us-east-1:123456789012:execution:PaymentStateMachine:execution-456";

    mockedAxios.post.mockResolvedValueOnce({
      data: { executionArn },
    });

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: "FAILED",
        output: JSON.stringify({ cause: "Something was wrong" }),
      },
    });

    const response = await axios.post("http://localhost:8083/execution", {
      stateMachineArn: paymentStateMachine.stateMachine.stateMachineArn,
      input: JSON.stringify({ userId: "user123", amount: "100" }),
    });

    expect(response.data.executionArn).toBe(executionArn);

    const result = await axios.get(`http://localhost:8083/execution/${executionArn}`);
    expect(result.data.status).toBe("FAILED");
    expect(JSON.parse(result.data.output)).toEqual({
      cause: "Something was wrong",
    });
  });

  test("State machine fails when DynamoDB put operation fails", async () => {
    ddbMock.on(GetItemCommand).resolves({
      Item: {
        userId: { S: "user123" },
        name: { S: "John" },
        lastName: { S: "Doe" },
      },
    });

    ddbMock.on(PutItemCommand).rejects(new Error("DynamoDB error"));

    const executionArn =
      "arn:aws:states:us-east-1:123456789012:execution:PaymentStateMachine:execution-789";

    mockedAxios.post.mockResolvedValueOnce({
      data: { executionArn },
    });

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: "FAILED",
        output: JSON.stringify({ cause: "Something was wrong" }),
      },
    });

    const response = await axios.post("http://localhost:8083/execution", {
      stateMachineArn: paymentStateMachine.stateMachine.stateMachineArn,
      input: JSON.stringify({ userId: "user123", amount: "100" }),
    });

    expect(response.data.executionArn).toBe(executionArn);

    const result = await axios.get(`http://localhost:8083/execution/${executionArn}`);
    expect(result.data.status).toBe("FAILED");
    expect(JSON.parse(result.data.output)).toEqual({
      cause: "Something was wrong",
    });
  });

  test("State machine fails when Lambda invocation fails", async () => {
    ddbMock.on(GetItemCommand).resolves({
      Item: {
        userId: { S: "user123" },
        name: { S: "John" },
        lastName: { S: "Doe" },
      },
    });

    ddbMock.on(PutItemCommand).resolves({});

    lambdaMock.on(InvokeCommand).rejects(new Error("Lambda error"));

    const executionArn =
      "arn:aws:states:us-east-1:123456789012:execution:PaymentStateMachine:execution-101112";

    mockedAxios.post.mockResolvedValueOnce({
      data: { executionArn },
    });

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: "FAILED",
        output: JSON.stringify({ cause: "Something was wrong" }),
      },
    });

    const response = await axios.post("http://localhost:8083/execution", {
      stateMachineArn: paymentStateMachine.stateMachine.stateMachineArn,
      input: JSON.stringify({ userId: "user123", amount: "100" }),
    });

    expect(response.data.executionArn).toBe(executionArn);

    const result = await axios.get(`http://localhost:8083/execution/${executionArn}`);
    expect(result.data.status).toBe("FAILED");
    expect(JSON.parse(result.data.output)).toEqual({
      cause: "Something was wrong",
    });
  });
});
