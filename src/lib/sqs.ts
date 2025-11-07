import { SQSClient } from "@aws-sdk/client-sqs";

const isOffline = process.env.IS_OFFLINE === "true";

const sqsConfig = isOffline
  ? {
      region: process.env.AWS_REGION || "ap-southeast-1",
      endpoint: "http://localhost:9324",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
      },
    }
  : {};

export const sqsClient = new SQSClient(sqsConfig);
