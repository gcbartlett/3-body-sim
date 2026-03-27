import { describe, expect, it, vi } from "vitest";
import { APP_LINKS } from "~/src/config/appLinks";
import { openSponsorPage, SPONSOR_OPEN_FEATURES, SPONSOR_OPEN_TARGET } from "~/src/ui/sponsorPage";

describe("openSponsorPage", () => {
  it("opens sponsor page in a new tab with noopener and noreferrer", () => {
    const openWindow = vi.fn();

    openSponsorPage(openWindow);

    expect(openWindow).toHaveBeenCalledTimes(1);
    expect(openWindow).toHaveBeenCalledWith(APP_LINKS.sponsorUrl, SPONSOR_OPEN_TARGET, SPONSOR_OPEN_FEATURES);
  });
});
