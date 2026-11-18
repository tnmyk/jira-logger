import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

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
  startTime: "00:00",
  quickDurations: [15, 30, 60, 120, 480],
  weekStart: "monday",
  adjustEstimate: "auto",
  notifyWatchers: false,
  targetMinutesPerDay: 480,
  showWeekends: false,
};

const favorites = {
  pins: ["ABC-101", "ABC-102"],
  fixed: [{ key: "ADMIN-1", minutes: 15, comment: "Daily standup" }],
};

await fetch("http://localhost:4000/__reset", { method: "POST" });
const browser = await chromium.launch({ channel: "chrome", headless: true });

const freshContext = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  colorScheme: "dark",
});
const freshPage = await freshContext.newPage();
await freshPage.goto(BASE_URL, { waitUntil: "networkidle" });
await freshPage.getByText("Connect Jira").waitFor();
await freshPage.getByLabel("Jira site").fill("http://localhost:4000");
await freshPage.getByLabel("Email").fill("dev@example.com");
await freshPage.getByLabel("API token").fill("token");
await freshPage.getByRole("button", { name: "Connect" }).click();
await freshPage.getByText("Logged today", { exact: true }).waitFor();
await freshContext.close();

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
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
const toastRegion = page.locator("[data-sonner-toast]");
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(BASE_URL, { waitUntil: "networkidle" });
await page.getByText("Logged today", { exact: true }).waitFor();

const lastWeekButton = page
  .getByRole("button", {
    name: /Last week: \d+ days? under target/,
  })
  .first();
await lastWeekButton.waitFor();

async function worklogCount() {
  const response = await page.request.get("http://localhost:4000/__state");
  return (await response.json()).worklogs;
}

const beforeQuickLog = await worklogCount();
const quickButton = page
  .getByRole("region", { name: "Today" })
  .getByRole("button", { name: "Log 15m on ABC-101" });
await quickButton.evaluate((button) => {
  if (button instanceof HTMLElement) {
    button.click();
    button.click();
  }
});
await toastRegion.getByText("Logged 15m on ABC-101", { exact: true }).waitFor();
assert.equal(
  await worklogCount(),
  beforeQuickLog + 1,
  "quick-log double click must create one worklog",
);
await page.keyboard.press("u");
await toastRegion.getByText("Removed 1 worklog.", { exact: true }).waitFor();
assert.equal(await worklogCount(), beforeQuickLog);

const beforeBatch = await worklogCount();
await page.getByRole("button", { name: "Fill day" }).click();
const batchDialog = page.getByRole("dialog", { name: "Fill today" });
await batchDialog.waitFor();
const durationInputs = batchDialog.locator(
  'input[aria-label^="Duration for "]',
);
const durationCount = await durationInputs.count();
for (let index = 0; index < durationCount; index += 1) {
  await durationInputs.nth(index).fill("");
}
await batchDialog.getByLabel("Duration for ABC-103").fill("30m");
await batchDialog.getByRole("button", { name: /Log 1 entry/ }).click();
await toastRegion.getByText("Logged 1 entry.", { exact: true }).waitFor();
await batchDialog.waitFor({ state: "hidden" });
assert.equal(
  await worklogCount(),
  beforeBatch + 1,
  "fill today must log one selected entry",
);

await page.getByRole("button", { name: "Search", exact: true }).click();
await page.locator('main [data-ticket-key="ABC-101"]').waitFor();
assert.equal(await page.locator("main [data-ticket-key]").count(), 11);

const searchInput = page.getByLabel("Search tickets");
await searchInput.fill("ABC-104");
await searchInput.press("Enter");
await page.waitForFunction(
  () => document.querySelectorAll("main [data-ticket-key]").length === 1,
);
assert.equal(
  await page.locator("main [data-ticket-key]").first().getAttribute("data-ticket-key"),
  "ABC-104",
);

await searchInput.fill("OAuth callback");
await searchInput.press("Enter");
await page.waitForFunction(
  () => document.querySelectorAll("main [data-ticket-key]").length === 1,
);
assert.equal(
  await page.locator("main [data-ticket-key]").first().getAttribute("data-ticket-key"),
  "ABC-101",
);

await searchInput.fill(preferences.defaultJql);
await searchInput.press("Enter");
await page.waitForFunction(
  () => document.querySelectorAll("main [data-ticket-key]").length === 11,
);

await page.evaluate(() => document.activeElement?.blur());
await page.keyboard.press("j");
const settingsButton = page
  .locator('button[aria-label="Settings"]:visible')
  .first();
