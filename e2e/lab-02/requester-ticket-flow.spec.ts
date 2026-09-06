import { test, expect } from "@playwright/test";
import * as path from 'path';

// Lab 2 Issue 7 — full Requester flow, run once per viewport project
// (desktop/tablet/mobile, see playwright.config.ts). Each run:
//   1. Selects a Development Requester
//   2. Creates a Ticket (screenshotting Create Ticket)
//   3. Opens it, uploads and removes an attachment (screenshotting Ticket Detail)
//   4. Returns to My Tickets and confirms the new Ticket appears (screenshotting My Tickets)
//
// PREREQUISITE: the backend (server/) must already be running with a
// migrated, seeded database — this test does not manage that.
//
// NOTE: this creates a real Ticket + Attachment row per run (3 runs total,
// one per viewport). They aren't cleaned up automatically; that's
// consistent with how the other test suites in this repo behave, but
// worth clearing out periodically the same way (see the SQL cleanup used
// for the API test suites) if your Requester Selection dropdown or
// My Tickets list starts feeling cluttered with E2E test data.

test("Requester can create a ticket, manage its attachment, and find it again", async ({
  page,
}, testInfo) => {
  const viewport = testInfo.project.name; // "desktop" | "tablet" | "mobile"
  const screenshotDir = path.join(__dirname, "..", "..", "artifacts", "lab-02", "screenshots");

  // ---- 1. Development Requester Selection --------------------------------
  await page.goto("/");
  await page.getByLabel(/development requester/i).selectOption({ label: "Jennifer Anderson" });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/tickets$/);

  // ---- 2. Create Ticket ---------------------------------------------------
await page.getByRole("main").getByRole("link", { name: /create ticket/i }).click();
await expect(page).toHaveURL(/\/tickets\/new$/);

  // Wait for reference data (Categories/Related Systems) to finish loading
  // before screenshotting, so the form isn't caught mid-"Loading form…".
  await page.getByLabel(/^category/i).waitFor();

  await page.screenshot({
    path: path.join(screenshotDir, "create-ticket", `${viewport}.png`),
    fullPage: true,
  });

  await page.getByLabel(/^category/i).selectOption({ label: "Hardware" });
  await page.getByLabel(/related system/i).selectOption({ label: "Corporate Laptop" });
  await page.getByLabel(/requested priority/i).selectOption({ label: "Medium" });
  await page.getByLabel(/^summary/i).fill("E2E test: laptop battery drains quickly");
  await page
    .getByLabel(/^description/i)
    .fill(
      "Battery drains fast even when idle, started after last update. Created via automated E2E test."
    );

  await page.getByRole("button", { name: /submit ticket/i }).click();

  const ticketNumberLocator = page.getByText(/TKT-\d{4}-\d{6}/);
  await expect(ticketNumberLocator).toBeVisible();
  const ticketNumber = (await ticketNumberLocator.textContent())!.trim();

  // ---- 3. Ticket Detail + Attachments -------------------------------------
  await page.getByRole("button", { name: /view ticket/i }).click();
  await expect(page).toHaveURL(/\/tickets\/\d+$/);

  const filePath = path.join(__dirname, "fixtures", "sample.png");
  await page.setInputFiles("#attachment-file", filePath);
 await expect(page.getByText("sample.png").first()).toBeVisible();

  await page.screenshot({
    path: path.join(screenshotDir, "ticket-detail", `${viewport}.png`),
    fullPage: true,
  });

  // Soft-remove it — the app collects the reason via window.prompt.
page.once("dialog", (dialog) =>
  dialog.accept("No longer needed — E2E test cleanup")
);

await page.getByRole("button", { name: /remove/i }).first().click();

  // ---- 4. Back to My Tickets — confirm the new Ticket is findable --------
  await page.getByRole("link", { name: /back to my tickets/i }).click();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(page.getByText(ticketNumber)).toBeVisible();

  await page.screenshot({
    path: path.join(screenshotDir, "my-tickets", `${viewport}.png`),
    fullPage: true,
  });
});
