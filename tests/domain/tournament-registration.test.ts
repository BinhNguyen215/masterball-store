import { describe, expect, it } from "vitest";

import {
  decideRegistrationPlacement,
  isRegistrationOpen,
} from "@/modules/tournaments";

import { readRegistrationSlug } from "@/app/(store)/tournaments/[slug]/registration-commerce";

describe("tournament registration placement", () => {
  it("always takes the seat when the event has no cap", () => {
    expect(decideRegistrationPlacement({ registered: 0, capacity: null })).toBe("REGISTERED");
    expect(decideRegistrationPlacement({ registered: 9_000, capacity: null })).toBe("REGISTERED");
  });

  it("takes the last free seat and queues everything after it", () => {
    expect(decideRegistrationPlacement({ registered: 7, capacity: 8 })).toBe("REGISTERED");
    expect(decideRegistrationPlacement({ registered: 8, capacity: 8 })).toBe("WAITLISTED");
    expect(decideRegistrationPlacement({ registered: 9, capacity: 8 })).toBe("WAITLISTED");
  });
});

describe("tournament registration window", () => {
  const published = {
    cancelled: false,
    publicationStatus: "PUBLISHED",
    registrationDeadline: null,
  };
  const now = new Date("2026-09-28T03:00:00.000Z");

  it("is open while the event is published and uncancelled", () => {
    expect(isRegistrationOpen(published, now)).toBe(true);
    expect(isRegistrationOpen({ ...published, publicationStatus: "SCHEDULED" }, now)).toBe(false);
    expect(isRegistrationOpen({ ...published, publicationStatus: "UNPUBLISHED" }, now)).toBe(false);
    expect(isRegistrationOpen({ ...published, cancelled: true }, now)).toBe(false);
  });

  it("closes after the deadline, but not on the deadline itself", () => {
    const deadline = new Date("2026-09-28T03:00:00.000Z");
    expect(isRegistrationOpen({ ...published, registrationDeadline: deadline }, now)).toBe(true);
    expect(
      isRegistrationOpen({ ...published, registrationDeadline: deadline }, new Date("2026-09-28T03:00:00.001Z")),
    ).toBe(false);
  });
});

describe("registration form slug", () => {
  const formData = (slug: string) => {
    const data = new FormData();
    data.set("slug", slug);
    return data;
  };

  it("accepts a public slug and rejects anything that is not one", () => {
    expect(readRegistrationSlug(formData("masterball-open-2026"))).toBe("masterball-open-2026");
    expect(readRegistrationSlug(formData("  masterball-open  "))).toBe("masterball-open");
    expect(readRegistrationSlug(formData("../admin"))).toBeNull();
    expect(readRegistrationSlug(formData("MasterBall"))).toBeNull();
    expect(readRegistrationSlug(formData(""))).toBeNull();
    expect(readRegistrationSlug(new FormData())).toBeNull();
  });
});
