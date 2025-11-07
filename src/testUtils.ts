import { Context, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

/**
 * Creates a mock AWS Lambda Context object for testing
 */
export const createMockContext = (): Context => {
  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName: "test-function",
    functionVersion: "$LATEST",
    invokedFunctionArn: "arn:aws:lambda:us-east-1:123456789012:function:test-function",
    memoryLimitInMB: "128",
    awsRequestId: "test-request-id",
    logGroupName: "/aws/lambda/test-function",
    logStreamName: "2025/01/01/[$LATEST]test-stream",
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };
};

/**
 * Type helper to properly type API Gateway responses in tests.
 * This converts the union type to the structured result type with statusCode and body.
 */
export const asApiGatewayResult = (
  result: any
): APIGatewayProxyStructuredResultV2 => {
  return result as APIGatewayProxyStructuredResultV2;
};
