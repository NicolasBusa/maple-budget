import { useEffect, useRef, useState } from "react";
import { db } from "./data";
import { defaults } from "./finance.mjs";
export function useAccount(id, demo) {
  const [data, setData] = useState(null),
    [status, setStatus] = useState("Carregando"),
    [error, setError] = useState(""),
    ref = useRef(null),
    busy = useRef(false);
  const key = "maple-v1-" + id;
  function cache(s) {
    localStorage.setItem(key, JSON.stringify(s));
  }
  async function remote() {
    const { data, error } = await db
      .from("maple_accounts")
      .select("data,version")
      .eq("user_id", id)
      .maybeSingle();
    if (error) throw error;
    return data
      ? { ...data, pending: false }
      : { data: defaults(), version: 0, pending: false };
  }
  async function flush() {
    if (demo || busy.current || !ref.current?.pending) return;
    if (!navigator.onLine) {
      setStatus("Pendente • sem internet");
      return;
    }
    busy.current = true;
    setError("");
    try {
      while (ref.current.pending) {
        setStatus("Salvando…");
        const sent = ref.current;
        const { data, error } = await db.rpc("save_maple_state", {
          payload: sent.data,
          expected_version: sent.version,
        });
        if (error) throw error;
        ref.current = {
          ...ref.current,
          version: data.version,
          pending: ref.current !== sent,
        };
        cache(ref.current);
      }
      setStatus("Salvo na nuvem");
    } catch (e) {
      setStatus(
        e.message.includes("SYNC_CONFLICT")
          ? "Conflito de sincronização"
          : "Sincronização pendente",
      );
      setError(
        e.message.includes("SYNC_CONFLICT")
          ? "Há alterações em outro aparelho. Exporte a cópia local antes de carregar a nuvem."
          : "Os dados estão neste aparelho. Tente sincronizar novamente com internet.",
      );
    } finally {
      busy.current = false;
    }
  }
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const local = JSON.parse(localStorage.getItem(key) || "null");
        if (demo) {
          ref.current = local || {
            data: defaults(),
            version: 0,
            pending: false,
          };
          setData(ref.current.data);
          setStatus("Demonstração");
          return;
        }
        let fresh;
        let reachedCloud = true;
        try {
          fresh = await remote();
        } catch (e) {
          if (!local) throw e;
          fresh = local;
          reachedCloud = false;
        }
        if (!alive) return;
        if (local?.pending) {
          ref.current = local;
          setData(local.data);
          if (fresh.version !== local.version) {
            setStatus("Conflito de sincronização");
            setError(
              "Há alterações em outro aparelho. Exporte sua cópia antes de carregar a nuvem.",
            );
            return;
          }
          void flush();
        } else {
          ref.current = fresh;
          setData(fresh.data);
          cache(fresh);
          setStatus(
            reachedCloud ? "Salvo na nuvem" : "Offline • neste aparelho",
          );
        }
      } catch (e) {
        setError(e.message);
        setStatus("Falha ao carregar");
      }
    }
    load();
    const online = async () => {
      if (demo) return;
      if (ref.current?.pending) {
        void flush();
        return;
      }
      const previous = ref.current;
      try {
        const fresh = await remote();
        if (alive && ref.current === previous) {
          ref.current = fresh;
          cache(fresh);
          setData(fresh.data);
          setStatus("Salvo na nuvem");
          setError("");
        }
      } catch {
        if (alive) setStatus("Offline • neste aparelho");
      }
    };
    addEventListener("online", online);
    return () => {
      alive = false;
      removeEventListener("online", online);
    };
  }, [id]);
  function change(fn) {
    const next = typeof fn === "function" ? fn(ref.current.data) : fn;
    const s = { ...ref.current, data: next, pending: !demo };
    cache(s);
    ref.current = s;
    setData(next);
    if (!demo) void flush();
  }
  async function reload() {
    if (busy.current) throw Error("Aguarde a sincronização.");
    const s = await remote();
    cache(s);
    ref.current = s;
    setData(s.data);
    setError("");
    setStatus("Salvo na nuvem");
  }
  return { data, status, error, change, retry: flush, reload };
}
