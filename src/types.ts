/** A JSON-compatible value. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Text, a JSON object or array; instructions and criteria also accept `null`. */
export type EntryType = string | { [key: string]: JsonValue } | JsonValue[] | null;

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

/** A criterion description; `null` leaves the label undescribed. */
export type Description = EntryType;

/** A yes/no question with optional descriptions for either outcome. */
export interface NoulQuestion {
  type: "noul";
  /** The question as text, a JSON object, or an array; optional or `null`. */
  instructions?: EntryType;
  /** Optional descriptions of the yes and no outcomes. */
  criteria?: {
    /** Description of the yes outcome. */
    true?: EntryType;
    /** Description of the no outcome. */
    false?: EntryType;
  } | null;
}

/** Labels mapped to descriptions, or `null` for undescribed labels. */
export type ChoiceCriteria = {
  [label: string]: Description;
};

/** A question that selects between named alternatives. */
export interface ChoiceQuestion<T extends ChoiceCriteria = ChoiceCriteria> {
  type: "choice";
  /** The question as text, a JSON object, or an array; optional or `null`. */
  instructions?: EntryType;
  /** Descriptions of the available outcomes. */
  criteria: T;
}

/** At least two descriptions indexed by score from zero; `null` leaves a score undescribed. */
export type ScoreCriteria = readonly [EntryType, EntryType, ...EntryType[]];

/** A question that assigns a score using an ordered rubric. */
export interface ScoreQuestion<T extends ScoreCriteria = ScoreCriteria> {
  type: "score";
  /** The question as text, a JSON object, or an array; optional or `null`. */
  instructions?: EntryType;
  /** Descriptions of the available outcomes. */
  criteria: T;
}

/** A question identified by its `type` field. */
export type Question = NoulQuestion | ScoreQuestion | ChoiceQuestion;

