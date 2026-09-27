/** Environment variable names for client configuration. Explicit options take precedence. */
export const ENV = {
  /** Required API key; used when `apiKey` is omitted. */
  apiKey: "RUNE_API_KEY",
  /** API root; defaults to `https://rune.surogate.ai`. */
  baseURL: "RUNE_BASE_URL",
  /** Default model name; defaults to `rune-v3`. */
  defaultModel: "RUNE_DEFAULT_MODEL",
  /** Log level; defaults to `warn`. */
  logLevel: "RUNE_LOG_LEVEL",
} as const;

export type EnvVar = (typeof ENV)[keyof typeof ENV];

/** Read a trimmed environment value, returning `undefined` for missing or blank values. */
export const readEnv = (name: EnvVar): string | undefined => {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[name]?.trim() || undefined;
};

/** Return the explicit value, falling back to the environment. */
export const fromCodeOrEnv = (fromCode: string | undefined, envVar: EnvVar): string | undefined =>
  fromCode ?? readEnv(envVar);
