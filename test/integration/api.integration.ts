import { describe, expect, it } from "vitest";
import {
  type APIError,
  AuthenticationError,
  BadRequestError,
  choice,
  ENV,
  NotFoundError,
  noul,
  RuneClient,
  RuneError,
  score,
} from "../../src";

/** Live API tests with raw response output; skipped unless `RUNE_API_KEY` is set. */
const describeLive = process.env[ENV.apiKey] ? describe : describe.skip;

const show = (label: string, value: unknown): void => {
  console.log(`\n--- ${label} ---\n${JSON.stringify(value, null, 2)}`);
};

const sum = (values: Record<string, number>): number =>
  Object.values(values).reduce((a, b) => a + b, 0);

describeLive("live API", () => {
  const client = new RuneClient({
    apiKey: process.env[ENV.apiKey] ?? "integration-tests-skipped",
    logLevel: "info",
    timeout: 120_000,
  });

  const ticket = {
    subject: "Charged twice this month",
    body: "I see two charges of $49 on my card for August. I only have one account. Please fix this ASAP.",
  };

  it("lists models", async () => {
    const { data: models, requestId } = await client.models.list().withResponse();
    show("GET /v1/models", { requestId, count: models.length, first: models[0] });
    if (requestId !== undefined) expect(typeof requestId).toBe("string");

    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
    for (const m of models) {
      expect(typeof m.id).toBe("string");
      expect(typeof m.owned_by).toBe("string");
      expect(typeof m.created).toBe("number");
    }
  });

  it("answers noul, choice, and score-as-list questions", async () => {
    const { data, requestId } = await client
      .decide({
        state: ticket,
        questions: {
          isBilling: noul("Is this ticket about billing?"),
          sentiment: choice("What is the customer's tone?", {
            calm: null,
            frustrated: null,
            angry: null,
          }),
          urgency: score("How urgent is this ticket?", ["can wait", "this week", "today"]),
        },
      })
      .withResponse();
    show("POST /v1/decisions", { requestId, data });

    expect(typeof data.model).toBe("string");
    expect(data.usage.input_tokens).toBeGreaterThan(0);
    expect(data.usage.output_tokens).toBeGreaterThanOrEqual(0);

    const { isBilling, sentiment, urgency } = data.answers;
    expect(isBilling.type).toBe("noul");
    expect(isBilling.noul).toBeGreaterThanOrEqual(0);
    expect(isBilling.noul).toBeLessThanOrEqual(1);

    expect(sentiment.type).toBe("choice");
    expect(["angry", "calm", "frustrated"]).toContain(sentiment.choice);
    expect(Object.keys(sentiment.probabilities).sort()).toEqual(["angry", "calm", "frustrated"]);
    expect(sum(sentiment.probabilities)).toBeCloseTo(1, 1);
    expect(sentiment.confidence).toBeGreaterThanOrEqual(0);

    expect(urgency.type).toBe("score");
    expect(urgency.score).toBeGreaterThanOrEqual(0);
    expect(urgency.score).toBeLessThanOrEqual(2);
    expect(urgency.legend).toEqual({ 0: "can wait", 1: "this week", 2: "today" });
    expect(Object.keys(urgency.probabilities).sort()).toEqual(["0", "1", "2"]);
    expect(sum(urgency.probabilities)).toBeCloseTo(1, 1);
  });

  it("accepts rich descriptions and one-sided noul criteria", async () => {
    const data = await client.decide({
      state: ticket,
      questions: {
        duplicate: noul("Is the customer reporting a duplicate charge?", {
          true: { meaning: "the same amount charged more than once", examples: ["billed twice"] },
        }),
        tone: choice("Tone?", {
          calm: { summary: "measured", examples: ["please look into this"] },
          upset: null,
        }),
      },
    });
    show("rich descriptions", data.answers);
    expect(data.answers.duplicate.noul).toBeGreaterThanOrEqual(0);
    expect(Object.keys(data.answers.tone.probabilities).sort()).toEqual(["calm", "upset"]);
  });

  it("rejects a bad API key with AuthenticationError", async () => {
    const bad = new RuneClient({
      apiKey: "not-a-real-key",
      logLevel: "off",
    });
    const err = await bad.models.list().catch((e: unknown) => e);
    show("bad key", { name: (err as Error).name, message: (err as Error).message });
    expect(err).toBeInstanceOf(AuthenticationError);
  });

  it("rejects an unknown model with a readable NotFoundError", async () => {
    const err = await client
      .decide({
        state: "hello",
        questions: { q: noul("Is this a greeting?") },
        model: "no-such-model",
      })
      .catch((e: unknown) => e);
    show("unknown model", { name: (err as Error).name, message: (err as Error).message });
    expect(err).toBeInstanceOf(NotFoundError);
    expect((err as APIError).status).toBe(404);
    expect((err as APIError).message).toMatch(/model/i);
  });

  it("surfaces server-side validation errors readably", async () => {
    // An empty choice vocabulary cannot produce a decision.
    const malformed = { q: choice("?", {}) };
    const err = await client.decide({ state: "x", questions: malformed }).catch((e: unknown) => e);
    show("400", { name: (err as Error).name, message: (err as Error).message });
    expect(err).toBeInstanceOf(BadRequestError);
    expect((err as APIError).status).toBe(400);
  });

  it("catches shapes the API would reject before sending", () => {
    expect(() => client.decide({ state: "x", questions: {} })).toThrow(RuneError);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed, as a JS caller might send
    const empty: any = [];
    expect(() => client.decide({ state: "x", questions: { q: score("?", empty) } })).toThrow(
      RuneError,
    );
  });
});
