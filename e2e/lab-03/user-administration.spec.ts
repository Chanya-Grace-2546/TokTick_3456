import { test, expect } from "@playwright/test";
import {
  E2E_PASSWORD,
  login,
  logout,
  USERS,
  screenshotPath,
} from "./helpers";

test(
  "E2E-05 Administrator manages a User and enforces reset password change",
  async ({ page }, testInfo) => {
    await login(page, USERS.admin.email);

    await expect(page).toHaveURL(
      /\/admin\/users$/
    );

    await expect(
      page.getByRole("heading", {
        name: "Users",
      })
    ).toBeVisible();

    await page.screenshot({
      path: screenshotPath(
        testInfo,
        "user-management"
      ),
      fullPage: false,
    });

    const unique = Date.now();
    const originalName =
      `E2E Managed Requester ${unique}`;
    const updatedName =
      `${originalName} Updated`;
    const email =
      `e2e.managed.${unique}@example.test`;

    const initialPassword =
      "CreatedE2e!456";

    const resetPassword =
      "ResetE2e!789";

    /*
     * Create User
     */
    await page
      .getByRole("button", {
        name: /create user/i,
      })
      .click();

    const createForm = page.getByRole(
      "form",
      {
        name: "Create User",
      }
    );

    await expect(createForm).toBeVisible();

    await createForm
      .getByLabel("Name")
      .fill(originalName);

    await createForm
      .getByLabel("Email")
      .fill(email);

    await createForm
      .getByLabel("Role")
      .selectOption("REQUESTER");

    await createForm
      .getByLabel(
        "Initial Password",
        { exact: true }
      )
      .fill(initialPassword);

    await createForm
      .getByLabel(
        "Confirm Initial Password",
        { exact: true }
      )
      .fill(initialPassword);

    await createForm
      .getByRole("button", {
        name: "Save User",
        exact: true,
      })
      .click();

    await expect(
      page.getByRole("status")
    ).toContainText("User created.");

    /*
     * Search for the exact User so the
     * rest of the scenario does not depend
     * on unrelated database rows.
     *
     * The desktop/tablet table and mobile
     * cards both exist in the DOM, so use
     * the visible rendered copy.
     */
    const search =
      page.getByLabel("Search users");

    await search.fill(email);

    await expect(
      page
        .locator(
          `:text-is("${email}"):visible`
        )
        .first()
    ).toBeVisible();

    /*
     * Edit User name.
     */
    await page
      .getByRole("button", {
        name: `Edit ${originalName}`,
        exact: true,
      })
      .click();

    let editForm = page.getByRole(
      "form",
      {
        name: "Edit User",
      }
    );

    await editForm
      .getByLabel("Name")
      .fill(updatedName);

    await editForm
      .getByRole("button", {
        name: "Save Changes",
        exact: true,
      })
      .click();

    await expect(
      page.getByRole("status")
    ).toContainText(
      "User changes saved."
    );

    await expect(
      page
        .locator(
          `:text-is("${updatedName}"):visible`
        )
        .first()
    ).toBeVisible();

    /*
     * Deactivate User.
     */
    await page
      .getByRole("button", {
        name: `Edit ${updatedName}`,
        exact: true,
      })
      .click();

    editForm = page.getByRole(
      "form",
      {
        name: "Edit User",
      }
    );

    const active =
      editForm.getByLabel("Active", {
        exact: true,
      });

    await expect(active).toBeChecked();

    await active.uncheck();

    await editForm
      .getByRole("button", {
        name: "Save Changes",
        exact: true,
      })
      .click();

    await expect(
      page.getByRole("status")
    ).toContainText(
      "User changes saved."
    );

    await expect(
      page
        .locator(
          ':text-is("Inactive"):visible'
        )
        .first()
    ).toBeVisible();

    /*
     * Reactivate the same User.
     */
    await page
      .getByRole("button", {
        name: `Edit ${updatedName}`,
        exact: true,
      })
      .click();

    editForm = page.getByRole(
      "form",
      {
        name: "Edit User",
      }
    );

    const activeAgain =
      editForm.getByLabel("Active", {
        exact: true,
      });

    await expect(
      activeAgain
    ).not.toBeChecked();

    await activeAgain.check();

    await editForm
      .getByRole("button", {
        name: "Save Changes",
        exact: true,
      })
      .click();

    await expect(
      page.getByRole("status")
    ).toContainText(
      "User changes saved."
    );

    await expect(
      page
        .locator(
          ':text-is("Active"):visible'
        )
        .first()
    ).toBeVisible();

    /*
     * Set a new initial password.
     *
     * The contract requires existing
     * sessions to end and the User to be
     * forced through Change Password at
     * the next login.
     */
    await page
      .getByRole("button", {
        name: `Edit ${updatedName}`,
        exact: true,
      })
      .click();

    const resetForm = page.getByRole(
      "form",
      {
        name: "Set New Initial Password",
      }
    );

    await resetForm
      .getByLabel(
        "Initial Password",
        { exact: true }
      )
      .fill(resetPassword);

    await resetForm
      .getByLabel(
        "Confirm Password",
        { exact: true }
      )
      .fill(resetPassword);

    await resetForm
      .getByRole("button", {
        name: "Set New Initial Password",
        exact: true,
      })
      .click();

    await expect(
      page.getByRole("status")
    ).toContainText(
      "New initial password saved. The User must change it at next login."
    );

    /*
     * Leave the Administrator session and
     * log in as the reset Requester.
     */
    await logout(page);

    await login(
      page,
      email,
      resetPassword
    );

    await expect(page).toHaveURL(
      /\/change-password$/
    );

    /*
     * Mandatory-change users must not be
     * able to enter the normal app first.
     */
    await page.goto("/tickets");

    await expect(page).toHaveURL(
      /\/change-password$/
    );

    await page
      .getByLabel("New Password", {
        exact: true,
      })
      .fill(E2E_PASSWORD);

    await page
      .getByLabel(
        "Confirm New Password",
        { exact: true }
      )
      .fill(E2E_PASSWORD);

    await page
      .getByRole("button", {
        name: "Change Password",
        exact: true,
      })
      .click();

    await expect(page).toHaveURL(
      /\/tickets$/
    );

    /*
     * The Requester may reach the route,
     * but the Administrator API must reject
     * access and no User-management controls
     * may be exposed.
     */
    await page.goto("/admin/users");

    await expect(
      page.getByRole("alert")
    ).toContainText(
      "You do not have permission to manage Users."
    );

    await expect(
      page.getByRole("heading", {
        name: "Users",
      })
    ).toHaveCount(0);

    await expect(
      page.getByRole("button", {
        name: /create user/i,
      })
    ).toHaveCount(0);
  }
);

