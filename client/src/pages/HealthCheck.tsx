import { useState } from "react";
import { checkSystem, Category } from "../api.js";

type UiState = "idle" | "loading" | "success" | "error";

// Lab 1's "Check System" demo, preserved as its own route (/dev-check) now
// that App.tsx has become the Lab 2 router shell.
export default function HealthCheck() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleCheck() {
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
        <>
          <p className="mt-3 text-success">Online — backend is reachable.</p>
          <ul className="list-group mt-2">
            {categories.map((category) => (
              <li key={category.id} className="list-group-item">
                {category.name}
              </li>
            ))}
          </ul>
        </>
      )}
      {state === "error" && <p className="mt-3 text-danger">Offline — {errorMessage}</p>}
    </div>
  );
}
