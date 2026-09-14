import { describe, expect, it } from "vitest";

import {
  getTournamentTiming,
  tournamentInputSchema,
} from "@/modules/tournaments";

const base = {
  gameId: "11111111-1111-4111-8111-111111111111",
  title: "MasterBall Open",
  slug: "masterball-open",
  summary: "A local tournament",
  rules: "Swiss rounds",
  venueName: "MasterBall Store",
  onlineUrl: null,
  startsAt: new Date("2026-10-01T02:00:00.000Z"),
  endsAt: new Date("2026-10-01T08:00:00.000Z"),
  registrationDeadline: new Date("2026-09-30T12:00:00.000Z"),
  feeVnd: 100_000,
};

describe("tournament rules", () => {
  it("accepts a valid UTC interval and derives public timing", () => {
    const tournament = tournamentInputSchema.parse(base);
    expect(getTournamentTiming({ ...tournament, cancelled: false }, new Date("2026-09-30T00:00:00Z"))).toBe("UPCOMING");
    expect(getTournamentTiming({ ...tournament, cancelled: false }, new Date("2026-10-01T04:00:00Z"))).toBe("IN_PROGRESS");
    expect(getTournamentTiming({ ...tournament, cancelled: true })).toBe("CANCELLED");
  });

  it("rejects reversed times, late registration, and unsafe URLs", () => {
    expect(() => tournamentInputSchema.parse({ ...base, endsAt: base.startsAt })).toThrow();
    expect(() => tournamentInputSchema.parse({ ...base, registrationDeadline: base.endsAt })).toThrow();
    expect(() => tournamentInputSchema.parse({ ...base, venueName: null, onlineUrl: "javascript:alert(1)" })).toThrow();
  });
});
