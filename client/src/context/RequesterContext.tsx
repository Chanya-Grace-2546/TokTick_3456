import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Requester } from "../api.js";

const STORAGE_KEY = "toktickit.devRequester";

interface RequesterContextValue {
  requester: Requester | null;
  selectRequester: (requester: Requester) => void;
  changeRequester: () => void;
}

const RequesterContext = createContext<RequesterContextValue | undefined>(undefined);

export function RequesterProvider({ children }: { children: ReactNode }) {
  const [requester, setRequester] = useState<Requester | null>(() => {
    // BR-04: this is Lab 2 test scaffolding only, persisted to localStorage
    // purely so a page refresh doesn't lose the testing context — never
    // treated as a session or credential.
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Requester) : null;
  });

  useEffect(() => {
    if (requester) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(requester));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [requester]);

  function selectRequester(next: Requester) {
    setRequester(next);
  }

  // BR-06: changing the Requester clears the active identity so every
  // requester-scoped screen re-fetches for whoever is selected next.
  function changeRequester() {
    setRequester(null);
  }

  return (
    <RequesterContext.Provider value={{ requester, selectRequester, changeRequester }}>
      {children}
    </RequesterContext.Provider>
  );
}

export function useRequester() {
  const ctx = useContext(RequesterContext);
  if (!ctx) {
    throw new Error("useRequester must be used within a RequesterProvider");
  }
  return ctx;
}