await settingsButton.focus();
await page.keyboard.press("Enter");
await page.getByText("Stored only in this browser.").waitFor();
assert.equal(
  await page.locator('aside[aria-label="Ticket detail"]').count(),
  0,
  "Enter on focused Settings must not open ticket detail",
);
await page.getByRole("button", { name: "Close dialog" }).click();

const authHeader = {
  Authorization: `Basic ${Buffer.from(
    `${connection.email}:${connection.token}`,
  ).toString("base64")}`,
  "X-Jira-Base-Url": connection.baseUrl,
};
const badDate = await page.request.get(
  `${BASE_URL}/api/jira/worklogs/summary?from=2026-02-30&to=2026-03-02&timeZone=Asia%2FKolkata&accountId=mock-account`,
  { headers: authHeader },
);
const badTimezone = await page.request.get(
  `${BASE_URL}/api/jira/worklogs/summary?from=2026-03-01&to=2026-03-02&timeZone=Mars%2FBase&accountId=mock-account`,
  { headers: authHeader },
);
assert.equal(badDate.status(), 400);
assert.equal(badTimezone.status(), 400);

await page.keyboard.press("/");
await page.getByLabel("Search tickets").waitFor();
await page.waitForTimeout(100);
assert.equal(
  await page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
  "Search tickets",
);

await page.locator('main [data-ticket-key="ABC-101"]').click();
await page.getByRole("button", { name: "Log time" }).waitFor();
await page.keyboard.press("l");
assert.equal(
  await page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
  "Duration",
);

await page.getByLabel("Duration").fill("30m");
await page.getByPlaceholder("What did you work on?").fill("Smoke test");
await page.locator("form").evaluate((form) => {
  form.requestSubmit();
  form.requestSubmit();
});
await toastRegion.getByText("Worklog added", { exact: true }).waitFor();
await page.getByText("Smoke test").waitFor();
assert.equal(
  await page.locator("li", { hasText: "Smoke test" }).count(),
  1,
  "double submit must create exactly one worklog",
);

const smokeRow = page.locator("li", { hasText: "Smoke test" });
await smokeRow.hover();
const smokeDelete = smokeRow.getByRole("button", {
  name: /Delete .* worklog on ABC-101/,
});
await smokeDelete.click({ force: true });
await page.getByRole("dialog").waitFor();
await page.keyboard.press("Escape");
await page.getByRole("dialog").waitFor({ state: "hidden" });
await page.waitForTimeout(100);
assert.equal(
  await page.evaluate(
    () => Boolean(document.activeElement?.closest("#ticket-detail")),
  ),
  true,
  "delete dialog must restore focus inside the detail panel",
);
await smokeDelete.click({ force: true });
await page.getByRole("dialog").waitFor();
await page.getByRole("dialog").getByRole("button", { name: "Delete worklog" }).click();
await toastRegion.getByText("Worklog deleted", { exact: true }).waitFor();
await page.getByText("Smoke test").waitFor({ state: "detached" });

await page.getByRole("button", { name: "Close ticket detail" }).click();
await page.waitForTimeout(150);

await page.getByRole("button", { name: "Week", exact: true }).click();
await page.locator("[data-day]").first().waitFor();
await lastWeekButton.click();
await page.getByText("Back to this week").waitFor();

const previousWeekDays = page.locator("[data-day]");
const firstDay = previousWeekDays.first();
await firstDay.getByRole("button", { name: "Backfill" }).click();
const backfillDialog = page.getByRole("dialog", { name: "Backfill time" });
await backfillDialog.waitFor();
await backfillDialog.getByRole("button", { name: "Close dialog" }).click();
await backfillDialog.waitFor({ state: "hidden" });
await page.waitForTimeout(100);
assert.equal(
  await firstDay
    .getByRole("button", { name: "Backfill" })
    .evaluate((button) => button === document.activeElement),
  true,
  "backfill dialog must restore focus",
);
await firstDay.getByRole("button", { name: "Backfill" }).click();
await backfillDialog.waitFor();
const backfillComment = `Backfilled smoke ${Date.now()}`;
await backfillDialog.getByLabel("Ticket key").fill("ABC-101");
await backfillDialog.getByLabel("Duration").fill("30m");
await backfillDialog
  .getByPlaceholder("What did you work on?")
  .fill(backfillComment);
const beforeBackfill = await worklogCount();
await backfillDialog
  .getByRole("button", { name: "Log time" })
  .evaluate((button) => {
    if (button instanceof HTMLElement) {
      button.click();
      button.click();
    }
  });
