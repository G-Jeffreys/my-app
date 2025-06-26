// TTL Presets configuration - values in milliseconds for internal use
export const TTL_PRESETS = {
  '30s': 30 * 1000,
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
} as const;

export type TtlPreset = keyof typeof TTL_PRESETS;

// Human-readable display names for TTL presets
export const TTL_PRESET_DISPLAY: Record<TtlPreset, string> = {
  '30s': '30 seconds',
  '1m': '1 minute',
  '5m': '5 minutes',
  '1h': '1 hour',
  '6h': '6 hours',
  '24h': '24 hours',
};

// Ordered list of TTL presets for UI selection (shortest to longest)
export const TTL_PRESET_OPTIONS: TtlPreset[] = ['30s', '1m', '5m', '1h', '6h', '24h'];

// Default TTL preset for new users
export const DEFAULT_TTL_PRESET: TtlPreset = '1h';

// Validation function for TTL presets
export const isValidTtlPreset = (preset: string): preset is TtlPreset => {
  return preset in TTL_PRESETS;
};

// Convert TTL preset to seconds (for countdown logic)
export const ttlPresetToSeconds = (preset: TtlPreset): number => {
  return TTL_PRESETS[preset] / 1000;
};

// Group chat configuration
export const GROUP_CHAT_LIMITS = {
  MAX_PARTICIPANTS: 5, // Maximum number of people in a group chat
  MIN_PARTICIPANTS: 1, // Minimum number (excluding creator) - so 2 total people
  MAX_NAME_LENGTH: 50, // Maximum characters in group name
} as const;

// Message limits
export const MESSAGE_LIMITS = {
  MAX_TEXT_LENGTH: 1000, // Maximum characters in text message
  MAX_VIDEO_DURATION_SECONDS: 10, // Maximum video length as per PRD
  MAX_FILE_SIZE_MB: 50, // Maximum file size for media
} as const;

// Future LLM configuration (scaffolding)
export const LLM_CONFIG = {
  MAX_SUMMARY_TOKENS: 30, // As per PRD FR-5
  BATCH_SIZE_FOR_RAG: 20, // Chunk every ~20 messages for RAG
  SUMMARY_GENERATION_TIMEOUT_MS: 5000, // 5s as per PRD
} as const; 