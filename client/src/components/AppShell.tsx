import {
  ReactNode,
  useState,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { zenGreen } from "../theme.js";

export default function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  const { user, logout } =
    useAuth();

  const location =
    useLocation();

  const navigate =
    useNavigate();

  const [
    menuOpen,
    setMenuOpen,
  ] = useState(false);

  const [
    mobileNavOpen,
    setMobileNavOpen,
  ] = useState(false);

  const isActive = (
    path: string
  ) =>
    location.pathname === path;

  const showRequesterNav =
    Boolean(user) &&
    user?.role === "REQUESTER" &&
    !user?.mustChangePassword;

  const showStaffNav = user?.role === "IT_STAFF" && !user.mustChangePassword;

  async function handleLogout() {
    setMenuOpen(false);
    setMobileNavOpen(false);

    await logout();

    navigate("/login", {
      replace: true,
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor:
          zenGreen.background,
      }}
    >
      <header
        style={{
          backgroundColor:
            zenGreen.primary,
        }}
      >
        <div
          className="container d-flex align-items-center justify-content-between"
          style={{ height: 56 }}
        >
          <Link
            to="/"
            className="d-flex align-items-center gap-2 text-white text-decoration-none fw-bold"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="white"
                strokeWidth="2"
              />

              <path
                d="M12 7v5l3 2"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>

            TokTickIT
          </Link>

          <nav className="d-none d-md-flex align-items-center gap-3">
            {showStaffNav && (
              <Link to="/staff/tickets" className="text-white text-decoration-none px-2 py-1 rounded" aria-current={isActive("/staff/tickets") ? "page" : undefined} style={{ backgroundColor: isActive("/staff/tickets") ? zenGreen.secondary : "transparent", fontWeight: 600 }}>
                Ticket Queue
              </Link>
            )}
            {showRequesterNav && (
              <>
                <Link
                  to="/tickets"
                  className="text-decoration-none px-2 py-1 rounded"
                  style={{
                    color: "white",
                    backgroundColor:
                      isActive(
                        "/tickets"
                      )
                        ? zenGreen.secondary
                        : "transparent",
                    fontWeight:
                      isActive(
                        "/tickets"
                      )
                        ? 600
                        : 400,
                  }}
                >
                  My Tickets
                </Link>

                <Link
                  to="/tickets/new"
                  className="btn btn-sm"
                  style={{
                    backgroundColor:
                      isActive(
                        "/tickets/new"
                      )
                        ? zenGreen.pale
                        : "white",
                    color:
                      zenGreen.primary,
                    fontWeight: 600,
                  }}
                >
                  + Create Ticket
                </Link>
              </>
            )}
          </nav>

          <div className="d-none d-md-block position-relative">
            {user ? (
              <>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    backgroundColor:
                      zenGreen.secondary,
                    color: "white",
                  }}
                  onClick={() =>
                    setMenuOpen(
                      (value) =>
                        !value
                    )
                  }
                  aria-expanded={
                    menuOpen
                  }
                >
                  {user.name} ▾
                </button>

                {menuOpen && (
                  <div
                    className="position-absolute end-0 mt-1 bg-white shadow rounded"
                    style={{
                      minWidth: 220,
                      zIndex: 10,
                    }}
                  >
                    <div className="px-3 py-2 border-bottom">
                      <div className="fw-semibold">
                        {user.name}
                      </div>

                      <div className="small text-muted">
                        {user.email}
                      </div>

                      <div className="small text-muted">
                        {user.role}
                      </div>
                    </div>

                    {!user.mustChangePassword && (
                      <Link
                        to="/change-password"
                        className="btn btn-sm w-100 text-start"
                        onClick={() =>
                          setMenuOpen(
                            false
                          )
                        }
                      >
                        Change Password
                      </Link>
                    )}

                    <button
                      type="button"
                      className="btn btn-sm w-100 text-start"
                      onClick={
                        handleLogout
                      }
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </>
            ) : (
              <span className="text-white-50 small">
                Not signed in
              </span>
            )}
          </div>

          <button
            type="button"
            className="btn btn-sm d-md-none"
            style={{
              color: "white",
            }}
            onClick={() =>
              setMobileNavOpen(
                (value) =>
                  !value
              )
            }
            aria-expanded={
              mobileNavOpen
            }
            aria-label="Toggle navigation"
          >
            ☰
          </button>
        </div>

        {mobileNavOpen && (
          <div
            className="d-md-none px-3 pb-3"
            style={{
              backgroundColor:
                zenGreen.primary,
            }}
          >
            {user ? (
              <div className="d-flex flex-column gap-2">
                {showStaffNav && (
                  <Link to="/staff/tickets" className="text-white text-decoration-none" aria-current={isActive("/staff/tickets") ? "page" : undefined} onClick={() => setMobileNavOpen(false)}>
                    Ticket Queue
                  </Link>
                )}
                {showRequesterNav && (
                  <>
                    <Link
                      to="/tickets"
                      className="text-white text-decoration-none"
                      onClick={() =>
                        setMobileNavOpen(
                          false
                        )
                      }
                    >
                      My Tickets
                    </Link>

                    <Link
                      to="/tickets/new"
                      className="text-white text-decoration-none"
                      onClick={() =>
                        setMobileNavOpen(
                          false
                        )
                      }
                    >
                      + Create Ticket
                    </Link>
                  </>
                )}

                <span className="text-white-50 small">
                  {user.name} ·{" "}
                  {user.role}
                </span>

                {!user.mustChangePassword && (
                  <Link
                    to="/change-password"
                    className="btn btn-sm btn-light"
                    onClick={() =>
                      setMobileNavOpen(
                        false
                      )
                    }
                  >
                    Change Password
                  </Link>
                )}

                <button
                  type="button"
                  className="btn btn-sm btn-light"
                  onClick={
                    handleLogout
                  }
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <span className="text-white-50 small">
                Not signed in
              </span>
            )}
          </div>
        )}
      </header>

      <main>{children}</main>
    </div>
  );
}