await toastRegion.getByText("Logged 30m on ABC-101", { exact: true }).waitFor();
assert.equal(
  await worklogCount(),
  beforeBackfill + 1,
  "backfill double click must create one worklog",
);
await backfillDialog.waitFor({ state: "hidden" });
await page.getByText(backfillComment).waitFor();

const secondDay = previousWeekDays.nth(1);
await secondDay.getByRole("button", { name: "Day off" }).click();
await secondDay.getByRole("button", { name: "Undo day off" }).waitFor();
await secondDay.getByRole("button", { name: "Undo day off" }).click();

await page.getByText("Back to this week").click();
await page.getByText("Back to this week").waitFor({ state: "hidden" });

const beforeCopy = await worklogCount();
await page.getByRole("button", { name: "Copy previous week" }).click();
const copyDialog = page.getByRole("dialog", { name: "Copy previous week" });
await copyDialog.waitFor();
await copyDialog
  .getByRole("button", { name: /Copy \d+ entr/ })
  .evaluate((button) => {
    if (button instanceof HTMLElement) {
      button.click();
      button.click();
    }
  });
await toastRegion.getByText(/Copied \d+ entr/).waitFor();
await copyDialog.waitFor({ state: "hidden" });
assert.equal(
  await worklogCount(),
  beforeCopy + 1,
  "copy previous week must copy selected entries",
);

await page.getByRole("button", { name: "Search", exact: true }).click();
await page.locator('main [data-ticket-key="ABC-101"]').waitFor();

await page.setViewportSize({ width: 1024, height: 800 });
await page.locator('main [data-ticket-key="ABC-101"]').click();
const narrowDetail = page.locator('aside[aria-label="Ticket detail"]');
await narrowDetail.waitFor();
await page.waitForFunction(
  () =>
    document
      .querySelector('aside[aria-label="Ticket detail"]')
      ?.getAttribute("role") === "dialog",
);
assert.equal(await narrowDetail.getAttribute("role"), "dialog");
assert.equal(await narrowDetail.getAttribute("aria-modal"), "true");
assert.equal(
  await page.evaluate(() => document.querySelector("[inert]") !== null),
  true,
);
await page.keyboard.press("Escape");
await narrowDetail.waitFor({ state: "hidden" });
await page.waitForTimeout(100);
assert.match(
  (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) ??
    "",
  /^Open ABC-101/,
);

await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "Open navigation" }).click();
const navigation = page.getByRole("dialog", { name: "Navigation" });
await navigation.getByText("Pinned", { exact: true }).waitFor();
assert.equal(await navigation.getByRole("button", { name: "Close navigation" }).isVisible(), true);
await page.keyboard.press("Escape");
await navigation.waitFor({ state: "hidden" });
await page.waitForTimeout(100);
assert.equal(
  await page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
  "Open navigation",
);

await page.getByRole("button", { name: "Open navigation" }).click();
const navigationAfterResize = page.getByRole("dialog", { name: "Navigation" });
await navigationAfterResize.getByText("Pinned", { exact: true }).waitFor();
await page.setViewportSize({ width: 844, height: 800 });
await navigationAfterResize.waitFor({ state: "hidden" });
await page.waitForTimeout(150);
assert.notEqual(
  await page.evaluate(() => getComputedStyle(document.body).pointerEvents),
  "none",
);
assert.equal(
  await page.getByRole("button", { name: "Open navigation" }).isVisible(),
  false,
);

await page.locator('button[aria-label="Settings"]:visible').first().click();
await page.getByText("Stored only in this browser.").waitFor();
await page.getByRole("button", { name: "Close dialog" }).click();
await page.getByText("Stored only in this browser.").waitFor({ state: "hidden" });
await page.waitForTimeout(100);
assert.equal(
  await page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
  "Settings",
  "settings dialog must restore focus",
);
await page.locator('button[aria-label="Settings"]:visible').first().click();
await page.getByText("Stored only in this browser.").waitFor();
await page.getByRole("tab", { name: "Connection" }).click();
await page.getByRole("button", { name: "Disconnect Jira" }).click();
await page.getByText("Disconnect Jira?").waitFor();
await page.getByRole("button", { name: "Disconnect", exact: true }).click();
await page.getByText("Connect Jira").waitFor();

await browser.close();

if (errors.length > 0) {
  console.error("Browser errors:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    "Smoke test passed: connect, today quick-log + u-undo + batch, key/word search, duplicate-submit guards, week backfill/day off/copy, focus restore, mobile nav resize, disconnect.",
  );
}
