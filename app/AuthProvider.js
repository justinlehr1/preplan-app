"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext(null);

// A signed-in crew member may stay offline for at most this long. After it, the
// app forces a fresh online login. This is the backstop for a lost phone.
//
// ⚠️ TEMPORARY TEST VALUE — 3 minutes so the lock-out can be watched on a phone.
//    Revert to 7 days before real use:  7 * 24 * 60 * 60 * 1000
const MAX_OFFLINE_MS = 3 * 60 * 1000; // 3 minutes (TEST)

// Timestamp (ms) of the last time the SERVER confirmed this login.
const LAST_VERIFIED_KEY = "preplan-last-verified";

// Cached responses whose name starts with this are app CODE (no secrets) and
// must survive sign-out so the login screen still loads with no signal.
// Any future building-data cache MUST use a different name (e.g. "preplan-data")
// so that clearLocalData() below deletes it on sign-out.
const SHELL_CACHE_PREFIX = "preplan-cache";

function sessionStorageKey() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const projectRef = url.replace(/^https?:\/\//, "").split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

function readStoredSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(sessionStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const stored = parsed?.currentSession ?? parsed;
    return stored?.user ? stored : null;
  } catch {
    return null;
  }
}

function markVerified() {
  try {
    window.localStorage.setItem(LAST_VERIFIED_KEY, String(Date.now()));
  } catch {
    // ignore storage errors
  }
}

function isOfflineExpired() {
  try {
    const raw = window.localStorage.getItem(LAST_VERIFIED_KEY);
    if (!raw) return false; // never recorded yet — don't lock anyone out
    return Date.now() - Number(raw) > MAX_OFFLINE_MS;
  } catch {
    return false;
  }
}

// True only when the error is a real server rejection of the token/user
// (deleted, disabled, invalid) — NOT a connectivity problem.
function isAuthError(error) {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return false; // network/connectivity
  const status = typeof error.status === "number" ? error.status : null;
  if (status === null || status === 0) return false; // unknown -> treat as network
  if (status >= 500) return false; // server-side hiccup, not the user's fault
  return status >= 400; // 400/401/403/404/422 -> token or user rejected
}

// Wipe every trace of sensitive data from this device, keeping only the
// app-shell CODE so the login screen still works offline.
async function clearLocalData() {
  try {
    window.localStorage.clear();
  } catch {
    // ignore
  }
  try {
    window.sessionStorage.clear();
  } catch {
    // ignore
  }
  try {
    if (window.indexedDB?.databases) {
      const dbs = await window.indexedDB.databases();
      await Promise.all(
        dbs.map((db) => (db?.name ? window.indexedDB.deleteDatabase(db.name) : null))
      );
    }
  } catch {
    // ignore
  }
  try {
    if (typeof caches !== "undefined") {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => !name.startsWith(SHELL_CACHE_PREFIX)).map((name) => caches.delete(name))
      );
    }
  } catch {
    // ignore
  }
}

// Actually contacts the server. getSession() first refreshes an expired token
// (a refresh failure for a revoked/deleted account surfaces as SIGNED_OUT and
// is purged by the listener). getUser() then confirms the account still exists.
// Returns "ok" | "invalid" | "network".
async function verifyWithServer() {
  try {
    await supabase.auth.getSession();
    const { data, error } = await supabase.auth.getUser();
    if (error) return isAuthError(error) ? "invalid" : "network";
    if (data?.user) {
      markVerified(); // the only place the 7-day clock is reset
      return "ok";
    }
    return "invalid";
  } catch {
    return "network";
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Revoked account, expired offline window, or explicit lock-out: wipe device.
    async function forceReauth() {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // ignore
      }
      await clearLocalData();
      if (active) setSession(null);
    }

    async function verifyOnline() {
      const result = await verifyWithServer();
      if (!active) return;
      if (result === "invalid") await forceReauth();
      // "network" -> keep session, do NOT reset the clock
      // "ok"      -> clock already reset inside verifyWithServer
    }

    async function init() {
      let current = null;
      try {
        const { data } = await supabase.auth.getSession();
        current = data.session;
      } catch {
        current = null;
      }
      if (!current) current = readStoredSession();
      if (!active) return;

      if (current && isOfflineExpired()) {
        await forceReauth();
        return;
      }

      setSession(current);
      setLoading(false);

      if (current && navigator.onLine) await verifyOnline();
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      // A definitive server sign-out (explicit, revoked user, invalid refresh
      // token) wipes the device — not just the in-memory session.
      if (event === "SIGNED_OUT") {
        clearLocalData();
        setSession(null);
        setLoading(false);
        return;
      }

      if (nextSession) setSession(nextSession);
      setLoading(false);

      // These events mean the server was just contacted successfully; confirm
      // the account with getUser (which is what resets the offline clock).
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && nextSession && navigator.onLine) {
        verifyOnline();
      }
    });

    // Reaching the internet again: re-check the offline limit, then re-verify.
    async function handleOnline() {
      if (!active) return;
      if (isOfflineExpired()) {
        await forceReauth();
        return;
      }
      await verifyOnline();
    }

    // App brought back to the foreground: enforce the offline limit (this wipes
    // a lost phone that has sat past the limit even while still offline) and,
    // when online, re-verify the account against the server.
    async function handleVisible() {
      if (document.visibilityState !== "visible") return;
      if (isOfflineExpired()) {
        await forceReauth();
        return;
      }
      if (navigator.onLine) await verifyOnline();
    }

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: async () => {
      try {
        // Online: default (global) scope revokes the refresh token on the
        // server so the account can't be resumed elsewhere. Offline: local only.
        await supabase.auth.signOut(navigator.onLine ? {} : { scope: "local" });
      } catch {
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // ignore
        }
      }
      await clearLocalData();
      setSession(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}
