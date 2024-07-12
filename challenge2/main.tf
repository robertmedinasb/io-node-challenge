provider "aws" {
  shared_config_files      = ["/Users/robertmedina/.aws/config"]
  shared_credentials_files = ["/Users/robertmedina/.aws/credentials"]
  profile                  = "default"
}
resource "aws_dynamodb_table" "users" {
  name         = "tf-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  attribute {
    name = "userId"
    type = "S"
  }
}
resource "aws_dynamodb_table" "transactions" {
  name         = "tf-transactions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "transactionId"
  attribute {
    name = "transactionId"
    type = "S"
  }
  stream_enabled = true
  stream_view_type = "NEW_IMAGE"

}
resource "aws_dynamodb_table" "activity" {
  name         = "tf-activity"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "acivityId"
  range_key = "userId"
  attribute {
    name = "acivityId"
    type = "S"
  }
  attribute {
    name = "userId"
    type = "S"
  }
}
resource "aws_dynamodb_table_item" "user1" {
  table_name = aws_dynamodb_table.users.name
  hash_key   = aws_dynamodb_table.users.hash_key
  item       = <<ITEM
{
  "name": {"S": "Pedro"},
  "userId": {"S": "f529177d-0521-414e-acd9-6ac840549e97"},
  "lastName": {"S": "Suarez"}
}
ITEM
}
resource "aws_dynamodb_table_item" "user2" {
  table_name = aws_dynamodb_table.users.name
  hash_key   = aws_dynamodb_table.users.hash_key
  item       = <<ITEM
{
  "name": {"S": "Andrea"},
  "userId": {"S": "15f1c60a-2833-49b7-8660-065b58be2f89"},
  "lastName": {"S": "Vargas"}
}
ITEM
}

data "archive_file" "execute_payments_lambda_function" {
  type = "zip"
  source_file = "${path.module}/app/lambdas/execute-payments/index.js"
  output_path = "execute_payments.zip"
}

data "archive_file" "register_activity_lambda_function" {
  type = "zip"
  source_file = "${path.module}/app/lambdas/register-activity/index.js"
  output_path = "register_activity.zip"
}


data "archive_file" "get_trasaction_lambda_function" {
  type = "zip"
  source_file = "${path.module}/app/lambdas/get-transaction/index.js"
  output_path = "get_transaction.zip"
}

resource "aws_iam_role" "lambda_role" {
  name = "lambda_role"
  assume_role_policy = <<EOF
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "lambda.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }
  EOF
}


resource "aws_lambda_function" "v0_execute_payment_lambda" {
  filename         = data.archive_file.execute_payments_lambda_function.output_path
  function_name = "execute_payments_lambda_function"
  role          = aws_iam_role.lambda_role.arn
  handler       = "index.handler"
  source_code_hash = data.archive_file.execute_payments_lambda_function.output_base64sha256
  runtime = "nodejs18.x"
  description= "Executes payment lambda"
  environment {
    variables = {
      foo = "bar"
    }
  }
}

resource "aws_iam_role" "step_function_role" {
  name               = "StepFunctionRole"
  assume_role_policy = <<EOF
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "states.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }
  EOF
}

resource "aws_cloudwatch_log_group" "payment_state_machine_log_group_v1" {
  name              = "/aws/vendedlogs/states/payments-state-machine-log-group"
  retention_in_days = 1
}

data "aws_iam_policy_document" "state_machine_logs_policy_document" {
  statement {
    effect    = "Allow" 
    actions   = [
      "logs:CreateLogDelivery",
      "logs:GetLogDelivery",
      "logs:UpdateLogDelivery",
      "logs:DeleteLogDelivery",
      "logs:ListLogDeliveries",
      "logs:PutResourcePolicy",
      "logs:DescribeResourcePolicies"
    ]
    resources = ["*"]
  }
  statement {
    effect    = "Allow" 
    actions   = [
      "logs:PutLogEvents",
      "logs:PutDestination", 
      "logs:PutDestinationPolicy"
    ]
    resources = ["${aws_cloudwatch_log_group.payment_state_machine_log_group_v1.arn}:*"]
  }
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:GetItem"]
    resources  = [aws_dynamodb_table.users.arn]
  }
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:PutItem"]
    resources  = [aws_dynamodb_table.transactions.arn]
  }
  statement { 
    effect = "Allow"
    actions = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.v0_execute_payment_lambda.arn]
  }
}

resource "aws_iam_policy" "state_machine_logs_policy" {
  name        = "ste-function-policy-attachment"
  description = "Policy for the state machine"
  policy      = data.aws_iam_policy_document.state_machine_logs_policy_document.json
}


resource "aws_iam_role_policy_attachment" "state_machine_logs_policy_attachment" {
  role       = aws_iam_role.step_function_role.name
  policy_arn = aws_iam_policy.state_machine_logs_policy.arn
}

