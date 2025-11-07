import { mockClient } from "aws-sdk-client-mock";
import {
  SchedulerClient,
  CreateScheduleCommand,
  UpdateScheduleCommand,
  DeleteScheduleCommand,
} from "@aws-sdk/client-scheduler";
import {
  createOrUpdateEventSchedule,
  deleteBirthdaySchedule,
} from "../scheduleService";
import * as timeLib from "../../lib/time";
import { User } from "../../types";

// Mock the SchedulerClient
const schedulerMock = mockClient(SchedulerClient);

// Mock the time library
jest.mock("../../lib/time");

describe("scheduleService", () => {
  const mockUser: User = {
    userId: "test-user-123",
    firstName: "John",
    lastName: "Doe",
    birthday: "1990-05-15",
    location: "America/New_York",
    createdAt: "2025-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    // Reset mocks before each test
    schedulerMock.reset();
    jest.clearAllMocks();

    // Set required environment variables
    process.env.EVENT_QUEUE_ARN = "arn:aws:sqs:us-east-1:123456789012:test-queue";
    process.env.SCHEDULER_ROLE_ARN = "arn:aws:iam::123456789012:role/test-role";
    process.env.IS_OFFLINE = "false";

    // Mock getNextBirthday9AmUtc to return a fixed date
    (timeLib.getNextBirthday9AmUtc as jest.Mock).mockReturnValue(
      new Date("2025-05-15T13:00:00.000Z") // 9 AM EDT = 1 PM UTC
    );
  });

  afterEach(() => {
    delete process.env.EVENT_QUEUE_ARN;
    delete process.env.SCHEDULER_ROLE_ARN;
    delete process.env.IS_OFFLINE;
  });

  describe("createOrUpdateEventSchedule", () => {
    it("should create a new schedule successfully", async () => {
      schedulerMock.on(CreateScheduleCommand).resolves({});

      await createOrUpdateEventSchedule(mockUser);

      // Verify CreateScheduleCommand was called
      const calls = schedulerMock.commandCalls(CreateScheduleCommand);
      expect(calls.length).toBe(1);

      // Verify the command has correct parameters
      const commandInput = calls[0].args[0].input;
      expect(commandInput.Name).toBe("event-user-test-user-123");
      expect(commandInput.ScheduleExpression).toBe("at(2025-05-15T13:00:00)");
      expect(commandInput.Target).toBeDefined();

      // Verify ActionAfterCompletion is set to DELETE
      expect(commandInput.ActionAfterCompletion).toBe("DELETE");
    });

    it("should update an existing schedule when ConflictException occurs", async () => {
      // First call (create) throws ConflictException
      const conflictError = new Error("Schedule already exists");
      conflictError.name = "ConflictException";
      schedulerMock.on(CreateScheduleCommand).rejects(conflictError);

      // Second call (update) succeeds
      schedulerMock.on(UpdateScheduleCommand).resolves({});

      await createOrUpdateEventSchedule(mockUser);

      // Verify CreateScheduleCommand was called first
      expect(schedulerMock.commandCalls(CreateScheduleCommand).length).toBe(1);

      // Verify UpdateScheduleCommand was called after conflict
      const updateCalls = schedulerMock.commandCalls(UpdateScheduleCommand);
      expect(updateCalls.length).toBe(1);

      // Verify the update command has correct parameters
      const commandInput = updateCalls[0].args[0].input;
      expect(commandInput.Name).toBe("event-user-test-user-123");
      expect(commandInput.ScheduleExpression).toBe("at(2025-05-15T13:00:00)");
    });

    it("should skip schedule creation in offline mode", async () => {
      process.env.IS_OFFLINE = "true";

      // Re-import the module to pick up the new IS_OFFLINE value
      jest.resetModules();
      const { createOrUpdateEventSchedule: offlineCreate } = require("../scheduleService");

      await offlineCreate(mockUser);

      // Verify no scheduler commands were called
      expect(schedulerMock.commandCalls(CreateScheduleCommand).length).toBe(0);
      expect(schedulerMock.commandCalls(UpdateScheduleCommand).length).toBe(0);
    });

    it("should throw error when scheduler fails with non-ConflictException", async () => {
      const genericError = new Error("Service unavailable");
      genericError.name = "ServiceUnavailableException";
      schedulerMock.on(CreateScheduleCommand).rejects(genericError);

      await expect(createOrUpdateEventSchedule(mockUser)).rejects.toThrow(
        "Service unavailable"
      );
    });

    it("should calculate correct schedule expression based on user timezone", async () => {
      // Mock a different birthday time
      (timeLib.getNextBirthday9AmUtc as jest.Mock).mockReturnValue(
        new Date("2025-12-25T14:00:00.000Z") // 9 AM EST = 2 PM UTC
      );

      schedulerMock.on(CreateScheduleCommand).resolves({});

      const christmasUser: User = {
        ...mockUser,
        birthday: "1990-12-25",
      };

      await createOrUpdateEventSchedule(christmasUser);

      const calls = schedulerMock.commandCalls(CreateScheduleCommand);
      const commandInput = calls[0].args[0].input;

      // Verify the schedule expression uses the correct UTC time
      expect(commandInput.ScheduleExpression).toBe("at(2025-12-25T14:00:00)");
    });
  });

  describe("deleteBirthdaySchedule", () => {
    it("should delete a schedule successfully", async () => {
      schedulerMock.on(DeleteScheduleCommand).resolves({});

      await deleteBirthdaySchedule("test-user-123");

      // Verify DeleteScheduleCommand was called
      const calls = schedulerMock.commandCalls(DeleteScheduleCommand);
      expect(calls.length).toBe(1);

      // Verify the command has correct schedule name
      const commandInput = calls[0].args[0].input;
      expect(commandInput.Name).toBe("event-user-test-user-123");
    });

    it("should handle ResourceNotFoundException gracefully (schedule doesn't exist)", async () => {
      const notFoundError = new Error("Schedule not found");
      notFoundError.name = "ResourceNotFoundException";
      schedulerMock.on(DeleteScheduleCommand).rejects(notFoundError);

      // Should not throw error
      await expect(deleteBirthdaySchedule("test-user-123")).resolves.not.toThrow();

      // Verify DeleteScheduleCommand was called
      expect(schedulerMock.commandCalls(DeleteScheduleCommand).length).toBe(1);
    });

    it("should skip schedule deletion in offline mode", async () => {
      process.env.IS_OFFLINE = "true";

      // Re-import the module to pick up the new IS_OFFLINE value
      jest.resetModules();
      const { deleteBirthdaySchedule: offlineDelete } = require("../scheduleService");

      await offlineDelete("test-user-123");

      // Verify no scheduler commands were called
      expect(schedulerMock.commandCalls(DeleteScheduleCommand).length).toBe(0);
    });

    it("should throw error when deletion fails with non-ResourceNotFoundException", async () => {
      const genericError = new Error("Service unavailable");
      genericError.name = "ServiceUnavailableException";
      schedulerMock.on(DeleteScheduleCommand).rejects(genericError);

      await expect(deleteBirthdaySchedule("test-user-123")).rejects.toThrow(
        "Service unavailable"
      );
    });

    it("should use correct schedule naming convention", async () => {
      schedulerMock.on(DeleteScheduleCommand).resolves({});

      await deleteBirthdaySchedule("user-abc-xyz-789");

      const calls = schedulerMock.commandCalls(DeleteScheduleCommand);
      const commandInput = calls[0].args[0].input;

      // Verify the naming pattern event-user-{userId}
      expect(commandInput.Name).toBe("event-user-user-abc-xyz-789");
    });
  });
});
