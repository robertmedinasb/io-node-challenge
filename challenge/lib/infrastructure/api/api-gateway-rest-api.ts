import { Cors, Deployment, RestApi } from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";

export class ApiGatewayRestApi extends Construct {
  readonly restApi: RestApi;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.restApi = new RestApi(this, "RestApi", {
      restApiName: "challenge-api",
      description: "This is the API Gateway for the challenge",
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: ["*"],
        allowCredentials: true,
      },
    });

    new Deployment(this, "Deployment", {
      api: this.restApi,
      description: "Deployment for the API Gateway",
    });
  }
}
