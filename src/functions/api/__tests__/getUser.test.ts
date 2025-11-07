import { APIGatewayProxyEventV2 } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { handler } from "../getUser";
import { createMockContext, asApiGatewayResult } from "../../../testUtils";

// Mock the DynamoDB client
const ddbMock = mockClient(DynamoDBDocumentClient);

describe("getUser handler", () => {
  beforeEach(() => {
    // Reset mocks before each test
    ddbMock.reset();

    // Set environment variables
    process.env.USERS_TABLE_NAME = "test-users-table";
  });

  afterEach(() => {
    delete process.env.USERS_TABLE_NAME;
  });

  it("should retrieve a user successfully", async () => {
    const mockUser = {
      userId: "test-user-id",
      firstName: "John",
      lastName: "Doe",
      birthday: "1990-05-15",
      location: "America/New_York",
      createdAt: "2025-01-01T00:00:00.000Z",
    };

    ddbMock.on(GetCommand).resolves({ Item: mockUser });

    const event = {
      pathParameters: { userId: "test-user-id" },
    } as unknown as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body!);
    expect(body).toEqual(mockUser);

    // Verify DynamoDB was called with correct parameters
    expect(ddbMock.calls()).toHaveLength(1);
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

  it("should return 404 when user is not found", async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });

    const event = {
      pathParameters: { userId: "non-existent-user" },
    } as unknown as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(404);

    const body = JSON.parse(result.body!);
    expect(body.message).toBe("User not found");
  });

  it("should handle DynamoDB errors gracefully", async () => {
    ddbMock.on(GetCommand).rejects(new Error("DynamoDB error"));

    const event = {
      pathParameters: { userId: "test-user-id" },
    } as unknown as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body!);
    expect(body.message).toBe("Internal Server Error");
  });

  it("should return user with all fields intact", async () => {
    const mockUser = {
      userId: "test-user-id",
      firstName: "Jane",
      lastName: "Smith",
      birthday: "1985-12-25",
      location: "Europe/London",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-06-15T10:30:00.000Z",
    };

    ddbMock.on(GetCommand).resolves({ Item: mockUser });

    const event = {
      pathParameters: { userId: "test-user-id" },
    } as unknown as APIGatewayProxyEventV2;

    const result = asApiGatewayResult(await handler(event, createMockContext(), () => {}));

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body!);
    expect(body.userId).toBe("test-user-id");
    expect(body.firstName).toBe("Jane");
    expect(body.lastName).toBe("Smith");
    expect(body.birthday).toBe("1985-12-25");
    expect(body.location).toBe("Europe/London");
    expect(body.createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect(body.updatedAt).toBe("2024-06-15T10:30:00.000Z");
  });
});
