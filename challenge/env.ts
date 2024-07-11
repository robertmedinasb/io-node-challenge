import { Environment } from "aws-cdk-lib";
import { parseEnv, z } from "znv";

export const env = parseEnv(process.env, {
  AWS_REGION: z.string(),
}) as Environment;

export type ChallengeEnv = typeof env;
