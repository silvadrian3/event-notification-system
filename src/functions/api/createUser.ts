import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "../../lib/dynamodb";
import { v4 as uuid } from "uuid";
import { CreateUserPayloadSchema, User } from "../../types";

const usersTableName = process.env.USERS_TABLE_NAME;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!event.body) {
      return { statusCode: 400, body: "Error: Missing request body" };
    }

    const data = JSON.parse(event.body);

    const parsedPayload = CreateUserPayloadSchema.safeParse(data);

    if (!parsedPayload.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid user data",
          errors: parsedPayload.error.issues,
        }),
      };
    }

    const newUserId = uuid();
    const newUser: User = {
      userId: newUserId,
      ...parsedPayload.data,
      createdAt: new Date().toUTCString(),
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: usersTableName,
        Item: newUser,
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify(newUser),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
