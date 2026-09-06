import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useRequester } from "../context/RequesterContext.js";
import { zenGreen } from "../theme.js";

// Lab 2 — Application shell (handout §8: TokTickIT identity, My Tickets
// nav, Create Ticket nav, current Requester display, active-page
// indication, responsive mobile nav).
export default function AppShell({ children }: { children: ReactNode }) {
  const { requester, changeRequester } = useRequester();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  // The Selection screen should always look "signed out" visually, even if
  // a Requester happens to still be persisted from an earlier session —
  // otherwise the nav shows /tickets links while the picker below still
  // says "Choose a requester…", which is confusing.
  const onSelectionScreen = location.pathname === "/";
  const showAuthenticatedNav = Boolean(requester) && !onSelectionScreen;

  function handleChangeRequester() {
    setMenuOpen(false);
    changeRequester();
    navigate("/");
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: zenGreen.background }}>
      <header style={{ backgroundColor: zenGreen.primary }}>
        <div
          className="container d-flex align-items-center justify-content-between"
          style={{ height: 56 }}
        >
          <Link
            to="/"
            className="d-flex align-items-center gap-2 text-white text-decoration-none fw-bold"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" />
              <path d="M12 7v5l3 2" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            TokTickIT
          </Link>

          {/* Desktop nav */}
          <nav className="d-none d-md-flex align-items-center gap-3">
            {showAuthenticatedNav && (
              <>
                <Link
                  to="/tickets"
                  className="text-decoration-none px-2 py-1 rounded"
                  style={{
                    color: "white",
                    backgroundColor: isActive("/tickets") ? zenGreen.secondary : "transparent",
                    fontWeight: isActive("/tickets") ? 600 : 400,
                  }}
                >
                  My Tickets
                </Link>
                <Link
                  to="/tickets/new"
                  className="btn btn-sm"
                  style={{
                    backgroundColor: isActive("/tickets/new") ? zenGreen.pale : "white",
                    color: zenGreen.primary,
                    fontWeight: 600,
                  }}
                >
                  + Create Ticket
                </Link>
              </>
            )}
          </nav>

          {/* Requester / Profile area */}
          <div className="d-none d-md-block position-relative">
            {showAuthenticatedNav ? (
              <>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ backgroundColor: zenGreen.secondary, color: "white" }}
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-expanded={menuOpen}
                >
                  {requester?.name} ▾
                </button>
                {menuOpen && (
                  <div
                    className="position-absolute end-0 mt-1 bg-white shadow rounded"
                    style={{ minWidth: 180, zIndex: 10 }}
                  >
                    <button
                      type="button"
                      className="btn btn-sm w-100 text-start"
                      onClick={handleChangeRequester}
                    >
                      Change Requester
                    </button>
                  </div>
                )}
              </>
            ) : (
              <span className="text-white-50 small">Not signed in</span>
            )}
          </div>

          {/* Mobile nav toggle */}
          <button
            type="button"
            className="btn btn-sm d-md-none"
            style={{ color: "white" }}
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-expanded={mobileNavOpen}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
        </div>

        {/* Mobile nav panel */}
        {mobileNavOpen && (
          <div className="d-md-none px-3 pb-3" style={{ backgroundColor: zenGreen.primary }}>
            {showAuthenticatedNav ? (
              <div className="d-flex flex-column gap-2">
                <Link to="/tickets" className="text-white text-decoration-none">
                  My Tickets
                </Link>
                <Link to="/tickets/new" className="text-white text-decoration-none">
                  + Create Ticket
                </Link>
                <span className="text-white-50 small">{requester?.name}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-light"
                  onClick={handleChangeRequester}
                >
                  Change Requester
                </button>
              </div>
            ) : (
              <span className="text-white-50 small">Not signed in</span>
            )}
          </div>
        )}
      </header>

      <main>{children}</main>
    </div>
  );
}