/** Questions keyed by the names used to identify their answers. */
export interface Questions {
  [name: string]: Question;
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/** Reasoning metadata present only on answers that used thinking. */
export interface ThinkingMetadata<T> {
  readonly tokens: number;
  readonly closed: boolean;
  readonly onepass: Omit<T, "thinking">;
}

/** A yes/no answer. */
export interface NoulResponse {
  readonly type: "noul";
  readonly thinking?: ThinkingMetadata<NoulResponse>;
  /** Probability of a yes answer, from zero to one. */
  readonly noul: number;
}

/** A selected label and its probabilities. */
export interface ChoiceResponse<T extends ChoiceCriteria = ChoiceCriteria> {
  readonly type: "choice";
  readonly thinking?: ThinkingMetadata<ChoiceResponse<T>>;
  /** The selected label. */
  readonly choice: keyof T & string;
  /** Reported confidence in the selected label. */
  readonly confidence: number;
  /** Probabilities keyed by label. */
  readonly probabilities: {
    readonly [label in keyof T]: number;
  };
}

/** Score keys inferred from the rubric; a fixed-length tuple yields its indices, otherwise `number`. */
export type ScoreOf<T extends ScoreCriteria> = number extends T["length"]
  ? number
  : Extract<keyof T, `${number}`>;

/** Rubric descriptions keyed by score. */
export type ScoreLegend<T extends ScoreCriteria> = {
  readonly [score in ScoreOf<T>]:
    | Exclude<T[score], null>
    | (null extends T[score] ? `${score}` : never);
};

/** An expected score with its rubric and probabilities. */
export interface ScoreResponse<T extends ScoreCriteria = ScoreCriteria> {
  readonly type: "score";
  readonly thinking?: ThinkingMetadata<ScoreResponse<T>>;
  /** Expected score, which may fall between integer rubric levels. */
  readonly score: number;
  /** Reported confidence in the score. */
  readonly confidence: number;
  /** Rubric descriptions keyed by score. */
  readonly legend: ScoreLegend<T>;
  /** Probabilities keyed by score. */
  readonly probabilities: {
    readonly [score in ScoreOf<T>]: number;
  };
}

/** The answer type for a question, preserving its criteria keys. */
export type ResultFor<T extends Question> = T extends NoulQuestion
  ? NoulResponse
  : T extends ScoreQuestion<infer S>
    ? ScoreResponse<S>
    : T extends ChoiceQuestion<infer E>
      ? ChoiceResponse<E>
      : never;

/** Token usage for a request. */
export interface Usage {
  /** Reasoning tokens, when thinking is requested. */
  readonly reasoning_tokens?: number;
  /** Cost reported by the API. */
  readonly cost?: number;
  /** Number of input tokens used. */
  readonly input_tokens: number;
  /** Number of output tokens used. */
  readonly output_tokens: number;
}

/** Answers keyed by question name, with model and usage metadata. */
export interface DecisionsResult<Q extends Questions> {
  readonly id?: string;
  readonly provider?: string;
  /** The model used to answer the request. */
  readonly model: string;
  /** Answers with types inferred from the supplied questions. */
  readonly answers: { readonly [K in keyof Q]: ResultFor<Q[K]> };
  /** Token usage for the request. */
  readonly usage: Usage;
}

/** Metadata for an available model. */
export interface ModelCard {
  readonly id: string;
  readonly object: "model";
  readonly created: number;
  readonly owned_by: string;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** A data URL string, or an object containing one. */
export type ImageInput = string | { url: string };

/**
 * State and named questions for `decide`.
 *
 * Additional properties on a request variable are forwarded, including `null` values.
 */
export interface DecisionsRequest<Q extends Questions = Questions> {
  /** Optional image data URLs attached to the shared state. */
  images?: readonly ImageInput[];
  /** Request reasoning for uncertain text decisions. Cannot be combined with images. */
  thinking?: boolean;
  /** Text, a JSON object or array to evaluate. */
  state: Exclude<EntryType, null>;
  /** Nonempty questions keyed by the names used to identify their answers. */
  questions: Q;
  /** Model override; omitted values inherit `defaultModel`. */
  model?: string;
}

/** Request body for `POST /v1/decisions`, with the model resolved. */
export interface DecisionsRequestPayload extends DecisionsRequest {
  model: string;
}

/** Retry configuration. Partial overrides inherit unset fields from the client or SDK defaults. */
export interface RetryPolicy {
  /** Maximum retries after the initial attempt; `0` disables retries. Default: 2. */
  readonly maxRetries: number;
  /** First backoff delay in milliseconds, doubled up to `backoffMaxMs`. Default: 500. */
  readonly backoffInitialMs: number;
  /** Maximum backoff delay in milliseconds. Default: 5000. */
  readonly backoffMaxMs: number;
  /** Fraction of each backoff delay randomly subtracted, from 0 to 1. Default: 0.25. */
  readonly backoffJitter: number;
  /** HTTP status codes to retry. Default: 408, 429, and 500–599. */
  readonly httpStatuses: ReadonlySet<number>;
  /** Honor `Retry-After` and `retry-after-ms` up to `maxRetryAfterMs`. Default: true. */
  readonly respectRetryAfter: boolean;
  /** Maximum server retry delay in milliseconds; longer delays use backoff. Default: 60000. */
  readonly maxRetryAfterMs: number;
  /** Retry connection failures, including interrupted response bodies (`APIConnectionError`). Default: true. */
  readonly apiConnectionError: boolean;
  /** Whether to retry `APITimeoutError`. Default: true. */
  readonly apiTimeoutError: boolean;
}

/** Per-call options that override client settings. */
export interface RequestOptions {
  /** Cancellation signal for the request and pending retries. */
  signal?: AbortSignal;
  /** Timeout per attempt in milliseconds; there is no total retry budget. */
  timeout?: number;
  /** Retry overrides for this call; omitted fields inherit client settings. */
  retry?: Partial<RetryPolicy>;
  /** Additional headers, merged over `defaultHeaders`. */
  headers?: Record<string, string>;
}

/** HTTP fetch implementation compatible with the global `fetch`. */
export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Log verbosity; `off` disables logging. */
export type LogLevel = "debug" | "info" | "warn" | "error" | "off";

/** Log methods accepting a message and structured values; compatible with `console`. */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/** Client options. Explicit values take precedence over environment variables, then SDK defaults. */
export interface RuneClientConfig {
  /** Required API key; falls back to `RUNE_API_KEY`. */
  apiKey?: string;
  /** API root; falls back to `RUNE_BASE_URL`, then `https://rune.surogate.ai`. */
  baseURL?: string;
  /** Default model; falls back to `RUNE_DEFAULT_MODEL`, then `rune-v3`. */
  defaultModel?: string;
  /**
   * Log level; falls back to `RUNE_LOG_LEVEL`, then `warn`.
   * `info` logs request summaries; `debug` adds headers and bodies.
   * Known credential headers are redacted; bodies are not.
   */
  logLevel?: LogLevel;
  /** Logger filtered to `logLevel` and above. Default: prefixed `console`. */
  logger?: Logger;
  /** Retry overrides; omitted fields use the defaults in `RetryPolicy`. */
  retry?: Partial<RetryPolicy>;
  /** Timeout per attempt in milliseconds, without a total retry budget. Default: 120000. */
  timeout?: number;
  /** Additional request headers; per-call headers take precedence. */
  defaultHeaders?: Record<string, string>;
  /** Allow browser use, exposing the API key to page users. Default: false. */
  dangerouslyAllowBrowser?: boolean;
  /** Custom HTTP fetch implementation for transport configuration or tests. Default: global `fetch`. */
  fetch?: Fetch;
}
