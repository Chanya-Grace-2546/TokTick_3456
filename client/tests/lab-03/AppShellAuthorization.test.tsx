import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  MemoryRouter,
} from "react-router-dom";
import AppShell from "../../src/components/AppShell.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import * as api from "../../src/api.js";

function user(
  role: api.UserRole,
  mustChangePassword = false
): api.AuthUser {
  return {
    id: 1,
    name: "Jennifer Anderson",
    email:
      "jennifer.anderson@example.com",
    role,
    isActive: true,
    mustChangePassword,
  };
}

function renderShell() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AppShell>
          <div>Page Content</div>
        </AppShell>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("AppShell role authorization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows Requester navigation to an authenticated Requester", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue(
      user("REQUESTER")
    );

    renderShell();

    await waitFor(() => {
      expect(
        screen.getByRole("link", {
          name: "My Tickets",
        })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("link", {
        name: /create ticket/i,
      })
    ).toBeInTheDocument();
  });

  it("does not show Requester navigation to IT Staff", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue(
      user("IT_STAFF")
    );

    renderShell();

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /jennifer anderson/i,
        })
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("link", {
        name: "My Tickets",
      })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("link", {
        name: /create ticket/i,
      })
    ).not.toBeInTheDocument();
  });

  it("does not show Requester navigation to an Administrator", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue(
      user("ADMINISTRATOR")
    );

    renderShell();

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /jennifer anderson/i,
        })
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("link", {
        name: "My Tickets",
      })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("link", {
        name: /create ticket/i,
      })
    ).not.toBeInTheDocument();
  });

  it("shows the authenticated user's name, email, and role", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue(
      user("IT_STAFF")
    );

    renderShell();

    const accountButton =
      await screen.findByRole(
        "button",
        {
          name: /jennifer anderson/i,
        }
      );

    fireEvent.click(accountButton);

    expect(
      screen.getByText(
        "jennifer.anderson@example.com"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("IT_STAFF")
    ).toBeInTheDocument();
  });

  it("hides normal Requester navigation while mandatory password change is required", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue(
      user("REQUESTER", true)
    );

    renderShell();

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /jennifer anderson/i,
        })
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("link", {
        name: "My Tickets",
      })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("link", {
        name: /create ticket/i,
      })
    ).not.toBeInTheDocument();
  });
});