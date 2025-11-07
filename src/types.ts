import { z } from "zod";

export const UserSchema = z.object({
  userId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // 'YYYY-MM-DD'
  location: z.string(), // e.g., 'America/New_York'
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export const CreateUserPayloadSchema = UserSchema.omit({
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type User = z.infer<typeof UserSchema>;
export type CreateUserPayload = z.infer<typeof CreateUserPayloadSchema>;

export const UpdateUserPayloadSchema = CreateUserPayloadSchema.partial();

export type UpdateUserPayload = z.infer<typeof UpdateUserPayloadSchema>;
