import { z } from "zod";

export const vpsSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  tunnelId: z.string().min(8, "Tunnel ID inválido"),
  notes: z.string().optional()
});

export const domainSchema = z.object({
  hostname: z.string().regex(/^[a-z0-9.-]+\.[a-z.]+$/, "Hostname inválido"),
  type: z.enum(["apex", "www", "custom"]).default("apex"),
  vpsId: z.string().uuid().optional(),
  tunnelId: z.string().optional(),
  active: z.boolean().default(true),
});

export const moveSchema = z.object({
  toVpsId: z.string().uuid({ message: "Escolha uma VPS" }),
  reason: z.string().max(200).optional(),
  checkFirst: z.boolean().default(true)
});