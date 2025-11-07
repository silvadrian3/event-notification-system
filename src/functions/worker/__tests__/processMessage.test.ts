// Set environment variables BEFORE importing the handler module
process.env.USERS_TABLE_NAME = "test-users-table";
process.env.HOOKBIN_URL = "https://hookbin.example.com/test";

import { SQSEvent } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { handler } from "../processMessage";
import * as scheduleService from "../../../services/scheduleService";
import axios from "axios";
import { createMockContext } from "../../../testUtils";

// Mock the DynamoDB client
const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock the schedule service
jest.mock("../../../services/scheduleService");

describe("processMessage handler", () => {
  beforeEach(() => {
    // Reset mocks before each test
    ddbMock.reset();
    jest.clearAllMocks();

    // Set environment variables
    process.env.USERS_TABLE_NAME = "test-users-table";
    process.env.HOOKBIN_URL = "https://hookbin.example.com/test";

    // Mock schedule service function
    (scheduleService.createOrUpdateEventSchedule as jest.Mock) = jest.fn().mockResolvedValue(undefined);

    // Mock axios post
    mockedAxios.post.mockResolvedValue({ data: "success" } as any);
  });

  afterEach(() => {
    delete process.env.USERS_TABLE_NAME;
    delete process.env.HOOKBIN_URL;
  });

  it("should process a birthday message successfully", async () => {
    const mockUser = {
      userId: "test-user-id",
      firstName: "John",
      lastName: "Doe",
      birthday: "1990-05-15",
      location: "America/New_York",
      createdAt: "2025-01-01T00:00:00.000Z",
    };

    ddbMock.on(GetCommand).resolves({ Item: mockUser });

    const event: SQSEvent = {
      Records: [
        {
          messageId: "msg-1",
          receiptHandle: "receipt-1",
          body: JSON.stringify({ userId: "test-user-id" }),
          attributes: {
            ApproximateReceiveCount: "1",
            SentTimestamp: "1234567890",
            SenderId: "AIDAIT2UOQQY3AUEKVGXU",
            ApproximateFirstReceiveTimestamp: "1234567890",
          },
          messageAttributes: {},
          md5OfBody: "test-md5",
          eventSource: "aws:sqs",
          eventSourceARN: "arn:aws:sqs:region:account-id:queue-name",
          awsRegion: "us-east-1",
        },
      ],
    };

    await handler(event, createMockContext(), () => {});

    // Verify DynamoDB was called to get the user
    expect(ddbMock.calls()).toHaveLength(1);

    // Verify the birthday message was sent
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://hookbin.example.com/test",
      {
        text: "Hey, John Doe it's your birthday",
      }
    );

    // Verify schedule was recreated for next year
    expect(scheduleService.createOrUpdateEventSchedule).toHaveBeenCalledWith(mockUser);
  });

  it("should throw error when userId is missing from message", async () => {
    const event: SQSEvent = {
      Records: [
        {
          messageId: "msg-1",
          receiptHandle: "receipt-1",
          body: JSON.stringify({}), // Missing userId
          attributes: {
            ApproximateReceiveCount: "1",
            SentTimestamp: "1234567890",
            SenderId: "AIDAIT2UOQQY3AUEKVGXU",
            ApproximateFirstReceiveTimestamp: "1234567890",
          },
          messageAttributes: {},
          md5OfBody: "test-md5",
          eventSource: "aws:sqs",
          eventSourceARN: "arn:aws:sqs:region:account-id:queue-name",
          awsRegion: "us-east-1",
        },
      ],
    };

    await expect(handler(event, createMockContext(), () => {})).rejects.toThrow("Message is missing a userId");

    // Verify DynamoDB was not called
    expect(ddbMock.calls()).toHaveLength(0);
  });

  it("should throw error when user is not found", async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });

    const event: SQSEvent = {
      Records: [
        {
          messageId: "msg-1",
          receiptHandle: "receipt-1",
          body: JSON.stringify({ userId: "non-existent-user" }),
          attributes: {
            ApproximateReceiveCount: "1",
            SentTimestamp: "1234567890",
            SenderId: "AIDAIT2UOQQY3AUEKVGXU",
            ApproximateFirstReceiveTimestamp: "1234567890",
          },
          messageAttributes: {},
          md5OfBody: "test-md5",
          eventSource: "aws:sqs",
          eventSourceARN: "arn:aws:sqs:region:account-id:queue-name",
          awsRegion: "us-east-1",
        },
      ],
    };

    await expect(handler(event, createMockContext(), () => {})).rejects.toThrow("User not found with ID: non-existent-user");
  });

  it("should throw error when axios request fails", async () => {
    const mockUser = {
      userId: "test-user-id",
      firstName: "John",
      lastName: "Doe",
      birthday: "1990-05-15",
      location: "America/New_York",
      createdAt: "2025-01-01T00:00:00.000Z",
    };

    ddbMock.on(GetCommand).resolves({ Item: mockUser });
    mockedAxios.post.mockRejectedValue(new Error("Network error"));

    const event: SQSEvent = {
      Records: [
        {
          messageId: "msg-1",
          receiptHandle: "receipt-1",
          body: JSON.stringify({ userId: "test-user-id" }),
          attributes: {
            ApproximateReceiveCount: "1",
            SentTimestamp: "1234567890",
            SenderId: "AIDAIT2UOQQY3AUEKVGXU",
            ApproximateFirstReceiveTimestamp: "1234567890",
          },
          messageAttributes: {},
          md5OfBody: "test-md5",
          eventSource: "aws:sqs",
          eventSourceARN: "arn:aws:sqs:region:account-id:queue-name",
          awsRegion: "us-east-1",
        },
      ],
    };

    await expect(handler(event, createMockContext(), () => {})).rejects.toThrow("Network error");

    // Verify axios was called
    expect(mockedAxios.post).toHaveBeenCalled();
  });

  it("should process multiple records in a batch", async () => {
    const mockUser1 = {
      userId: "user-1",
      firstName: "John",
      lastName: "Doe",
      birthday: "1990-05-15",
      location: "America/New_York",
      createdAt: "2025-01-01T00:00:00.000Z",
    };

    const mockUser2 = {
      userId: "user-2",
      firstName: "Jane",
      lastName: "Smith",
      birthday: "1985-12-25",
      location: "Europe/London",
      createdAt: "2025-01-01T00:00:00.000Z",
    };

    ddbMock
      .on(GetCommand, { Key: { userId: "user-1" } })
      .resolves({ Item: mockUser1 })
      .on(GetCommand, { Key: { userId: "user-2" } })
      .resolves({ Item: mockUser2 });

    const event: SQSEvent = {
      Records: [
        {
          messageId: "msg-1",
          receiptHandle: "receipt-1",
          body: JSON.stringify({ userId: "user-1" }),
          attributes: {
            ApproximateReceiveCount: "1",
            SentTimestamp: "1234567890",
            SenderId: "AIDAIT2UOQQY3AUEKVGXU",
            ApproximateFirstReceiveTimestamp: "1234567890",
          },
          messageAttributes: {},
          md5OfBody: "test-md5-1",
          eventSource: "aws:sqs",
          eventSourceARN: "arn:aws:sqs:region:account-id:queue-name",
          awsRegion: "us-east-1",
        },
        {
          messageId: "msg-2",
          receiptHandle: "receipt-2",
          body: JSON.stringify({ userId: "user-2" }),
          attributes: {
            ApproximateReceiveCount: "1",
            SentTimestamp: "1234567890",
            SenderId: "AIDAIT2UOQQY3AUEKVGXU",
            ApproximateFirstReceiveTimestamp: "1234567890",
          },
          messageAttributes: {},
          md5OfBody: "test-md5-2",
          eventSource: "aws:sqs",
          eventSourceARN: "arn:aws:sqs:region:account-id:queue-name",
          awsRegion: "us-east-1",
        },
      ],
    };

    await handler(event, createMockContext(), () => {});

    // Verify DynamoDB was called twice
    expect(ddbMock.calls()).toHaveLength(2);

    // Verify both messages were sent
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://hookbin.example.com/test",
      {
        text: "Hey, John Doe it's your birthday",
      }
    );
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://hookbin.example.com/test",
      {
        text: "Hey, Jane Smith it's your birthday",
      }
    );

    // Verify schedules were recreated for both users
    expect(scheduleService.createOrUpdateEventSchedule).toHaveBeenCalledTimes(2);
  });

  it("should throw error when DynamoDB fails", async () => {
    ddbMock.on(GetCommand).rejects(new Error("DynamoDB error"));

    const event: SQSEvent = {
      Records: [
        {
          messageId: "msg-1",
          receiptHandle: "receipt-1",
          body: JSON.stringify({ userId: "test-user-id" }),
          attributes: {
            ApproximateReceiveCount: "1",
            SentTimestamp: "1234567890",
            SenderId: "AIDAIT2UOQQY3AUEKVGXU",
            ApproximateFirstReceiveTimestamp: "1234567890",
          },
          messageAttributes: {},
          md5OfBody: "test-md5",
          eventSource: "aws:sqs",
          eventSourceARN: "arn:aws:sqs:region:account-id:queue-name",
          awsRegion: "us-east-1",
        },
      ],
    };

    await expect(handler(event, createMockContext(), () => {})).rejects.toThrow("DynamoDB error");
  });
});
