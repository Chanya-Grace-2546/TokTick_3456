import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import {
  AuthProvider,
  useAuth,
} from "../../src/context/AuthContext.js";
import * as api from "../../src/api.js";

function TestConsumer() {
  const {
    user,
    loading,
    login,
    logout,
  } = useAuth();

  return (
    <div>
      <div data-testid="loading">
        {loading ? "loading" : "ready"}
      </div>

      <div data-testid="user">
        {user ? user.name : "none"}
      </div>

      <button
        onClick={() =>
          login(
            "jennifer@example.com",
            "ChangeMe1!"
          )
        }
      >
        Login
      </button>

      <button onClick={() => logout()}>
        Logout
      </button>
    </div>
  );
}

const requester: api.AuthUser = {
  id: 1,
  name: "Jennifer Anderson",
  email: "jennifer@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
};

describe("AuthContext", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("restores the authenticated user from /api/auth/me", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue(
      requester
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(
      screen.getByTestId("loading")
    ).toHaveTextContent("loading");

    await waitFor(() => {
      expect(
        screen.getByTestId("user")
      ).toHaveTextContent(
        "Jennifer Anderson"
      );
    });

    expect(
      screen.getByTestId("loading")
    ).toHaveTextContent("ready");
  });

  it("starts unauthenticated when /api/auth/me returns null", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue(
      null
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("loading")
      ).toHaveTextContent("ready");
    });

    expect(
      screen.getByTestId("user")
    ).toHaveTextContent("none");
  });

  it("stores the authenticated user after login", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue(
      null
    );

    const loginSpy = vi
      .spyOn(api, "login")
      .mockResolvedValue({
        user: requester,
      });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("loading")
      ).toHaveTextContent("ready");
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Login",
      })
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("user")
      ).toHaveTextContent(
        "Jennifer Anderson"
      );
    });

    expect(loginSpy).toHaveBeenCalledWith(
      "jennifer@example.com",
      "ChangeMe1!"
    );
  });

  it("clears the authenticated user after logout", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue(
      requester
    );

    const logoutSpy = vi
      .spyOn(api, "logout")
      .mockResolvedValue();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("user")
      ).toHaveTextContent(
        "Jennifer Anderson"
      );
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Logout",
      })
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("user")
      ).toHaveTextContent("none");
    });

    expect(logoutSpy).toHaveBeenCalled();
  });
});