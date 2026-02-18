import { z } from "zod";
import { waybookDtoSchema, timelineDaySchema } from "./waybooks.js";

export const publicWaybookDtoSchema = z.object({
  waybook: waybookDtoSchema,
  days: z.array(timelineDaySchema)
});
export type PublicWaybookDTO = z.infer<typeof publicWaybookDtoSchema>;

export const visibilityPolicyDescription = {
  private: "Owner-authenticated only",
  link_only: "Requires a valid share token",
  public: "Anonymous slug-based read allowed"
} as const;

export type VisibilityPolicy = keyof typeof visibilityPolicyDescription;
