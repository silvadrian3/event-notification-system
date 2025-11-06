import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "../../lib/dynamodb";

const usersTableName = process.env.USERS_TABLE_NAME;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const userId = event.pathParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing userId in path" }),
      };
    }

    await ddbDocClient.send(
      new DeleteCommand({
        TableName: usersTableName,
        Key: {
          userId: userId,
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "User deleted successfully",
        userId: userId,
      }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
