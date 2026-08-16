import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
const [categories, setCategories] = useState<Category[]>([]);
const [errorMessage, setErrorMessage] = useState("");
void categories;

  async function handleCheck() {
    // TODO(Issue 4): set loading, call checkSystem(), then either
    //   - success: store categories and show Online + the list, or
    //   - error: show Offline + a useful message.
    setState("loading");
    try {
    const result = await checkSystem();
    setCategories(result.categories);
    setState("success");
  } catch (err) {
    setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    setState("error");
  }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>
{state === "success" && (
  <p className="mt-3 text-success">Online — backend is reachable.</p>
)}
{state === "error" && (
  <p className="mt-3 text-danger">Offline — {errorMessage}</p>
)}
      {/* TODO(Issue 4): render loading / success (Online + categories) / error (Offline) states. */}
    </div>
  );
}
