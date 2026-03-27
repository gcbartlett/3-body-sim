import { APP_LINKS } from "../config/appLinks";

export const SPONSOR_OPEN_TARGET = "_blank";
export const SPONSOR_OPEN_FEATURES = "noopener,noreferrer";

export type OpenWindow = (url?: string | URL, target?: string, features?: string) => WindowProxy | null;

export const openSponsorPage = (openWindow: OpenWindow): void => {
  openWindow(APP_LINKS.sponsorUrl, SPONSOR_OPEN_TARGET, SPONSOR_OPEN_FEATURES);
};
