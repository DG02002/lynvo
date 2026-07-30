import { describe, expect, it } from "vitest"
import { getBrowserDeviceName } from "~/lib/device-name"

describe("browser device name", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
      "Chrome on Windows",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15",
      "Safari on macOS",
    ],
    [
      "Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36",
      "Chrome on Android",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0.0.0 Mobile/15E148 Safari/604.1",
      "Chrome on iOS",
    ],
    [
      "Mozilla/5.0 (X11; CrOS x86_64 16093.68.0) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
      "Chrome on ChromeOS",
    ],
    [
      "Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko",
      "Internet Explorer on Windows",
    ],
    [
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 SamsungBrowser/28.0 Chrome/130.0 Mobile Safari/537.36",
      "Samsung Internet on Android",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edge/18.19045 Safari/537.36",
      "Edge on Windows",
    ],
    [
      "Opera/9.80 (Android; Opera Mini/36.2.2254/191.249; U; en) Presto/2.12.423 Version/12.16",
      "Opera on Android",
    ],
    [
      "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A; wv) AppleWebKit/537.36 Version/4.0 Chrome/115.0 Mobile Safari/537.36",
      "Android WebView on Android",
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
      "Firefox on Linux",
    ],
    ["CustomAgent/1.0", "Browser on device"],
  ])("detects %s as %s", (userAgent, expected) => {
    expect(getBrowserDeviceName(userAgent)).toBe(expected)
  })

  it("uses a safe fallback when no user agent is available", () => {
    expect(getBrowserDeviceName("")).toBe("Unknown Device")
  })
})
