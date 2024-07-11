#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { env } from "../env";
import { ChallengeStack } from "../lib/challenge-stack";

const app = new cdk.App();
new ChallengeStack(app, "ChallengeStack", {
  env,
});
