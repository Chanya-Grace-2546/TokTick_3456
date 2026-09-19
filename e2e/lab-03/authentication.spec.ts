import { execFileSync } from "child_process";
import * as path from "path";
import { test, expect } from "@playwright/test";
import {
  E2E_PASSWORD,
  INITIAL_PASSWORD,
  USERS,
  login,
  logout,
  screenshotPath,
} from "./helpers";

function resetMandatoryChangeUser() {
  const serverDir = path.resolve(
    __dirname,
    "..",
    "..",
    "server"
  );

  execFileSync(
    "npx",
    [
      "tsx",
      "scripts/prepare-e2e-users.ts",
      "--mandatory-only",
    ],
    {
      cwd: serverDir,
      stdio: "inherit",
      env: process.env,
    }
  );
}

test.describe.serial("E2E-01/02 authentication", () => {
  test(
    "invalid login is safe and protected routes redirect to Login",
    async ({ page }) => {
      await page.goto("/staff/tickets");
      await expect(page).toHaveURL(/\/login$/);

      await page
        .getByLabel("Email", { exact: true })
        .fill(USERS.staff.email);

      await page
        .getByLabel("Password", { exact: true })
        .fill("DefinitelyWrong!123");

      await page
        .getByRole("button", {
          name: "Sign in",
          exact: true,
        })
        .click();

      await expect(page.getByRole("alert")).toContainText(
        "Invalid email or password."
      );

      await expect(page).toHaveURL(/\/login$/);
    }
  );

  test(
    "mandatory initial password change blocks normal app until completed",
    async ({ page }, testInfo) => {
      // Desktop, tablet, and mobile run against the same database.
      // Reset only this dedicated E2E account before this scenario.
      resetMandatoryChangeUser();

      await login(
        page,
        USERS.mustChange.email,
        INITIAL_PASSWORD
      );

      await expect(page).toHaveURL(
        /\/change-password$/
      );

      await page.screenshot({
        path: screenshotPath(
          testInfo,
          "change-password"
        ),
        fullPage: false,
      });

      await page.goto("/staff/tickets");

      await expect(page).toHaveURL(
        /\/change-password$/
      );

      await page
        .getByLabel("New Password", {
          exact: true,
        })
        .fill(E2E_PASSWORD);

      await page
        .getByLabel("Confirm New Password", {
          exact: true,
        })
        .fill(E2E_PASSWORD);

      await page
        .getByRole("button", {
          name: "Change Password",
          exact: true,
        })
        .click();

      await expect(page).toHaveURL(
        /\/staff\/tickets$/
      );

      await expect(
        page.getByRole("heading", {
          name: "Ticket Queue",
        })
      ).toBeVisible();
    }
  );

  test(
    "valid role login and logout lifecycle works",
    async ({ page }, testInfo) => {
      await login(
        page,
        USERS.requester.email
      );

      await expect(page).toHaveURL(
        /\/tickets$/
      );

      await logout(page);

      await page.screenshot({
        path: screenshotPath(
          testInfo,
          "login"
        ),
        fullPage: false,
      });

      await login(
        page,
        USERS.requester.email
      );

      await expect(page).toHaveURL(
        /\/tickets$/
      );

      await logout(page);

      await page.goto("/tickets");

      await expect(page).toHaveURL(
        /\/login$/
      );
    }
  );
});