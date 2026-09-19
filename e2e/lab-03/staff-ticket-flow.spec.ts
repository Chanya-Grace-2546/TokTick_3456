import { test, expect } from "@playwright/test";
import { login, logout, USERS, screenshotPath } from "./helpers";

test("E2E-04 IT Staff queue and operational ticket detail", async ({ page }, testInfo) => {
  // Create a fresh, known NEW/unassigned ticket using the existing requester.
  // Global setup already prepares all accounts; do not reset them here.
  await login(page, USERS.requester.email);
  await expect(page).toHaveURL(/\/tickets$/);
  const categories = await page.request.get("http://localhost:3000/api/categories");
  const systems = await page.request.get("http://localhost:3000/api/related-systems");
  expect(categories.ok()).toBeTruthy();
  expect(systems.ok()).toBeTruthy();
  const created = await page.request.post("http://localhost:3000/api/tickets", {
    headers: { Origin: "http://localhost:5173" },
    data: {
      categoryId: (await categories.json())[0].id,
      relatedSystemId: (await systems.json())[0].id,
      summary: `Staff workflow ${testInfo.project.name}`,
      description: "Dedicated unassigned ticket for the staff operational workflow.",
      requestedPriority: "MEDIUM",
    },
  });
  expect(created.status()).toBe(201);
  const ticket = await created.json();
  await logout(page);
  await login(page, USERS.staff.email);
  await expect(page).toHaveURL(/\/staff\/tickets$/);
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();

  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
  await page.screenshot({
    path: screenshotPath(testInfo, "staff-queue"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText(/Page 2 of/)).toBeVisible();
  await page.getByLabel("Search tickets").fill(ticket.ticketNumber);
  const openTicket = page.getByRole("link", { name: `Open ticket ${ticket.ticketNumber}`, exact: true });
  await expect(openTicket).toBeVisible();
  await openTicket.click();
  await expect(page).toHaveURL(/\/staff\/tickets\/\d+$/);

  await expect(page.getByText("Requested Priority", { exact: true })).toBeVisible();
  await expect(page.getByLabel("IT Priority")).toBeVisible();
  await expect(page.getByLabel("Status")).toBeVisible();
  await expect(page.getByRole("heading", { name: /public comments/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /internal notes/i })).toBeVisible();

  await page.getByRole("button", { name: "Claim Ticket", exact: true }).click();
  await expect(page.getByText("Ticket claimed successfully.")).toBeVisible();
  const owner = page.getByLabel("Ticket Owner");
  await expect(owner.locator("option:checked")).toContainText(USERS.staff.name);
  const ownerId = await owner.inputValue();

  await page.getByLabel("IT Priority").selectOption("HIGH");
  await page.getByRole("button", { name: "Save IT Priority" }).click();
  await expect(page.getByText("IT Priority updated.")).toBeVisible();
  await page.getByLabel("Status", { exact: true }).selectOption("IN_PROGRESS");
  await page.getByRole("button", { name: "Change Status" }).click();
  await expect(page.getByText("Status changed to In Progress.")).toBeVisible();

  const publicComment = `Public update for ${ticket.ticketNumber}`;
  const internalNote = `Internal diagnosis for ${ticket.ticketNumber}`;
  await page.getByLabel("Add Public Comment").fill(publicComment);
  await page.getByRole("button", { name: "Post Public Comment" }).click();
  await expect(page.getByText(publicComment, { exact: true })).toBeVisible();
  await page.getByLabel("Add Internal Note").fill(internalNote);
  await page.getByRole("button", { name: "Add Internal Note", exact: true }).click();
  await expect(page.getByText(internalNote, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Ticket Owner")).toHaveValue(ownerId);
  await expect(page.getByLabel("IT Priority")).toHaveValue("HIGH");
  await expect(page.getByText("In Progress", { exact: true })).toBeVisible();
  await expect(page.getByText(publicComment, { exact: true })).toBeVisible();
  await expect(page.getByText(internalNote, { exact: true })).toBeVisible();
  const persisted = await page.request.get(`http://localhost:3000/api/staff/tickets/${ticket.id}`);
  expect(persisted.ok()).toBeTruthy();
  expect(await persisted.json()).toMatchObject({
    requestedPriority: "MEDIUM", itPriority: "HIGH", status: "IN_PROGRESS",
    owner: { id: Number(ownerId) },
  });

  await page.screenshot({
    path: screenshotPath(testInfo, "staff-ticket-detail"),
    fullPage: true,
  });
});
