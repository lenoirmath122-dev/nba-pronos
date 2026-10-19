import { describe, it, expect } from "vitest";
import { isInAppBrowser } from "./inAppBrowser";

describe("isInAppBrowser", () => {
  it("reconnaît les navigateurs intégrés d'Instagram et de Facebook", () => {
    expect(isInAppBrowser("Mozilla/5.0 (iPhone) AppleWebKit Mobile/15E148 Instagram 300.0.0")).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 14) [FB_IAB/FB4A;FBAV/450.0]")).toBe(true);
  });

  it("laisse passer Safari et Chrome", () => {
    expect(isInAppBrowser("Mozilla/5.0 (iPhone) AppleWebKit Version/17.0 Mobile Safari/604.1")).toBe(false);
    expect(isInAppBrowser("Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36")).toBe(false);
  });
});
