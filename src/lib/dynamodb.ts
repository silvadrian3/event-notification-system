import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const isOffline = process.env.IS_OFFLINE === "true";

const ddbConfig = isOffline
  ? {
      region: "localhost",
      endpoint: "http://localhost:8000",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
      },
    }
  : {};

const client = new DynamoDBClient(ddbConfig);
export const ddbDocClient = DynamoDBDocumentClient.from(client);
