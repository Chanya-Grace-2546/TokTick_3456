import {
  expect,
  Page,
  TestInfo,
} from "@playwright/test";
import * as path from "path";

export const INITIAL_PASSWORD =
  "ChangeMe1!";

export const E2E_PASSWORD =
  "E2eStrong!456";

export const USERS = {
  requester: {
    email:
      "e2e.requester@toktickit.test",
    name: "E2E Requester",
  },

  otherRequester: {
    email:
      "e2e.requester.other@toktickit.test",
    name: "E2E Other Requester",
  },

  staff: {
    email:
      "e2e.staff@toktickit.test",
    name: "E2E IT Staff",
  },

  admin: {
    email:
      "e2e.admin@toktickit.test",
    name: "E2E Administrator",
  },

  mustChange: {
    email:
      "e2e.must-change@toktickit.test",
    name: "E2E Mandatory Change",
  },
};

export async function login(
  page: Page,
  email: string,
  password = E2E_PASSWORD
) {
  await page.goto("/login");

  await page
    .getByLabel("Email", {
      exact: true,
    })
    .fill(email);

  await page
    .getByLabel("Password", {
      exact: true,
    })
    .fill(password);

  await page
    .getByRole("button", {
      name: "Sign in",
      exact: true,
    })
    .click();
}

export async function logout(
  page: Page
) {
  const mobileNavButton =
    page.getByRole("button", {
      name: "Toggle navigation",
      exact: true,
    });

  if (
    await mobileNavButton.isVisible()
  ) {
    await mobileNavButton.click();

    const mobileSignOut =
      page.getByRole("button", {
        name: "Sign Out",
        exact: true,
      });

    await expect(
      mobileSignOut
    ).toBeVisible();

    await mobileSignOut.click();

    await expect(page).toHaveURL(
      /\/login$/
    );

    return;
  }

  const accountMenu = page
    .locator("header")
    .getByRole("button", {
      name: /▾/,
    })
    .first();

  await expect(
    accountMenu
  ).toBeVisible();

  await accountMenu.click();

  const signOut =
    page.getByRole("button", {
      name: "Sign Out",
      exact: true,
    });

  await expect(
    signOut
  ).toBeVisible();

  await signOut.click();

  await expect(page).toHaveURL(
    /\/login$/
  );
}

export function screenshotPath(
  testInfo: TestInfo,
  screen: string
) {
  return path.join(
    __dirname,
    "..",
    "..",
    "artifacts",
    "lab-03",
    "screenshots",
    screen,
    `${testInfo.project.name}.png`
  );
}