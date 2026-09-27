# Invergent Rune JavaScript / TypeScript SDK

Typed clients for the Rune decisions API, maintained by Invergent. The packaged SDK runs
on Node.js 20+ and provides ESM, CommonJS and TypeScript declarations.

## Install

Install from GitHub until a registry release is available. This builds the SDK, so use
Node.js 24.11+ for the installation:

```bash
npm install github:invergent-ai/rune-sdk-js
```

The package name is `@invergent-ai/rune-sdk`. Set `RUNE_API_KEY` in your server environment.

## Quickstart

```typescript
import { RuneClient, choice, noul, score } from "@invergent-ai/rune-sdk";

const client = new RuneClient();
const result = await client.decide({
  state: { message: "I was charged twice. Please help." },
  questions: {
    category: choice("What is this ticket about?", {
      billing: null,
      technical: null,
      other: null,
    }),
    refund: noul("Does the customer request a refund?"),
    urgency: score("How urgent is this request?", ["Low", "Medium", "High"]),
  },
});

console.log(result.answers.category.choice); // "billing" | "technical" | "other"
console.log(result.answers.refund.noul);
console.log(result.answers.urgency.score);
```

The default API root is `https://rune.surogate.ai`, the model is `rune-v3`, and `decide()`
sends `POST /v1/decisions`. Authentication uses `Authorization: Bearer`.
State can be text, a JSON object or an array. Choice and score questions need 2–255
options. Missing choice descriptions use their labels; Noul supplies `true` and `false`
automatically. Missing score descriptions use their level index, and omitted instructions
become empty strings. Nested JSON values are preserved; request inputs are not mutated.

## Images and thinking

Add `images: ["data:image/png;base64,..."]` to a decision request, or use
`images: [{ url: "data:image/png;base64,..." }]`. Encode your image bytes as base64 first;
remote image URLs are not supported.

```typescript
import { readFile } from "node:fs/promises";
import { RuneClient, noul } from "@invergent-ai/rune-sdk";

const image = await readFile("photo.png");
const client = new RuneClient();
const result = await client.decide({
  state: "Inspect the attached photo.",
  questions: { damaged: noul("Is the package visibly damaged?") },
  images: [`data:image/png;base64,${image.toString("base64")}`],
});
console.log(result.answers.damaged.noul);
```

Add `thinking: true` for reasoning on uncertain text decisions. When reasoning was used,
the answer includes `thinking.tokens`, `thinking.closed` and the typed `thinking.onepass`
answer. `result.usage.reasoning_tokens` reports reasoning usage. The current API does not
support combining images and thinking in one request.

```typescript
const result = await client.decide({
  state: "The package arrived late, but the customer says they can still use it.",
  questions: { refund: noul("Does the customer want a refund?") },
  thinking: true,
});
const answer = result.answers.refund;
if (answer.thinking) {
  console.log(answer.thinking.tokens, answer.thinking.onepass.noul);
}
```

Thinking is opt-in and may take longer. Answers that do not need reasoning omit the
`thinking` metadata.

## Models, configuration and errors

`await client.models.list()` returns model objects with `id`, `object`, `created` and
`owned_by`. Use a model's `id` as the request's `model` or the client's `defaultModel`.

Constructor options include `apiKey`, `baseURL`, `defaultModel`, `timeout` (milliseconds),
`retry`, `fetch`, `defaultHeaders` and logging controls. Environment variables are
`RUNE_API_KEY`, `RUNE_BASE_URL`, `RUNE_DEFAULT_MODEL` and `RUNE_LOG_LEVEL`; explicit options
win. The default timeout is 120,000 ms per attempt.

The SDK retries eligible connection failures, timeouts, HTTP 408, 429 and 5xx responses
up to twice and honors `Retry-After`. Use `retry: { maxRetries: 0 }` to disable retries.
Per-call options can override timeout/retries/headers and accept an `AbortSignal`:

```typescript
const controller = new AbortController();
const response = await client.decide(
  { state: "A happy customer", questions: { happy: noul("Is the customer happy?") } },
  { signal: controller.signal, timeout: 30_000 },
);
```

Catch `APIError` for HTTP failures or subclasses such as `AuthenticationError` and
`RateLimitError`. `RateLimitError.retryAfterMs` exposes the server retry delay.
Use `.withResponse()` for parsed data plus raw HTTP metadata or `.asResponse()` for the
raw `Response`. Keep API keys on your server; browser use is refused by default.
Debug logging includes bodies but redacts known credential headers.

## Development

Use Node.js 24.11+ to build from source. CI also tests the built package on Node.js 20.

```bash
npm ci
npm run check
```

Live tests are opt-in: set `RUNE_API_KEY`, then run `npm run test:integration`.
This is a fork of the MIT-licensed TypeSafe SDK. See [UPSTREAM.md](UPSTREAM.md) and [LICENSE](LICENSE).
