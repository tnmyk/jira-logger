import { mkdir, rm } from "node:fs/promises";
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = ".artifacts/ui";

const connection = {
  baseUrl: "http://localhost:4000",
  deployment: "cloud",
  email: "dev@example.com",
  token: "token",
  accountId: "mock-account",
  displayName: "Dev User",
  timeZone: "Asia/Kolkata",
};

const preferences = {
  defaultJql:
    "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC",
  startTime: "09:00",
  quickDurations: [15, 30, 60, 120, 480],
  weekStart: "monday",
  adjustEstimate: "auto",
  notifyWatchers: false,
  targetMinutesPerDay: 480,
  showWeekends: false,
};

const favorites = {
  pins: ["ABC-101", "ABC-102"],
  fixed: [
    { key: "ADMIN-1", minutes: 15, comment: "Daily standup" },
    { key: "ABC-106", minutes: 30, comment: "Admin / docs" },
  ],
};

await fetch("http://localhost:4000/__reset", { method: "POST" });
await rm(OUTPUT_DIR, { recursive: true, force: true });
await mkdir(OUTPUT_DIR, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
});

await context.addInitScript(
  ({ connection, preferences, favorites }) => {
    localStorage.setItem("jira-logger.connection.v1", JSON.stringify(connection));
    localStorage.setItem("jira-logger.preferences.v1", JSON.stringify(preferences));
    localStorage.setItem("jira-logger.favorites.v1", JSON.stringify(favorites));
    localStorage.setItem("jira-logger.first-logged-at.v1", JSON.stringify(new Date(Date.now() - 30 * 86400000).toISOString()));
  },
  { connection, preferences, favorites },
);

const page = await context.newPage();
await page.goto(BASE_URL, { waitUntil: "networkidle" });
await page.getByText("Logged today", { exact: true }).waitFor();
await page.screenshot({ path: `${OUTPUT_DIR}/today-1440.png` });

await page.getByRole("button", { name: "Fill day" }).click();
await page.getByRole("dialog", { name: "Fill today" }).waitFor();
await page.getByRole("button", { name: "Use fixed defaults" }).click();
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUTPUT_DIR}/batch-1440.png` });
await page.getByRole("button", { name: "Close dialog" }).click();

await page.getByRole("button", { name: "Week", exact: true }).click();
await page.locator("[data-day]").first().waitFor();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUTPUT_DIR}/week-1440.png` });

await page.getByRole("button", { name: /Last week: \d+ days? under target/ }).click();
await page.getByText("Back to this week").waitFor();
await page.getByRole("button", { name: "Backfill" }).first().click();
await page.getByRole("dialog", { name: "Backfill time" }).waitFor();
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUTPUT_DIR}/backfill-1440.png` });
await page.getByRole("button", { name: "Close dialog" }).click();
await page.getByText("Back to this week").click();

await page.getByRole("button", { name: "Search", exact: true }).click();
await page.locator('main [data-ticket-key="ABC-101"]').waitFor();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUTPUT_DIR}/search-1440.png` });

await page.locator('main [data-ticket-key="ABC-101"]').click();
await page.getByText("Log time").first().waitFor();
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUTPUT_DIR}/detail-1440.png` });

await page.locator('button[aria-label="Settings"]:visible').first().click();
await page.getByText("Stored only in this browser.").waitFor();
await page.screenshot({ path: `${OUTPUT_DIR}/settings-1440.png` });
await page.getByRole("tab", { name: "Fixed tickets" }).click();
await page.screenshot({ path: `${OUTPUT_DIR}/settings-fixed-1440.png` });
await page.getByRole("button", { name: "Close dialog" }).click();
await page.getByRole("button", { name: "Close ticket detail" }).click();
await page.waitForTimeout(150);

await page.setViewportSize({ width: 1024, height: 800 });
await page.getByRole("button", { name: "Today", exact: true }).click();
await page.getByText("Logged today", { exact: true }).waitFor();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUTPUT_DIR}/today-1024.png` });

await page.getByRole("button", { name: "Week", exact: true }).click();
await page.locator("[data-day]").first().waitFor();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUTPUT_DIR}/week-1024.png` });

await page.getByRole("button", { name: "Search", exact: true }).click();
await page.locator('main [data-ticket-key="ABC-101"]').click();
await page.getByText("Log time").first().waitFor();
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUTPUT_DIR}/detail-1024.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "Open navigation" }).click();
const nav = page.getByRole("dialog", { name: "Navigation" });
await nav.getByRole("button", { name: "Today", exact: true }).click();
await page.getByText("Logged today", { exact: true }).waitFor();
await page.screenshot({ path: `${OUTPUT_DIR}/today-390.png` });

await page.getByRole("button", { name: "Open navigation" }).click();
await nav.getByRole("button", { name: "Week", exact: true }).click();
await page.locator("[data-day]").first().waitFor();
await page.screenshot({ path: `${OUTPUT_DIR}/week-390.png` });

await page.getByRole("button", { name: "Open navigation" }).click();
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUTPUT_DIR}/navigation-390.png` });

await browser.close();
console.log(`Screenshots written to ${OUTPUT_DIR}`);
