import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchActiveRequesters, Requester } from "../api.js";
import { useRequester } from "../context/RequesterContext.js";

type ScreenState = "loading" | "empty" | "error" | "ready";

export default function RequesterSelection() {
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [state, setState] = useState<ScreenState>("loading");
  const { selectRequester } = useRequester();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    fetchActiveRequesters()
      .then((data) => {
        if (cancelled) return;
        if (data.length === 0) {
          setState("empty");
        } else {
          setRequesters(data);
          setState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleContinue() {
    const chosen = requesters.find((r) => String(r.id) === selectedId);
    if (!chosen) return;
    selectRequester(chosen);
    navigate("/tickets");
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-2">
        Tok<span className="text-success">TickIT</span>
      </h1>
      <h2 className="h5 text-muted mb-4">Select Development Requester</h2>

      {state === "loading" && (
        <p role="status" aria-live="polite">
          Loading Development Requesters…
        </p>
      )}

      {state === "empty" && (
        <p className="text-warning">
          No active Development Requesters are available right now.
        </p>
      )}

      {state === "error" && (
        <p role="alert" className="text-danger">
          We couldn't load the Development Requester list. Please try again.
        </p>
      )}

      {state === "ready" && (
        <>
          <p className="text-muted small">
            Choose a development requester to simulate the current requester
            context for Lab 2. This is for testing only and is not a login
            screen.
          </p>

          <div className="mb-3">
            <label htmlFor="dev-requester-select" className="form-label">
              Development Requester <span className="text-danger">*</span>
            </label>
            <select
              id="dev-requester-select"
              className="form-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="" disabled>
                Choose a requester…
              </option>
              {requesters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>


          <button
            type="button"
            className="btn btn-success"
            disabled={!selectedId}
            onClick={handleContinue}
          >
            Continue
          </button>
        </>
      )}
    </div>
  );
}