test(
  "E2E-05 Administrator cannot deactivate own account",
  async ({ page }) => {
    await login(page, USERS.admin.email);

    await expect(page).toHaveURL(
      /\/admin\/users$/
    );

    const search =
      page.getByLabel("Search users");

    await search.fill(USERS.admin.email);

    /*
     * Desktop/tablet use the User table,
     * while mobile uses User cards.
     * Assert against the visible copy.
     */
    await expect(
      page
        .locator(
          `:text-is("${USERS.admin.email}"):visible`
        )
        .first()
    ).toBeVisible();

    await page
      .getByRole("button", {
        name: `Edit ${USERS.admin.name}`,
        exact: true,
      })
      .click();

    const editForm = page.getByRole(
      "form",
      {
        name: "Edit User",
      }
    );

    const active =
      editForm.getByLabel("Active", {
        exact: true,
      });

    await expect(active).toBeChecked();

    await active.uncheck();

    await editForm
      .getByRole("button", {
        name: "Save Changes",
        exact: true,
      })
      .click();

    await expect(
      page.getByRole("alert")
    ).toContainText(
      "You cannot deactivate your own account."
    );

    /*
     * The rejected operation must leave
     * the Administrator editor available.
     */
    await expect(
      page.getByRole("form", {
        name: "Edit User",
      })
    ).toBeVisible();
  }
);