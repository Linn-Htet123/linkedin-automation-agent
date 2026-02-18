import dotenv from "dotenv";
import { z } from "zod";
import path from "path";

dotenv.config();

const envSchema = z.object({
    LINKEDIN_EMAIL: z.string().email("Valid LinkedIn email is required"),
    LINKEDIN_PASSWORD: z.string().min(1, "LINKEDIN_PASSWORD is required"),
    PORT: z.string().default("3001"),
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    HEADLESS: z
        .string()
        .transform((v) => v === "true")
        .default("false"),
    BROWSER_SLOW_MO: z
        .string()
        .transform(Number)
        .default("50"),
    SESSION_DIR: z.string().default("./sessions"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    console.error("\n📋 Copy .env.example to .env and fill in your values.");
    process.exit(1);
}

export const config = {
    ...parsed.data,
    PORT: parseInt(parsed.data.PORT, 10),
    SESSION_DIR: path.resolve(parsed.data.SESSION_DIR),
} as const;

export type Config = typeof config;
