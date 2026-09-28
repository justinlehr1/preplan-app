"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext(null);

// A signed-in crew member may stay offline for at most this long. After it,
// the app forces a fresh online login. This is the backstop for a lost phone.
const MAX_OFFLINE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Timestamp (ms) of the last time we confirmed this login against the server.
const LAST_VERIFIED_KEY = "preplan-last-verified";

// Cached responses whose name starts with this are app CODE (no secrets) and
// must survive sign-out so the login screen still loads with no signal.
// Anything else (future building-data caches) is wiped on sign-out.
const SHELL_CACHE_PREFIX = "preplan-cache";

// Supabase stores the session in the browser under a key derived from the
// project ref. Reading it directly lets us recognise an already-signed-in
// crew member who currently has no signal to re-verify.
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

// Wipe every trace of sensitive data from this device, keeping only the
// app-shell code so the login screen still works offline.
async function purgeDeviceData() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // ignore — we clear storage below regardless
  }
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
  // Structured storage — where building data and photos will live later.
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
  // Cached responses — delete everything except the app-shell code.
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

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function forceReauth() {
      await purgeDeviceData();
      if (active) setSession(null);
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

      // Enforce the 7-day offline limit before trusting a stored login.
      if (current && isOfflineExpired()) {
        await forceReauth();
        return;
      }

      setSession(current);
      if (current && navigator.onLine) markVerified();
      setLoading(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      if (event === "SIGNED_OUT") {
        // Only an explicit sign-out or a revoked/invalid session clears us.
        setSession(null);
      } else if (nextSession) {
        setSession(nextSession);
        // A session confirmed while online resets the offline clock.
        if (navigator.onLine) markVerified();
      }
      // A null session from a background token-refresh failure is ignored on
      // purpose: it must never boot a firefighter out of the app at a scene.

      setLoading(false);
    });

    // Reaching the internet again: re-check the offline limit, then re-verify.
    async function handleOnline() {
      if (!active) return;
      if (isOfflineExpired()) {
        await forceReauth();
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        if (active && data.session) {
          setSession(data.session);
          markVerified();
        }
      } catch {
        // still effectively offline — leave the session as-is
      }
    }

    // App brought back to the foreground: a lost phone that has sat past the
    // limit gets wiped here even if it is still offline.
    function handleVisible() {
      if (document.visibilityState === "visible" && isOfflineExpired()) {
        forceReauth();
      }
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
      await purgeDeviceData();
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
