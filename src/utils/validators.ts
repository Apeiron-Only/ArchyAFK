import { z } from "zod";

export const minecraftUsernameSchema = z
  .string()
  .trim()
  .min(3, "En az 3 karakter")
  .max(16, "En fazla 16 karakter")
  .regex(/^[A-Za-z0-9_]+$/, "Yalnızca harf, sayı ve alt çizgi");

export const tagSchema = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .regex(/^[A-Za-z0-9_-]+$/);

export const profileFormSchema = z.object({
  name: minecraftUsernameSchema,
  avatar: z.string().trim().max(4096).optional(),
  notes: z.string().max(2000),
  tags: z.string().max(512),
  groupName: z.string().trim().max(80).optional(),
  folder: z.string().trim().max(160).optional(),
  favorite: z.boolean()
});

export const serverFormSchema = z.object({
  name: z.string().trim().min(1, "Sunucu adı gerekli").max(80),
  address: z
    .string()
    .trim()
    .min(1, "Adres gerekli")
    .max(255)
    .regex(/^[A-Za-z0-9._-]+$/, "Geçersiz adres"),
  port: z.number().int().min(1).max(65535),
  favorite: z.boolean(),
  tags: z.string().max(512),
  notes: z.string().max(2000)
});

export const settingsSchema = z.object({
  language: z.literal("tr"),
  theme: z.literal("dark"),
  autoUpdate: z.boolean(),
  startup: z.boolean(),
  animations: z.boolean(),
  performanceMode: z.boolean(),
  developerMode: z.boolean(),
  logLevel: z.enum(["info", "debug", "warning", "error", "trace"]),
  automaticServerRefresh: z.boolean(),
  serverRefreshInterval: z.number().int().min(15).max(600)
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
export type ServerFormValues = z.infer<typeof serverFormSchema>;
export type SettingsFormValues = z.infer<typeof settingsSchema>;

export function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24))
    .filter(Boolean)
    .filter((tag, index, tags) => tags.indexOf(tag) === index)
    .slice(0, 16);
}

export function nullableText(value: string | undefined): string | null {
  const text = value?.trim() ?? "";
  return text.length > 0 ? text : null;
}
