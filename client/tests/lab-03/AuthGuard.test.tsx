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
  waitFor,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";
import AuthGuard from "../../src/components/AuthGuard.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import * as api from "../../src/api.js";

function renderGuard(
  roles?: api.UserRole[],
  allowPasswordChange = false
) {
  return render(
    <MemoryRouter
      initialEntries={["/protected"]}
    >
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={<div>Login Screen</div>}
          />

          <Route
            path="/change-password"
            element={
              <div>Change Password Screen</div>
            }
          />

          <Route
            path="/"
            element={<div>Home Screen</div>}
          />

          <Route
            path="/protected"
            element={
              <AuthGuard
                roles={roles}
                allowPasswordChange={
                  allowPasswordChange
                }
              >
                <div>Protected Screen</div>
              </AuthGuard>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

function user(
  overrides: Partial<api.AuthUser> = {}
): api.AuthUser {
  return {
    id: 1,
    name: "Jennifer Anderson",
    email: "jennifer@example.com",
    role: "REQUESTER",
    isActive: true,
    mustChangePassword: false,
    ...overrides,
  };
}

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects an unauthenticated user to Login", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue(
      null
    );

    renderGuard(["REQUESTER"]);

    await waitFor(() => {
      expect(
        screen.getByText("Login Screen")
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Protected Screen")
    ).not.toBeInTheDocument();
  });

  it("allows an authenticated user with the required role", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue(
      user()
    );

    renderGuard(["REQUESTER"]);

    await waitFor(() => {
      expect(
        screen.getByText("Protected Screen")
      ).toBeInTheDocument();
    });
  });

  it("redirects a user with the wrong role", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue(
      user({
        role: "IT_STAFF",
      })
    );

    renderGuard(["REQUESTER"]);

    await waitFor(() => {
      expect(
        screen.getByText("Home Screen")
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Protected Screen")
    ).not.toBeInTheDocument();
  });

  it("forces initial password change before protected business routes", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue(
      user({
        mustChangePassword: true,
      })
    );

    renderGuard(["REQUESTER"]);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Change Password Screen"
        )
      ).toBeInTheDocument();
    });
  });

  it("allows access to the password-change route while password change is required", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue(
      user({
        mustChangePassword: true,
      })
    );

    renderGuard(
      undefined,
      true
    );

    await waitFor(() => {
      expect(
        screen.getByText("Protected Screen")
      ).toBeInTheDocument();
    });
  });
});