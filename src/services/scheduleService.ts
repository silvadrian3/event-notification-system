import {
  CreateScheduleCommand,
  DeleteScheduleCommand,
  UpdateScheduleCommand,
  FlexibleTimeWindowMode,
  ActionAfterCompletion,
} from "@aws-sdk/client-scheduler";
import { User } from "../types";
import { getNextBirthday9AmUtc } from "../lib/time";
import { schedulerClient, isOffline } from "../lib/schedule";

const SQS_QUEUE_ARN = process.env.EVENT_QUEUE_ARN;
const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN;

const getScheduleName = (userId: string) => `event-user-${userId}`;

export async function createOrUpdateEventSchedule(user: User) {
  if (isOffline) {
    console.log("OFFLINE: Skipping schedule creation for", user.userId);
    return;
  }

  const scheduleName = getScheduleName(user.userId);
  const nextBirthdayUtc = getNextBirthday9AmUtc(user.birthday, user.location);

  const scheduleExpression = `at(${
    nextBirthdayUtc.toISOString().split(".")[0]
  })`;

  const scheduleInput = {
    ScheduleExpression: scheduleExpression,
    FlexibleTimeWindow: { Mode: FlexibleTimeWindowMode.OFF },
    Target: {
      Arn: SQS_QUEUE_ARN,
      RoleArn: SCHEDULER_ROLE_ARN,
      Input: JSON.stringify({
        userId: user.userId,
        type: "BIRTHDAY",
      }),
    },

    ActionAfterCompletion: ActionAfterCompletion.DELETE,
  };

  try {
    const createCommand = new CreateScheduleCommand({
      ...scheduleInput,
      Name: scheduleName,
    });
    await schedulerClient.send(createCommand);
    console.log(`Schedule CREATED for ${user.userId} at ${scheduleExpression}`);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "ConflictException") {
        console.log("Schedule already exists, UPDATING...");
        const updateCommand = new UpdateScheduleCommand({
          ...scheduleInput,
          Name: scheduleName,
        });
        await schedulerClient.send(updateCommand);
        console.log(
          `Schedule UPDATED for ${user.userId} at ${scheduleExpression}`
        );
      } else {
        console.error("Error creating/updating schedule:", error);
        throw error;
      }
    }
  }
}

export async function deleteBirthdaySchedule(userId: string) {
  if (isOffline) {
    console.log("OFFLINE: Skipping schedule deletion for", userId);
    return;
  }

  const command = new DeleteScheduleCommand({
    Name: getScheduleName(userId),
  });

  try {
    await schedulerClient.send(command);
    console.log(`Schedule deleted for ${userId}`);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "ResourceNotFoundException") {
        console.warn(`No schedule found to delete for ${userId}`);
      } else {
        console.error(`Error deleting schedule for ${userId}:`, error);
        throw error;
      }
    }
  }
}
