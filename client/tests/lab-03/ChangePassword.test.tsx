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
import ChangePassword from "../../src/pages/ChangePassword.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import * as api from "../../src/api.js";

const requester: api.AuthUser = {
  id: 1,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: true,
};

const changedRequester: api.AuthUser = {
  ...requester,
  mustChangePassword: false,
};

function renderScreen() {
  return render(
    <MemoryRouter
      initialEntries={["/change-password"]}
    >
      <AuthProvider>
        <Routes>
          <Route
            path="/change-password"
            element={<ChangePassword />}
          />

          <Route
            path="/"
            element={<div>Application Home</div>}
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

async function fillForm(
  newPassword = "NewPassword1!",
  confirmPassword = "NewPassword1!"
) {
  await waitFor(() => {
    expect(
      screen.getByLabelText(
        /^new password/i
      )
    ).toBeInTheDocument();
  });

  fireEvent.change(
    screen.getByLabelText(
      /^new password/i
    ),
    {
      target: {
        value: newPassword,
      },
    }
  );

  fireEvent.change(
    screen.getByLabelText(
      /confirm new password/i
    ),
    {
      target: {
        value: confirmPassword,
      },
    }
  );
}

describe("ChangePassword", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(api, "getMe").mockResolvedValue(
      requester
    );
  });

  it("shows that the initial password must be changed", async () => {
    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByText(
          /must change your initial password/i
        )
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        /Jennifer Anderson/i
      )
    ).toBeInTheDocument();
  });

  it("rejects mismatched password confirmation before calling the API", async () => {
    const changeSpy = vi.spyOn(
      api,
      "changePassword"
    );

    renderScreen();

    await fillForm(
      "NewPassword1!",
      "DifferentPassword1!"
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /change password/i,
      })
    );

    expect(
      screen.getByRole("alert")
    ).toHaveTextContent(
      /do not match/i
    );

    expect(changeSpy).not.toHaveBeenCalled();
  });

  it("shows an error when the new password reuses the current password", async () => {
    vi.spyOn(
      api,
      "changePassword"
    ).mockRejectedValue(
      new Error(
        "NEW_PASSWORD_MUST_BE_DIFFERENT"
      )
    );

    renderScreen();

    await fillForm(
      "ChangeMe1!",
      "ChangeMe1!"
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /change password/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("alert")
      ).toHaveTextContent(
        /must be different/i
      );
    });
  });

  it("shows an error when the new password does not meet policy", async () => {
    vi.spyOn(
      api,
      "changePassword"
    ).mockRejectedValue(
      new Error(
        "PASSWORD_REQUIREMENTS_NOT_MET"
      )
    );

    renderScreen();

    await fillForm(
      "weakpassword",
      "weakpassword"
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /change password/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("alert")
      ).toHaveTextContent(
        /10–72 characters/i
      );
    });
  });

  it("changes the password, refreshes the authenticated user, and continues to the application", async () => {
    const changeSpy = vi
      .spyOn(api, "changePassword")
      .mockResolvedValue();

    const getMeSpy = vi.spyOn(api, "getMe");

    getMeSpy
      .mockResolvedValueOnce(requester)
      .mockResolvedValueOnce(changedRequester);

    const logoutSpy = vi
      .spyOn(api, "logout")
      .mockResolvedValue();

    renderScreen();
    await fillForm();

    fireEvent.click(
      screen.getByRole("button", {
        name: /change password/i,
      })
    );

    await waitFor(() => {
      expect(changeSpy).toHaveBeenCalledWith(
        "NewPassword1!",
        "NewPassword1!"
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText("Application Home")
      ).toBeInTheDocument();
    });

    expect(getMeSpy).toHaveBeenCalledTimes(2);
    expect(logoutSpy).not.toHaveBeenCalled();
  });

  it("disables the button while changing the password", async () => {
    vi.spyOn(
      api,
      "changePassword"
    ).mockReturnValue(
      new Promise(() => {})
    );

    renderScreen();
    await fillForm();

    fireEvent.click(
      screen.getByRole("button", {
        name: /change password/i,
      })
    );

    expect(
      screen.getByRole("button", {
        name: /changing password/i,
      })
    ).toBeDisabled();
  });
});