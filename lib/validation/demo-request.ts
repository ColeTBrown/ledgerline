import { z } from "zod";

export const FIRM_TYPES = [
  "Investment bank",
  "Asset manager",
  "Wealth / RIA",
  "Hedge fund",
  "Corporate finance team",
  "Other",
] as const;

/** Demo-request form schema, shared by the client form and the API route. */
export const demoRequestSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.email("Enter a valid work email.").max(200),
  firm: z.string().trim().min(2, "Enter your firm name.").max(160),
  firmType: z.enum(FIRM_TYPES, { message: "Select a firm type." }),
  seats: z.coerce.number().int().min(1, "At least 1 seat.").max(100000).optional(),
  message: z.string().trim().max(2000).optional(),
});

export type DemoRequest = z.infer<typeof demoRequestSchema>;