resource "aws_sfn_state_machine" "v1_payment_state_machine" {
  name     = "v1_payment_state_machine"
  role_arn = aws_iam_role.step_function_role.arn
  type = "EXPRESS"
  logging_configuration {
    level = "ALL"
    include_execution_data = true
    log_destination        = "${aws_cloudwatch_log_group.payment_state_machine_log_group_v1.arn}:*"
  }
  definition = <<EOF
{
  "StartAt": "Validate User",
  "States": {
    "Validate User": {
      "Type": "Pass",
      "Next": "Get User By Id"
    },
    "Get User By Id": {
      "Next": "User validation success?",
      "Type": "Task",
      "ResultPath": "$.dynamodGetItemResponse",
      "Resource": "arn:aws:states:::dynamodb:getItem",
      "Parameters": {
        "Key": {
          "userId": {
            "S.$": "$.userId"
          }
        },
        "TableName": "${aws_dynamodb_table.users.name}",
        "ConsistentRead": false
      }
    },
    "User validation success?": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.dynamodGetItemResponse.Item",
          "IsPresent": false,
          "Next": "Something was wrong"
        }
      ],
      "Default": "Unmarshal DynamoDB user response"
    },
    "Unmarshal DynamoDB user response": {
      "Type": "Pass",
      "ResultPath": "$.user",
      "InputPath": "$.dynamodGetItemResponse.Item",
      "Parameters": {
        "userId.$": "$.userId.S",
        "name.$": "$.name.S",
        "lastName.$": "$.lastName.S"
      },
      "Next": "Execute Payments Lambda"
    },
    "Execute Payments Lambda": {
      "Next": "Save transaction Into DynamoDB",
      "Retry": [
        {
          "ErrorEquals": [
            "Lambda.ClientExecutionTimeoutException",
            "Lambda.ServiceException",
            "Lambda.AWSLambdaException",
            "Lambda.SdkClientException"
          ],
          "IntervalSeconds": 2,
          "MaxAttempts": 6,
          "BackoffRate": 2
        }
      ],
      "Type": "Task",
      "OutputPath": "$.Payload",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Parameters": {
        "FunctionName": "${aws_lambda_function.v0_execute_payment_lambda.arn}",
        "Payload": {
          "user.$": "$.user",
          "amount.$": "$.amount"
        }
      }
    },
    "Save transaction Into DynamoDB": {
      "Next": "Payment execution success?",
      "Type": "Task",
      "ResultPath": "$.putItemResponse",
      "Resource": "arn:aws:states:::dynamodb:putItem",
      "Parameters": {
        "Item": {
          "userId": {
            "S.$": "$.user.userId"
          },
          "transactionId": {
            "S.$": "$.transaction.transactionId"
          },
          "amount": {
            "S.$": "$.transaction.amount"
          }
        },
        "TableName": "${aws_dynamodb_table.transactions.name}"
      }
    },
    "Payment execution success?": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.putItemResponse.SdkHttpMetadata.HttpStatusCode",
          "NumericEquals": 200,
          "Next": "Success"
        }
      ],
      "Default": "Something was wrong"
    },
    "Something was wrong": {
      "Type": "Fail",
      "Cause": "Something was wrong"
    },
    "Success": {
      "Type": "Pass",
      "Parameters": {
        "type": 1,
        "value": {
          "message": "Payment registered successfully",
          "transactionId.$": "$.transaction.transactionId"
        }
      },
      "End": true
    }
  }
}
EOF
}

resource "aws_api_gateway_rest_api" "challenge_api" {
  name = "tf-challenge-api"
}
resource "aws_api_gateway_resource" "payment_resource" {
  parent_id   = aws_api_gateway_rest_api.challenge_api.root_resource_id
  path_part   = "payments"
  rest_api_id = aws_api_gateway_rest_api.challenge_api.id
}
resource "aws_api_gateway_method" "payment_method" {
  authorization = "NONE"
  http_method   = "POST"
  resource_id   = aws_api_gateway_resource.payment_resource.id
  rest_api_id   = aws_api_gateway_rest_api.challenge_api.id
}
resource "aws_iam_role" "api_gateway_invoke_step_functions_role" {
  name = "api-gateway-invoke-step-functions-role"
  assume_role_policy =  <<EOF
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "apigateway.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }
  EOF
}

data "aws_iam_policy_document" "policy_start_sfn" {
  statement {
    sid    = "ApiGwPolicy"
    effect = "Allow"
    actions = [
      "states:StartSyncExecution",
      "states:StartExecution"
    ]
    resources = [
      "*"
    ]
  }

}

resource "aws_iam_role_policy" "policy_start_sfn" {
  policy = data.aws_iam_policy_document.policy_start_sfn.json
  role   = aws_iam_role.api_gateway_invoke_step_functions_role.id
}

