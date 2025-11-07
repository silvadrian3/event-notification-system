import { APIGatewayProxyEventV2 } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { handler } from "../updateUser";
import * as scheduleService from "../../../services/scheduleService";
import { createMockContext, asApiGatewayResult } from "../../../testUtils";

// Mock the DynamoDB client
const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock the schedule service
jest.mock("../../../services/scheduleService");

describe("updateUser handler", () => {
  beforeEach(() => {
    // Reset mocks before each test
    ddbMock.reset();
    jest.clearAllMocks();

    // Set environment variables
    process.env.USERS_TABLE_NAME = "test-users-table";

    // Mock schedule service function
    (scheduleService.createOrUpdateEventSchedule as jest.Mock) = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.USERS_TABLE_NAME;
  });

  it("should update a user successfully with valid data", async () => {
    const updatedUser = {
      userId: "test-user-id",
      firstName: "Jane",
      lastName: "Doe",
      birthday: "1990-05-15",
      location: "America/Los_Angeles",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: expect.any(String),
    };

    ddbMock.on(UpdateCommand).resolves({ Attributes: updatedUser });

    const event = {
      pathParameters: { userId: "test-user-id" },
      body: JSON.stringify({
        firstName: "Jane",
        location: "America/Los_Angeles",
      }),
    } as unknown as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body!);
    expect(body.firstName).toBe("Jane");
    expect(body.location).toBe("America/Los_Angeles");

    // Verify DynamoDB was called
    expect(ddbMock.calls()).toHaveLength(1);

    // Verify schedule was updated
    expect(scheduleService.createOrUpdateEventSchedule).toHaveBeenCalledWith(updatedUser);
  });

  it("should return 400 when userId is missing from path", async () => {
    const event = {
      pathParameters: {},
      body: JSON.stringify({ firstName: "Jane" }),
    } as unknown as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body!);
    expect(body.message).toBe("Missing userId in path");
  });

  it("should return 400 when request body is missing", async () => {
    const event = {
      pathParameters: { userId: "test-user-id" },
    } as unknown as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(400);
    expect(result.body).toBe("Error: Missing request body");
  });

  it("should return 400 when birthday format is invalid", async () => {
    const event = {
      pathParameters: { userId: "test-user-id" },
      body: JSON.stringify({
        birthday: "invalid-date",
      }),
    } as unknown as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body!);
    expect(body.message).toBe("Invalid user data");
    expect(body.errors).toBeDefined();
  });

  it("should update updatedAt timestamp even when no other fields are provided", async () => {
    const updatedUser = {
      userId: "test-user-id",
      firstName: "John",
      lastName: "Doe",
      birthday: "1990-05-15",
      location: "America/New_York",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: expect.any(String),
    };

    ddbMock.on(UpdateCommand).resolves({ Attributes: updatedUser });

    const event = {
      pathParameters: { userId: "test-user-id" },
      body: JSON.stringify({}),
    } as unknown as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body!);
    expect(body.updatedAt).toBeDefined();
  });

  it("should update only specified fields", async () => {
    const updatedUser = {
      userId: "test-user-id",
      firstName: "John",
      lastName: "Doe",
      birthday: "1990-06-20",
      location: "America/New_York",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: expect.any(String),
    };

    ddbMock.on(UpdateCommand).resolves({ Attributes: updatedUser });

    const event = {
      pathParameters: { userId: "test-user-id" },
      body: JSON.stringify({
        birthday: "1990-06-20",
      }),
    } as unknown as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body!);
    expect(body.birthday).toBe("1990-06-20");
  });

  it("should handle DynamoDB errors gracefully", async () => {
    ddbMock.on(UpdateCommand).rejects(new Error("DynamoDB error"));

    const event = {
      pathParameters: { userId: "test-user-id" },
      body: JSON.stringify({
        firstName: "Jane",
      }),
    } as unknown as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body!);
    expect(body.message).toBe("Internal Server Error");
  });

  it("should handle schedule service errors gracefully", async () => {
    const updatedUser = {
      userId: "test-user-id",
      firstName: "Jane",
      lastName: "Doe",
      birthday: "1990-05-15",
      location: "America/New_York",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: expect.any(String),
    };

    ddbMock.on(UpdateCommand).resolves({ Attributes: updatedUser });
    (scheduleService.createOrUpdateEventSchedule as jest.Mock).mockRejectedValue(
      new Error("Scheduler error")
    );

    const event = {
      pathParameters: { userId: "test-user-id" },
      body: JSON.stringify({
        firstName: "Jane",
      }),
    } as unknown as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body!);
    expect(body.message).toBe("Internal Server Error");
  });
});
