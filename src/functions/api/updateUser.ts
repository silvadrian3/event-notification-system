import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "../../lib/dynamodb";
import { UpdateUserPayloadSchema } from "../../types";

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

    if (!event.body) {
      return { statusCode: 400, body: "Error: Missing request body" };
    }
    const data = JSON.parse(event.body);

    const parsedPayload = UpdateUserPayloadSchema.safeParse(data);

    if (!parsedPayload.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid user data",
          errors: parsedPayload.error.issues,
        }),
      };
    }

    const updateData = {
      ...parsedPayload.data,
      updatedAt: new Date().toUTCString(),
    };

    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, unknown> = {};
    const expressionAttributeNames: Record<string, string> = {};

    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        const attributeKey = `#${key}`;
        updateExpressions.push(`${attributeKey} = :${key}`);
        expressionAttributeNames[attributeKey] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    }

    if (updateExpressions.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "No fields to update" }),
      };
    }

    const updateExpression = "SET " + updateExpressions.join(", ");

    const command = new UpdateCommand({
      TableName: usersTableName,
      Key: { userId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    });

    const { Attributes: updatedUser } = await ddbDocClient.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify(updatedUser),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