resource "aws_api_gateway_integration" "challenge_api_integration" {
  http_method             = aws_api_gateway_method.payment_method.http_method
  integration_http_method = "POST"
  resource_id             = aws_api_gateway_resource.payment_resource.id
  rest_api_id             = aws_api_gateway_rest_api.challenge_api.id
  type                    = "AWS"
  uri                     = "arn:aws:apigateway:us-east-2:states:action/StartSyncExecution"
  credentials = aws_iam_role.api_gateway_invoke_step_functions_role.arn
  request_templates       = {
    "application/json" = <<EOF
      {
        "input": "$util.escapeJavaScript($input.json('$'))",
        "stateMachineArn": "${aws_sfn_state_machine.v1_payment_state_machine.arn}"
      }
    EOF
  }
}
resource "aws_cloudwatch_log_group" "apigateway" {
  name              = "/aws/apigateway/${aws_api_gateway_rest_api.challenge_api.name}"
  retention_in_days = 3
}
resource "aws_api_gateway_method_response" "payment_method_response" {
  http_method = aws_api_gateway_method.payment_method.http_method
  resource_id = aws_api_gateway_resource.payment_resource.id
  rest_api_id = aws_api_gateway_rest_api.challenge_api.id
  status_code = 201
}
resource "aws_api_gateway_integration_response" "payment_response" {
  http_method = aws_api_gateway_method.payment_method.http_method
  resource_id = aws_api_gateway_resource.payment_resource.id
  rest_api_id = aws_api_gateway_rest_api.challenge_api.id
  status_code = aws_api_gateway_method_response.payment_method_response.status_code
  response_templates = {
    "application/json" = <<EOF
      #if($input.path('$.status').toString().equals("FAILED"))
        #set($context.responseOverride.status = 400)
        {
          "message": "$input.path('$.cause')"
        }
        #else
        #set($outputString = $input.path('$.output'))
        #set($outputJson = $util.parseJson($outputString))
        {
          "message": "$util.escapeJavaScript($outputJson.value.message)",
          "transactionId": "$util.escapeJavaScript($outputJson.value.transactionId)"
        }
      #end
     EOF
  }
  depends_on = [
    aws_api_gateway_integration.challenge_api_integration
  ]
}

resource "aws_iam_role" "lambda_assume_role" {
  name               = "lambda-dynamodb-role"
  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": "LambdaAssumeRole"
    }
  ]
}
EOF
}

resource "aws_lambda_function" "v0_register_activity_lambda" {
  filename         = data.archive_file.register_activity_lambda_function.output_path
  function_name = "v0_register_activity_lambda"
  role          = aws_iam_role.lambda_assume_role.arn
  handler       = "index.handler"
  source_code_hash = data.archive_file.register_activity_lambda_function.output_base64sha256
  runtime = "nodejs18.x"
  description= "Register activity lambda"
  environment {
    variables = {
      ACTIVITY_TABLE_NAME = "${aws_dynamodb_table.activity.name}"
    }
  }
}


data "aws_iam_policy_document" "dynamodb_read_log_policy_document" {
  statement {
    effect    = "Allow"
    actions   = [
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:GetItem",
      "dynamodb:GetRecords",
      "dynamodb:GetShardIterator",
      "dynamodb:DescribeStream",
      "dynamodb:ListStreams",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:BatchGetItem",
      "dynamodb:BatchWriteItem"
    ]
    resources  = ["*"]
  }
  statement {
    effect    = "Allow"
    actions   = [
      "logs:*"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "dynamodb_read_log_policy" {
  name        = "dynamodb-policy-attachment"
  description = "Policy for the dynamo db stream"
  policy      = data.aws_iam_policy_document.dynamodb_read_log_policy_document.json
}

resource "aws_iam_role_policy_attachment" "dynamodb_read_logs_policy_attachment" {
  role       = aws_iam_role.lambda_assume_role.name
  policy_arn = aws_iam_policy.dynamodb_read_log_policy.arn
}

resource "aws_lambda_event_source_mapping" "register_activity_stream_mapping" {
  event_source_arn  = aws_dynamodb_table.transactions.stream_arn
  function_name     = aws_lambda_function.v0_register_activity_lambda.function_name
  starting_position = "LATEST"
}

# resource "aws_iam_policy" "lambda_dynamodb_stream_policy" {
#   name        = "lambda_dynamodb_stream_policy"
#   description = "Allows Lambda function to read from DynamoDB stream"
#   policy      = <<EOF
#   {
#     Version: "2012-10-17",
#     Statement: [
#       {
#         Effect: "Allow",
#         Action: ["dynamodb:*"],
#         Resources:[${aws_dynamodb_table.transactions.stream_arn}, ${aws_dynamodb_table.activity.arn}]
#       }
#     ]
#   }
#   EOF
# }