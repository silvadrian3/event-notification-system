import { APIGatewayProxyEventV2 } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { handler } from "../createUser";
import * as scheduleService from "../../../services/scheduleService";
import { createMockContext, asApiGatewayResult } from "../../../testUtils";

// Mock uuid
jest.mock("uuid", () => ({
  v4: jest.fn(() => "test-uuid-1234"),
}));

// Mock the DynamoDB client
const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock the schedule service
jest.mock("../../../services/scheduleService");

describe("createUser handler", () => {
  beforeEach(() => {
    // Reset mocks before each test
    ddbMock.reset();
    jest.clearAllMocks();

    // Set environment variables
    process.env.USERS_TABLE_NAME = "test-users-table";
    process.env.IS_OFFLINE = "false";

    // Mock schedule service function
    (scheduleService.createOrUpdateEventSchedule as jest.Mock) = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.USERS_TABLE_NAME;
    delete process.env.IS_OFFLINE;
  });

  it("should create a user successfully with valid data", async () => {
    // Mock DynamoDB put command
    ddbMock.on(PutCommand).resolves({});

    const event = {
      body: JSON.stringify({
        firstName: "John",
        lastName: "Doe",
        birthday: "1990-05-15",
        location: "America/New_York",
      }),
    } as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(201);

    const body = JSON.parse(result.body!);
    expect(body).toMatchObject({
      firstName: "John",
      lastName: "Doe",
      birthday: "1990-05-15",
      location: "America/New_York",
    });
    expect(body.userId).toBeDefined();
    expect(body.createdAt).toBeDefined();

    // Verify DynamoDB was called
    expect(ddbMock.calls()).toHaveLength(1);

    // Verify schedule was created
    expect(scheduleService.createOrUpdateEventSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "John",
        lastName: "Doe",
        birthday: "1990-05-15",
        location: "America/New_York",
      })
    );
  });

  it("should return 400 when request body is missing", async () => {
    const event = {} as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(400);
    expect(result.body).toBe("Error: Missing request body");
  });

  it("should return 400 when required fields are missing", async () => {
    const event = {
      body: JSON.stringify({
        firstName: "John",
        // Missing lastName, birthday, and location
      }),
    } as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body!);
    expect(body.message).toBe("Invalid user data");
    expect(body.errors).toBeDefined();
  });

  it("should return 400 when birthday format is invalid", async () => {
    const event = {
      body: JSON.stringify({
        firstName: "John",
        lastName: "Doe",
        birthday: "05/15/1990", // Invalid format
        location: "America/New_York",
      }),
    } as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body!);
    expect(body.message).toBe("Invalid user data");
  });

  it("should handle DynamoDB errors gracefully", async () => {
    ddbMock.on(PutCommand).rejects(new Error("DynamoDB error"));

    const event = {
      body: JSON.stringify({
        firstName: "John",
        lastName: "Doe",
        birthday: "1990-05-15",
        location: "America/New_York",
      }),
    } as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body!);
    expect(body.message).toBe("Internal Server Error");
  });

  it("should handle schedule service errors gracefully", async () => {
    ddbMock.on(PutCommand).resolves({});
    (scheduleService.createOrUpdateEventSchedule as jest.Mock).mockRejectedValue(
      new Error("Scheduler error")
    );

    const event = {
      body: JSON.stringify({
        firstName: "John",
        lastName: "Doe",
        birthday: "1990-05-15",
        location: "America/New_York",
      }),
    } as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body!);
    expect(body.message).toBe("Internal Server Error");
  });

  it("should skip schedule creation in offline mode", async () => {
    process.env.IS_OFFLINE = "true";
    ddbMock.on(PutCommand).resolves({});

    const event = {
      body: JSON.stringify({
        firstName: "John",
        lastName: "Doe",
        birthday: "1990-05-15",
        location: "America/New_York",
      }),
    } as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(201);
    expect(scheduleService.createOrUpdateEventSchedule).toHaveBeenCalled();
  });
});
