import {
  FormEvent,
  useState,
} from "react";
import {
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { zenGreen } from "../theme.js";

export default function Login() {
  const {
    user,
    loading,
    login,
  } = useAuth();

  const navigate = useNavigate();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  if (loading) {
    return (
      <div className="container py-5 text-center">
        Loading...
      </div>
    );
  }

  if (user) {
    return (
      <Navigate
        to={
          user.mustChangePassword
            ? "/change-password"
            : "/"
        }
        replace
      />
    );
  }

  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      const loggedInUser =
        await login(
          email.trim(),
          password
        );

      if (
        loggedInUser.mustChangePassword
      ) {
        navigate(
          "/change-password",
          { replace: true }
        );
      } else {
        navigate("/", {
          replace: true,
        });
      }
    } catch (error) {
      const code =
        error instanceof Error
          ? error.message
          : "LOGIN_FAILED";

      if (
        code === "ACCOUNT_INACTIVE"
      ) {
        setError(
          "This account is inactive."
        );
      } else {
        setError(
          "Invalid email or password."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="container py-5"
      style={{ maxWidth: 460 }}
    >
      <div className="card shadow-sm">
        <div className="card-body p-4">
          <h1
            className="h4 mb-1"
            style={{
              color: zenGreen.primary,
            }}
          >
            Sign in to TokTickIT
          </h1>

          <p className="text-muted mb-4">
            Enter your email and
            password.
          </p>

          {error && (
            <div
              className="alert alert-danger"
              role="alert"
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
          >
            <div className="mb-3">
              <label
                htmlFor="email"
                className="form-label"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                className="form-control"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                autoComplete="email"
                required
              />
            </div>

            <div className="mb-4">
              <label
                htmlFor="password"
                className="form-label"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                className="form-control"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn w-100 text-white"
              style={{
                backgroundColor:
                  zenGreen.primary,
              }}
              disabled={submitting}
            >
              {submitting
                ? "Signing in..."
                : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}