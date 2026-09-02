import { useNavigate } from "react-router-dom";
import { useRequester } from "../context/RequesterContext.js";

// FR-02 / BR-06: shows who the current testing identity is and lets the
// user switch it, re-scoping requester-owned screens on change.
export default function RequesterIndicator() {
  const { requester, changeRequester } = useRequester();
  const navigate = useNavigate();

  if (!requester) return null;

  function handleChange() {
    changeRequester();
    navigate("/");
  }

  return (
    <div className="d-flex justify-content-between align-items-center">
      <span className="text-muted">
        Signed in as <strong>{requester.name}</strong>
      </span>
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleChange}>
        Change Requester
      </button>
    </div>
  );
}
