import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ddbDocClient } from "../../lib/dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

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

    const command = new GetCommand({
      TableName: usersTableName,
      Key: {
        userId: userId,
      },
    });

    const { Item: user } = await ddbDocClient.send(command);

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "User not found" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(user),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
