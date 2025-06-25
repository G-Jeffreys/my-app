import { z } from "zod";

const envSchema = z.object({
  FB_API_KEY: z.string(),
  FB_AUTH_DOMAIN: z.string(),
  FB_PROJECT_ID: z.string(),
  FB_APP_ID: z.string(),
  GOOGLE_IOS_CLIENT_ID: z.string(),
  FB_DATABASE_URL: z.string(),
});

export const env = envSchema.parse({
  FB_API_KEY: process.env.EXPO_PUBLIC_FB_API_KEY,
  FB_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FB_AUTH_DOMAIN,
  FB_PROJECT_ID: process.env.EXPO_PUBLIC_FB_PROJECT_ID,
  FB_APP_ID: process.env.EXPO_PUBLIC_FB_APP_ID,
  GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  FB_DATABASE_URL: process.env.EXPO_PUBLIC_FB_DATABASE_URL,
});