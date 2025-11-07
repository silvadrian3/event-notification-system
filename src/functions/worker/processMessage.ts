import { SQSEvent, SQSHandler } from "aws-lambda";
import { ddbDocClient } from "../../lib/dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import axios from "axios";
import { createOrUpdateEventSchedule } from "../../services/scheduleService";
import { User } from "../../types";

const usersTableName = process.env.USERS_TABLE_NAME;
const hookbinUrl = process.env.HOOKBIN_URL;

export const handler: SQSHandler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    try {
      console.log("Processing message:", record.body);

      const { userId } = JSON.parse(record.body);

      if (!userId) {
        throw new Error("Message is missing a userId");
      }

      const { Item: user } = await ddbDocClient.send(
        new GetCommand({
          TableName: usersTableName,
          Key: { userId },
        })
      );

      if (!user) {
        throw new Error(`User not found with ID: ${userId}`);
      }

      const fullName = `${user.firstName} ${user.lastName}`;
      const message = `Hey, ${fullName} it's your birthday`;

      console.log(`Sending message: "${message}" to ${hookbinUrl}`);

      await axios.post(hookbinUrl!, {
        text: message,
      });

      console.log("Message sent successfully!");

      await createOrUpdateEventSchedule(user as User);
    } catch (error) {
      console.error("Error processing message:", error);
      throw error;
    }
  }
};
