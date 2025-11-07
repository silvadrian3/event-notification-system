import { APIGatewayProxyEventV2 } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { handler } from "../deleteUser";
import * as scheduleService from "../../../services/scheduleService";
import { createMockContext, asApiGatewayResult } from "../../../testUtils";

// Mock the DynamoDB client
const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock the schedule service
jest.mock("../../../services/scheduleService");

describe("deleteUser handler", () => {
  beforeEach(() => {
    // Reset mocks before each test
    ddbMock.reset();
    jest.clearAllMocks();

    // Set environment variables
    process.env.USERS_TABLE_NAME = "test-users-table";

    // Mock schedule service function
    (scheduleService.deleteBirthdaySchedule as jest.Mock) = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.USERS_TABLE_NAME;
  });

  it("should delete a user successfully", async () => {
    ddbMock.on(DeleteCommand).resolves({});

    const event = {
      pathParameters: { userId: "test-user-id" },
    } as unknown as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body!);
    expect(body.message).toBe("User deleted successfully");
    expect(body.userId).toBe("test-user-id");

    // Verify DynamoDB was called
    expect(ddbMock.calls()).toHaveLength(1);

    // Verify schedule was deleted
    expect(scheduleService.deleteBirthdaySchedule).toHaveBeenCalledWith("test-user-id");
  });

  it("should return 400 when userId is missing from path", async () => {
    const event = {
      pathParameters: {},
    } as unknown as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body!);
    expect(body.message).toBe("Missing userId in path");

    // Verify DynamoDB was not called
    expect(ddbMock.calls()).toHaveLength(0);
  });

  it("should handle DynamoDB errors gracefully", async () => {
    ddbMock.on(DeleteCommand).rejects(new Error("DynamoDB error"));

    const event = {
      pathParameters: { userId: "test-user-id" },
    } as unknown as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body!);
    expect(body.message).toBe("Internal Server Error");
  });

  it("should handle schedule service errors gracefully", async () => {
    ddbMock.on(DeleteCommand).resolves({});
    (scheduleService.deleteBirthdaySchedule as jest.Mock).mockRejectedValue(
      new Error("Scheduler error")
    );

    const event = {
      pathParameters: { userId: "test-user-id" },
    } as unknown as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body!);
    expect(body.message).toBe("Internal Server Error");
  });

  it("should delete user even if they don't exist (DynamoDB delete is idempotent)", async () => {
    // DynamoDB DeleteCommand doesn't throw error if item doesn't exist
    ddbMock.on(DeleteCommand).resolves({});

    const event = {
      pathParameters: { userId: "non-existent-user" },
    } as unknown as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body!);
    expect(body.message).toBe("User deleted successfully");
  });
});
