import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./common.js";
import { waybookMemberRoleSchema } from "./enums.js";

export const waybookMemberDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  userId: idSchema,
  role: waybookMemberRoleSchema,
  invitedBy: idSchema.nullable(),
  createdAt: isoDateTimeSchema,
  user: z.object({
    email: z.string().email().nullable(),
    name: z.string().nullable(),
    image: z.string().url().nullable()
  })
});
export type WaybookMemberDTO = z.infer<typeof waybookMemberDtoSchema>;

export const waybookInviteDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  email: z.string().email(),
  role: waybookMemberRoleSchema,
  invitedBy: idSchema,
  expiresAt: isoDateTimeSchema.nullable(),
  acceptedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema
});
export type WaybookInviteDTO = z.infer<typeof waybookInviteDtoSchema>;

export const listMembersResponseSchema = z.object({
  accessRole: waybookMemberRoleSchema,
  members: z.array(waybookMemberDtoSchema),
  invites: z.array(waybookInviteDtoSchema)
});
export type ListMembersResponse = z.infer<typeof listMembersResponseSchema>;

export const createInviteInputSchema = z.object({
  email: z.string().email(),
  role: z.enum(["editor", "viewer"]).default("editor"),
  expiresAt: isoDateTimeSchema.nullable().optional()
});
export type CreateInviteInput = z.infer<typeof createInviteInputSchema>;

export const createInviteResponseSchema = z.object({
  invite: waybookInviteDtoSchema,
  token: z.string().min(16),
  acceptUrl: z.string().url()
});
export type CreateInviteResponse = z.infer<typeof createInviteResponseSchema>;

export const acceptInviteResponseSchema = z.object({
  success: z.literal(true),
  waybookId: idSchema
});
export type AcceptInviteResponse = z.infer<typeof acceptInviteResponseSchema>;

export const updateMemberRoleInputSchema = z.object({
  role: z.enum(["editor", "viewer"])
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleInputSchema>;

export const pendingInviteDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  waybookTitle: z.string().min(1),
  role: waybookMemberRoleSchema,
  invitedBy: z.object({
    id: idSchema,
    name: z.string().nullable(),
    email: z.string().email().nullable()
  }),
  expiresAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema
});
export type PendingInviteDTO = z.infer<typeof pendingInviteDtoSchema>;

export const listPendingInvitesResponseSchema = z.object({
  items: z.array(pendingInviteDtoSchema)
});
export type ListPendingInvitesResponse = z.infer<typeof listPendingInvitesResponseSchema>;
