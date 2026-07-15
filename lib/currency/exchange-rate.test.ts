import { describe, expect, it } from "vitest";
import { EXCHANGE_RATE_REFRESH_MS, parseUsdToPkrRate } from "./exchange-rate";

describe("exchange rates", () => {
  it("reads the PKR rate from the provider response", () => {
    expect(parseUsdToPkrRate({ rates: { PKR: 279.125 } })).toBe("279.125000");
  });

  it("rejects missing or invalid rates", () => {
    expect(() => parseUsdToPkrRate({ rates: {} })).toThrow();
    expect(() => parseUsdToPkrRate({ rates: { PKR: -1 } })).toThrow();
  });

  it("defines a twelve-hour refresh window", () => {
    expect(EXCHANGE_RATE_REFRESH_MS).toBe(43_200_000);
  });
});
