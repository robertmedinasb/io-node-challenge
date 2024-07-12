import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as Challenge from "../lib/challenge-stack";

describe("Infrastructure resources created", () => {
  let app: cdk.App;
  let stack: Challenge.ChallengeStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new Challenge.ChallengeStack(app, "ChallengeTestStack");
    template = Template.fromStack(stack);
  });

  it("should have an API Gateway Rest API", () => {
    template.hasResourceProperties("AWS::ApiGateway::RestApi", {
      Name: "challenge-api",
    });
    template.hasResourceProperties("AWS::ApiGateway::Deployment", {
      Description: "Deployment for the API Gateway",
    });
  });

  it("should have DynamoDB tables", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "activity",
    });
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "transactions",
    });
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "users",
    });
  });

  it("should have a Payments State Machine and its resources", () => {
    template.hasResource("AWS::StepFunctions::StateMachine", {});
  });

  it("should have three lambdas", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Description: "Executes payment lambda",
    });
    template.hasResourceProperties("AWS::Lambda::Function", {
      Description: "Register activity lambda",
    });
    template.hasResourceProperties("AWS::Lambda::Function", {
      Description: "Get transaction handler",
    });
  });
});
