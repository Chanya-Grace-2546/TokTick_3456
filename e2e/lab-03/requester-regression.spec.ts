import {
  test,
  expect,
} from "@playwright/test";
import {
  login,
  logout,
  USERS,
  screenshotPath,
} from "./helpers";

const E2E_TICKET_SUMMARY_PREFIX =
  "Lab 3 Issue 8 E2E Requester Ticket";

const E2E_ATTACHMENT_NAME =
  "lab3-e2e-attachment.png";

const E2E_REMOVAL_REASON =
  "Removed by Lab 3 E2E test";

/*
 * Tiny valid PNG stored directly in the
 * test. No external fixture is required.
 */
const E2E_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test(
  "E2E-03 Requester creates a ticket and uses attachments/comments/resolution",
  async ({ page }, testInfo) => {
    /*
     * Give every viewport run its own ticket.
     * This prevents desktop/tablet/mobile
     * runs from reusing the same test data.
     */
    const ticketSummary =
      `${E2E_TICKET_SUMMARY_PREFIX} ${testInfo.project.name} ${Date.now()}`;

    await login(
      page,
      USERS.requester.email
    );

    await expect(page).toHaveURL(
      /\/tickets$/
    );

    await page
      .locator(
        'a[href="/tickets/new"]:visible'
      )
      .first()
      .click();

    await expect(page).toHaveURL(
      /\/tickets\/new$/
    );

    await page
      .getByLabel(/^category/i)
      .waitFor();

    await page
      .getByLabel(/^category/i)
      .selectOption({
        label: "Hardware",
      });

    await page
      .getByLabel(/related system/i)
      .selectOption({
        label: "Corporate Laptop",
      });

    await page
      .getByLabel(/requested priority/i)
      .selectOption({
        label: "Medium",
      });

    await page
      .getByLabel(/^summary/i)
      .fill(ticketSummary);

    await page
      .getByLabel(/^description/i)
      .fill(
        "Requester regression evidence created by Lab 3 Issue 8 E2E."
      );

    await page
      .getByRole("button", {
        name: /submit ticket/i,
      })
      .click();

    await expect(
      page.getByText(
        /TKT-\d{4}-\d{6}/
      )
    ).toBeVisible();

    await page
      .getByRole("button", {
        name: /view ticket/i,
      })
      .click();

    await expect(page).toHaveURL(
      /\/tickets\/\d+$/
    );

    const ownedTicketUrl = page.url();

    await expect(
      page.getByText(
        ticketSummary,
        {
          exact: true,
        }
      )
    ).toBeVisible();

    /*
     * Requesters must never see the
     * staff-only Internal Notes section.
     */
    await expect(
      page.getByText(
        /internal notes/i
      )
    ).toHaveCount(0);

    /*
     * Upload attachment.
     */
    const attachmentInput =
      page.locator(
        "#attachment-file"
      );

    await attachmentInput.setInputFiles({
      name: E2E_ATTACHMENT_NAME,
      mimeType: "image/png",
      buffer: E2E_PNG,
    });

    await expect(
      page.getByText(
        E2E_ATTACHMENT_NAME,
        {
          exact: true,
        }
      )
    ).toBeVisible();

    await expect(
      page.getByRole("heading", {
        name: /Attachments \(1\/5\)/i,
      })
    ).toBeVisible();

    /*
     * Download attachment.
     */
    const downloadPromise =
      page.waitForEvent("download");

    await page
      .getByRole("button", {
        name: "Download",
        exact: true,
      })
      .click();

    const download =
      await downloadPromise;

    expect(
      download.suggestedFilename()
    ).toBe(E2E_ATTACHMENT_NAME);

    /*
     * Remove attachment with the required
     * removal reason.
     */
    page.once(
      "dialog",
      async (dialog) => {
        expect(
          dialog.type()
        ).toBe("prompt");

        await dialog.accept(
          E2E_REMOVAL_REASON
        );
      }
    );

    await page
      .getByRole("button", {
        name: "Remove",
        exact: true,
      })
      .click();

    await expect(
      page.getByText(
        `Removed — ${E2E_REMOVAL_REASON}`,
        {
          exact: true,
        }
      )
    ).toBeVisible();

    await expect(
      page.getByRole("heading", {
        name: /Attachments \(0\/5\)/i,
      })
    ).toBeVisible();

    /*
     * Removed attachment remains visible
     * as history but has no active actions.
     */
    await expect(
      page.getByText(
        E2E_ATTACHMENT_NAME,
        {
          exact: true,
        }
      )
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Download",
        exact: true,
      })
    ).toHaveCount(0);

    await expect(
      page.getByRole("button", {
        name: "Remove",
        exact: true,
      })
    ).toHaveCount(0);

    /*
     * Public Comments.
     */
    await expect(
      page.getByRole("heading", {
        name: /public comments/i,
      })
    ).toBeVisible();

    const commentBox =
      page
        .getByLabel(/comment/i)
        .last();

    await commentBox.fill(
      "Requester public comment from E2E."
    );

    await page
      .getByRole("button", {
        name: /post comment/i,
      })
      .click();

    await expect(
      page.getByText(
        "Requester public comment from E2E."
      )
    ).toBeVisible();

    /*
     * Requester resolution indication.
     */
    const resolved =
      page.getByRole(
        "button",
        {
          name:
            "Problem Appears Resolved",
          exact: true,
        }
      );

    await expect(
      resolved
    ).toBeVisible();

    await resolved.click();

    await expect(
      page
        .getByText(
          /appears resolved/i
        )
        .first()
    ).toBeVisible();

    /*
     * Capture the owning Requester's ticket
     * detail before testing cross-requester
     * privacy.
     */
    await page.screenshot({
      path: screenshotPath(
        testInfo,
        "requester-ticket-detail"
      ),
      fullPage: false,
    });

    /*
     * Ownership/privacy regression:
     * a different Requester must not be able
     * to access this Requester's ticket.
     */
    await logout(page);

    await login(
      page,
      USERS.otherRequester.email
    );

    await expect(page).toHaveURL(
      /\/tickets$/
    );

    await page.goto(ownedTicketUrl);

    await expect(
      page.getByRole("alert")
    ).toContainText(
      "This ticket doesn't exist or isn't available."
    );

    /*
     * Do not reveal the other Requester's
     * ticket content on the unavailable page.
     */
    await expect(
      page.getByText(
        ticketSummary,
        {
          exact: true,
        }
      )
    ).toHaveCount(0);

    await expect(
      page.getByText(
        E2E_ATTACHMENT_NAME,
        {
          exact: true,
        }
      )
    ).toHaveCount(0);
  }
);
