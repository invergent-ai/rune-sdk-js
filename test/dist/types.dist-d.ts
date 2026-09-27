import { describe, expectTypeOf, it } from "vitest";
// Resolves to dist/index.d.mts: this checks the *emitted* declarations, not the sources.
import { choice, noul, type RuneClient, score } from "../../dist/index.mjs";

declare const client: RuneClient;

describe("emitted declarations", () => {
  it("preserve literal inference through the bundle", async () => {
    const { answers } = await client.decide({
      state: { nested: null },
      images: ["data:image/png;base64,aW1hZ2U=", { url: "data:image/png;base64,aW1hZ2U=" }],
      thinking: false,
      questions: {
        a: noul(null),
        b: choice(null, { yes: null, no: null }),
        c: score(null, [null, "high"]),
        d: { type: "noul" },
      },
    });
    expectTypeOf(answers.a.noul).toEqualTypeOf<number>();
    expectTypeOf(answers.b.choice).toEqualTypeOf<"yes" | "no">();
    expectTypeOf(answers.b.probabilities).toEqualTypeOf<{
      readonly yes: number;
      readonly no: number;
    }>();
    expectTypeOf(answers.c.legend).toEqualTypeOf<{ readonly 0: "0"; readonly 1: "high" }>();
    expectTypeOf(answers.d.noul).toEqualTypeOf<number>();
    expectTypeOf(answers.a.thinking?.onepass.noul).toEqualTypeOf<number | undefined>();
    expectTypeOf(answers.b.thinking?.onepass.choice).toEqualTypeOf<"yes" | "no" | undefined>();
    expectTypeOf(answers.c.thinking?.onepass.legend).toEqualTypeOf<
      { readonly 0: "0"; readonly 1: "high" } | undefined
    >();
    expectTypeOf(answers.b.thinking?.tokens).toEqualTypeOf<number | undefined>();
    expectTypeOf(answers.b.thinking?.closed).toEqualTypeOf<boolean | undefined>();
    // @ts-expect-error unknown label
    answers.b.probabilities.maybe;
  });
});
