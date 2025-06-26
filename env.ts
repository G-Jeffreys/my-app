import { z } from "zod";

const envSchema = z.object({
  FB_API_KEY: z.string(),
  FB_AUTH_DOMAIN: z.string(),
  FB_PROJECT_ID: z.string(),
  FB_APP_ID: z.string(),
  FB_DATABASE_URL: z.string().optional(),
  FB_STORAGE_BUCKET: z.string().optional(),
  FB_MESSAGING_SENDER_ID: z.string().optional(),
  FB_MEASUREMENT_ID: z.string().optional(),
  GOOGLE_IOS_CLIENT_ID: z.string(),
  GOOGLE_ANDROID_CLIENT_ID: z.string(),
  EXPO_CLIENT_ID: z.string(),
});

export const env = envSchema.parse({
  FB_API_KEY: process.env.EXPO_PUBLIC_FB_API_KEY,
  FB_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FB_AUTH_DOMAIN,
  FB_PROJECT_ID: process.env.EXPO_PUBLIC_FB_PROJECT_ID,
  FB_APP_ID: process.env.EXPO_PUBLIC_FB_APP_ID,
  FB_DATABASE_URL: process.env.EXPO_PUBLIC_FB_DATABASE_URL,
  FB_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FB_STORAGE_BUCKET,
  FB_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FB_MESSAGING_SENDER_ID,
  FB_MEASUREMENT_ID: process.env.EXPO_PUBLIC_FB_MEASUREMENT_ID,
  GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  EXPO_CLIENT_ID: process.env.EXPO_PUBLIC_EXPO_CLIENT_ID,
});