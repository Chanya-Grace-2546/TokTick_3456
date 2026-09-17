import {
  FormEvent,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { changePassword } from "../api.js";
import { useAuth } from "../context/AuthContext.js";
import { zenGreen } from "../theme.js";

// Lab 3 Issue 3 — Forced initial-password change
export default function ChangePassword() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    setError("");

    if (newPassword !== confirmPassword) {
      setError(
        "New password and confirmation do not match."
      );
      return;
    }

    setSubmitting(true);

    try {
      await changePassword(
        currentPassword,
        newPassword
      );

      // The server invalidates all Sessions after a successful
      // password change, so the user must authenticate again.
      await logout().catch(() => {});

      navigate("/login", {
        replace: true,
      });
    } catch (error) {
      const code =
        error instanceof Error
          ? error.message
          : "CHANGE_PASSWORD_FAILED";

      if (code === "INVALID_CURRENT_PASSWORD") {
        setError("Current password is incorrect.");
      } else if (code === "PASSWORD_REUSE_NOT_ALLOWED") {
        setError(
          "New password must be different from your current password."
        );
      } else if (code === "INVALID_PASSWORD") {
        setError(
          "Password must be 10–72 characters and include uppercase, lowercase, number, and special character."
        );
      } else {
        setError(
          "Couldn't change your password. Please try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="container py-5"
      style={{ maxWidth: 500 }}
    >
      <div className="card shadow-sm">
        <div className="card-body p-4">
          <h1
            className="h4 mb-1"
            style={{ color: zenGreen.primary }}
          >
            Change Password
          </h1>

          <p className="text-muted mb-1">
            Signed in as {user?.name}.
          </p>

          {user?.mustChangePassword && (
            <p className="text-muted mb-4">
              You must change your initial password before
              continuing to TokTickIT.
            </p>
          )}

          {error && (
            <div
              className="alert alert-danger"
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label
                htmlFor="currentPassword"
                className="form-label"
              >
                Current Password
              </label>

              <input
                id="currentPassword"
                type="password"
                className="form-control"
                value={currentPassword}
                onChange={(event) =>
                  setCurrentPassword(event.target.value)
                }
                autoComplete="current-password"
                required
              />
            </div>

            <div className="mb-2">
              <label
                htmlFor="newPassword"
                className="form-label"
              >
                New Password
              </label>

              <input
                id="newPassword"
                type="password"
                className="form-control"
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(event.target.value)
                }
                autoComplete="new-password"
                required
              />
            </div>

            <p className="small text-muted">
              10–72 characters with uppercase, lowercase,
              number, and special character.
            </p>

            <div className="mb-4">
              <label
                htmlFor="confirmPassword"
                className="form-label"
              >
                Confirm New Password
              </label>

              <input
                id="confirmPassword"
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn w-100 text-white"
              style={{ backgroundColor: zenGreen.primary }}
              disabled={submitting}
            >
              {submitting
                ? "Changing password..."
                : "Change Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}