import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";
import Login from "../../src/pages/Login.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import * as api from "../../src/api.js";

function renderScreen() {
  return render(
    <MemoryRouter
      initialEntries={["/login"]}
    >
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/"
            element={<div>Home Screen</div>}
          />

          <Route
            path="/change-password"
            element={
              <div>Change Password Screen</div>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

function requester(
  mustChangePassword = false
): api.AuthUser {
  return {
    id: 1,
    name: "Jennifer Anderson",
    email: "jennifer@example.com",
    role: "REQUESTER",
    isActive: true,
    mustChangePassword,
  };
}

async function enterCredentials() {
  await waitFor(() => {
    expect(
      screen.getByLabelText(/email/i)
    ).toBeInTheDocument();
  });

  fireEvent.change(
    screen.getByLabelText(/email/i),
    {
      target: {
        value: "jennifer@example.com",
      },
    }
  );

  fireEvent.change(
    screen.getByLabelText(/password/i),
    {
      target: {
        value: "ChangeMe1!",
      },
    }
  );
}

describe("Login", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(api, "getMe").mockResolvedValue(
      null
    );
  });

  it("renders email and password fields", async () => {
    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByLabelText(/email/i)
      ).toBeInTheDocument();
    });

    expect(
      screen.getByLabelText(/password/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /sign in/i,
      })
    ).toBeInTheDocument();
  });

  it("logs in with the entered email and password", async () => {
    const loginSpy = vi
      .spyOn(api, "login")
      .mockResolvedValue({
        user: requester(false),
      });

    renderScreen();
    await enterCredentials();

    fireEvent.click(
      screen.getByRole("button", {
        name: /sign in/i,
      })
    );

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith(
        "jennifer@example.com",
        "ChangeMe1!"
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText("Home Screen")
      ).toBeInTheDocument();
    });
  });

  it("redirects to Change Password when the initial password must be changed", async () => {
    vi.spyOn(api, "login").mockResolvedValue({
      user: requester(true),
    });

    renderScreen();
    await enterCredentials();

    fireEvent.click(
      screen.getByRole("button", {
        name: /sign in/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Change Password Screen"
        )
      ).toBeInTheDocument();
    });
  });

  it("shows Invalid email or password for invalid credentials", async () => {
    vi.spyOn(api, "login").mockRejectedValue(
      new Error("INVALID_CREDENTIALS")
    );

    renderScreen();
    await enterCredentials();

    fireEvent.click(
      screen.getByRole("button", {
        name: /sign in/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("alert")
      ).toHaveTextContent(
        /invalid email or password/i
      );
    });
  });

  it("shows an inactive-account message", async () => {
    vi.spyOn(api, "login").mockRejectedValue(
      new Error("ACCOUNT_INACTIVE")
    );

    renderScreen();
    await enterCredentials();

    fireEvent.click(
      screen.getByRole("button", {
        name: /sign in/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("alert")
      ).toHaveTextContent(
        /account is inactive/i
      );
    });
  });

  it("disables Sign in while login is in progress", async () => {
    vi.spyOn(api, "login").mockReturnValue(
      new Promise(() => {})
    );

    renderScreen();
    await enterCredentials();

    fireEvent.click(
      screen.getByRole("button", {
        name: /sign in/i,
      })
    );

    expect(
      screen.getByRole("button", {
        name: /signing in/i,
      })
    ).toBeDisabled();
  });
});