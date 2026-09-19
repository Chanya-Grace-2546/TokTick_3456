import { test, expect } from "@playwright/test";
import { login, USERS, screenshotPath } from "./helpers";

test("E2E-04 IT Staff queue and operational ticket detail", async ({ page }, testInfo) => {
  await login(page, USERS.staff.email);
  await expect(page).toHaveURL(/\/staff\/tickets$/);
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();

  await page.screenshot({
    path: screenshotPath(testInfo, "staff-queue"),
    fullPage: false,
  });

  const firstTicket = page.getByRole("link", { name: /open ticket TKT-/i }).first();
  await expect(firstTicket).toBeVisible();
  await firstTicket.click();
  await expect(page).toHaveURL(/\/staff\/tickets\/\d+$/);

  await expect(page.getByText("Requested Priority", { exact: true })).toBeVisible();
  await expect(page.getByLabel("IT Priority")).toBeVisible();
  await expect(page.getByLabel("Status")).toBeVisible();
  await expect(page.getByRole("heading", { name: /public comments/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /internal notes/i })).toBeVisible();

  await page.screenshot({
    path: screenshotPath(testInfo, "staff-ticket-detail"),
    fullPage: true,
  });
});
