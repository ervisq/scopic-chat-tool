import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { TOOLS, type ToolConfig } from "@/lib/tool-config";

interface ToolVisibilityContextValue {
  hiddenTools: Set<string>;
  visibleTools: ToolConfig[];
  isHidden: (toolName: string) => boolean;
  setHidden: (toolName: string, hidden: boolean) => Promise<void>;
  saving: boolean;
  error: string | null;
}

const ToolVisibilityContext = createContext<ToolVisibilityContextValue | null>(null);

interface ProviderProps {
  token: string | null;
  initialHiddenTools?: string[];
  children: ReactNode;
}

export function ToolVisibilityProvider({
  token,
  initialHiddenTools,
  children,
}: ProviderProps) {
  const [hiddenTools, setHiddenToolsState] = useState<Set<string>>(
    () => new Set(initialHiddenTools ?? []),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchedRef = useRef(false);
  const dirtyRef = useRef(false);
  const hiddenRef = useRef<Set<string>>(hiddenTools);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    hiddenRef.current = hiddenTools;
  }, [hiddenTools]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (inflightAbortRef.current) {
        inflightAbortRef.current.abort();
        inflightAbortRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!token) {
      fetchedRef.current = false;
      dirtyRef.current = false;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (inflightAbortRef.current) {
        inflightAbortRef.current.abort();
        inflightAbortRef.current = null;
      }
      const empty = new Set<string>();
      hiddenRef.current = empty;
      setHiddenToolsState(empty);
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    const ctrl = new AbortController();
    fetch(`${baseUrl}/api/account/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mountedRef.current) return;
        if (dirtyRef.current) return;
        if (data && Array.isArray(data.hiddenTools)) {
          const set = new Set<string>(data.hiddenTools);
          hiddenRef.current = set;
          setHiddenToolsState(set);
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [token, baseUrl]);

  const setHidden = useCallback(
    async (toolName: string, hidden: boolean) => {
      if (!token) return;
      dirtyRef.current = true;
      const next = new Set(hiddenRef.current);
      if (hidden) next.add(toolName);
      else next.delete(toolName);
      hiddenRef.current = next;
      setHiddenToolsState(next);
      setError(null);
      setSaving(true);

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        if (inflightAbortRef.current) {
          inflightAbortRef.current.abort();
        }
        const ctrl = new AbortController();
        inflightAbortRef.current = ctrl;
        const payload = Array.from(hiddenRef.current);
        try {
          const res = await fetch(`${baseUrl}/api/account/preferences`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ hiddenTools: payload }),
            signal: ctrl.signal,
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || "Failed to save");
          }
        } catch (e) {
          if ((e as { name?: string })?.name === "AbortError") return;
          if (mountedRef.current) {
            setError(e instanceof Error ? e.message : "Failed to save");
          }
        } finally {
          if (inflightAbortRef.current === ctrl) {
            inflightAbortRef.current = null;
            if (mountedRef.current) setSaving(false);
          }
        }
      }, 300);
    },
    [baseUrl, token],
  );

  const visibleTools = useMemo(
    () => TOOLS.filter((t) => !hiddenTools.has(t.name)),
    [hiddenTools],
  );

  const value = useMemo<ToolVisibilityContextValue>(
    () => ({
      hiddenTools,
      visibleTools,
      isHidden: (name: string) => hiddenTools.has(name),
      setHidden,
      saving,
      error,
    }),
    [hiddenTools, visibleTools, setHidden, saving, error],
  );

  return (
    <ToolVisibilityContext.Provider value={value}>
      {children}
    </ToolVisibilityContext.Provider>
  );
}

export function useToolVisibility(): ToolVisibilityContextValue {
  const ctx = useContext(ToolVisibilityContext);
  if (!ctx) {
    throw new Error(
      "useToolVisibility must be used within a ToolVisibilityProvider",
    );
  }
  return ctx;
}
