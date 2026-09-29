"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext(null);

// A signed-in crew member may stay offline for at most this long before a fresh
// online login is required. Backstop for a lost phone.
const MAX_OFFLINE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const LAST_VERIFIED_KEY = "preplan-last-verified"; // ms of last SERVER-confirmed login
const SIGNOUT_REASON_KEY = "preplan-signout-reason"; // why the last auto sign-out happened

// App CODE caches (no secrets) — kept on sign-out so login still loads offline.
// Any future building-DATA cache must NOT start with this, so it gets wiped.
const SHELL_CACHE_PREFIX = "preplan-cache";

// The ONLY error codes that mean "this account/session is genuinely gone" and
// justify wiping the device. Everything else (expired token, refresh race,
// timeout, rate limit, offline) is treated as transient and never wipes.
const REVOCATION_CODES = new Set([
  "user_not_found",
  "user_banned",
  "session_not_found",
  "refresh_token_not_found",
]);

const RETRY_DELAYS_MS = [800, 2000]; // backoff between verification attempts

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    // ignore
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

function setSignoutReason(reason) {
  try {
    window.localStorage.setItem(SIGNOUT_REASON_KEY, reason);
  } catch {
    // ignore
  }
}

// A transient failure means "couldn't reach/verify the server right now" — keep
// the session and try again later. NEVER a reason to wipe.
function isTransientError(error) {
  if (!error) return true;
  const name = error.name;
  if (
    name === "AuthRetryableFetchError" || // network/connectivity
    name === "AuthRefreshDiscardedError" || // a concurrent refresh won the race
    name === "AuthSessionMissingError" // nothing to refresh right now
  ) {
    return true;
  }
  const status = typeof error.status === "number" ? error.status : null;
  if (status === null || status === 0) return true; // unknown -> treat as network
  if (status >= 500 || status === 408 || status === 429) return true; // server/timeout/rate-limit
  return false;
}

// Contacts the server to confirm the account is still valid. Refreshes the
// token first (with a short backoff so a not-yet-ready connection on reopen
// gets a chance), then double-checks with getUser. Returns:
//   "ok"            -> account confirmed; the 7-day clock is reset
//   "revoked:<code>"-> account genuinely gone; caller should wipe the device
//   "transient"     -> couldn't confirm (offline/expired/race); keep session
let verifyInFlight = null;
function verifyAccount() {
  if (verifyInFlight) return verifyInFlight; // single-flight: never race ourselves
  verifyInFlight = (async () => {
    try {
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        const { data, error } = await supabase.auth.refreshSession();

        if (!error && data?.session) {
          // Fresh token in hand — confirm the account isn't deleted/banned.
          try {
            const { error: userError } = await supabase.auth.getUser();
            if (userError && REVOCATION_CODES.has(userError.code)) {
              return `revoked:${userError.code}`;
            }
          } catch {
            // getUser network hiccup after a good refresh — still valid.
          }
          markVerified();
          return "ok";
        }

        if (error && REVOCATION_CODES.has(error.code)) {
          return `revoked:${error.code}`;
        }

        // Not confirmed and not a revocation: retry a couple of times for a
        // connection that isn't ready yet, otherwise keep the session as-is.
        if (attempt < RETRY_DELAYS_MS.length && isTransientError(error)) {
          await delay(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        return "transient";
      }
      return "transient";
    } finally {
      verifyInFlight = null;
    }
  })();
  return verifyInFlight;
}

// Wipe every trace of sensitive data, keeping only the app-shell CODE so the
// login screen still works offline.
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

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // Marks a sign-out we triggered on purpose, so the SIGNED_OUT event handler
  // knows not to treat it as a mysterious library sign-out.
  const intentionalRef = useRef(null);
  const lastVerifyAtRef = useRef(0);

  useEffect(() => {
    let active = true;

    // Wipe the device and drop to the login screen, recording why.
    async function wipeAndReauth(reason) {
      intentionalRef.current = reason;
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // ignore
      }
      await clearLocalData();
      setSignoutReason(reason); // set AFTER clearLocalData so it survives
      if (active) setSession(null);
      intentionalRef.current = null;
    }

    // Confirm the account with the server; wipe only on genuine revocation.
    async function verifyAndMaybeWipe() {
      if (!navigator.onLine) return; // clearly offline — rely on the 7-day cap
      const now = Date.now();
      if (now - lastVerifyAtRef.current < 15000) return; // don't hammer on rapid events
      lastVerifyAtRef.current = now;

      const result = await verifyAccount();
      if (!active) return;
      if (result.startsWith("revoked:")) {
        const code = result.slice("revoked:".length);
        await wipeAndReauth(`revoked: ${code}`);
      }
      // "ok" -> clock already reset; "transient" -> keep session, keep clock
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
        await wipeAndReauth("offline limit: no internet for 7 days");
        return;
      }

      setSession(current);
      setLoading(false);

      if (current) await verifyAndMaybeWipe();
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      if (event === "SIGNED_OUT") {
        if (intentionalRef.current) {
          // We initiated it (user tap, revocation, or offline limit); the
          // triggering code handles wiping and the reason.
          setSession(null);
          setLoading(false);
          return;
        }
        // Library-initiated sign-out we did NOT confirm as revocation (e.g. a
        // refresh-token race). Do NOT wipe — just show the login screen.
        setSignoutReason(
          "Signed out: your session couldn’t be confirmed. Sign in again — short offline gaps are normal."
        );
        setSession(null);
        setLoading(false);
        return;
      }

      if (event === "SIGNED_IN") {
        try {
          window.localStorage.removeItem(SIGNOUT_REASON_KEY);
        } catch {
          // ignore
        }
      }

      if (nextSession) setSession(nextSession);
      setLoading(false);

      // SIGNED_IN and TOKEN_REFRESHED are real successful server contacts.
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && nextSession) {
        markVerified();
      }
    });

    async function handleOnline() {
      if (!active) return;
      if (isOfflineExpired()) {
        await wipeAndReauth("offline limit: no internet for 7 days");
        return;
      }
      await verifyAndMaybeWipe();
    }

    async function handleVisible() {
      if (document.visibilityState !== "visible") return;
      if (isOfflineExpired()) {
        await wipeAndReauth("offline limit: no internet for 7 days");
        return;
      }
      await verifyAndMaybeWipe();
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
      intentionalRef.current = "user";
      try {
        // Online: default (global) scope revokes the refresh token server-side.
        await supabase.auth.signOut(navigator.onLine ? {} : { scope: "local" });
      } catch {
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // ignore
        }
      }
      await clearLocalData();
      setSignoutReason("You signed out.");
      setSession(null);
      intentionalRef.current = null;
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
