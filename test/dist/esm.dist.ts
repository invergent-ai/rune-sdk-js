import { describe, expect, it } from "vitest";
import * as sdk from "../../dist/index.mjs";
import { BASE_URL, cannedFetch, DECISIONS_BODY, EXPECTED_VALUE_EXPORTS, pkg } from "./helpers";

describe("dist/index.mjs (ESM build)", () => {
  it("exposes exactly the documented value exports", () => {
    expect(Object.keys(sdk).sort()).toEqual(EXPECTED_VALUE_EXPORTS);
  });

  it("reports the package.json version", () => {
    expect(sdk.VERSION).toBe(pkg.version);
  });

  it("makes a typed round trip through the bundle", async () => {
    const { fetch, calls } = cannedFetch(DECISIONS_BODY);
    const client = new sdk.RuneClient({
      apiKey: "k",
      baseURL: BASE_URL,
      fetch,
      retry: { maxRetries: 0 },
    });
    const { data, requestId } = await client
      .decide({
        state: "hi",
        questions: { ok: sdk.noul("ok?"), tone: sdk.choice("tone?", { warm: null, cold: null }) },
      })
      .withResponse();

    expect(requestId).toBe("req_dist");
    expect(data.answers.ok.noul).toBe(0.9);
    expect(data.answers.tone.choice).toBe("warm");
    expect(calls[0]?.url).toBe(`${BASE_URL}/v1/decisions`);
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers["X-Rune-SDK"]).toBe(`rune-sdk/${pkg.version}`);
  });

  it("throws the bundle's own error classes", async () => {
    const fetch = async () => new Response("{}", { status: 429, headers: { "retry-after": "1" } });
    const client = new sdk.RuneClient({
      apiKey: "k",
      baseURL: BASE_URL,
      fetch,
      retry: { maxRetries: 0 },
    });
    const err = await client.models.list().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(sdk.RateLimitError);
    expect(err).toBeInstanceOf(sdk.APIError);
    expect(err).toBeInstanceOf(sdk.RuneError);
    expect((err as sdk.RateLimitError).retryAfterMs).toBe(1000);
  });

  it("does not pull in Node built-ins", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("../../dist/index.mjs", import.meta.url), "utf8");
    expect(source).not.toMatch(/from\s+["']node:/);
    expect(source).not.toMatch(/require\(["']node:/);
  });
});
