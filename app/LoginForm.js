"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";

function friendlyError(message) {
  if (/invalid login credentials/i.test(message)) {
    return "Wrong email or password.";
  }
  if (/failed to fetch|network|offline/i.test(message)) {
    return "No connection. You must sign in once with signal before the app can be used offline.";
  }
  if (/email not confirmed/i.test(message)) {
    return "This account is not confirmed yet. Ask an admin to enable it in Supabase.";
  }
  return message;
}

export default function LoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: signInError } = await signIn(email.trim(), password);

    if (signInError) {
      setError(friendlyError(signInError.message));
      setSubmitting(false);
    }
    // On success the auth listener swaps this screen out automatically.
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-black px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-3xl font-bold tracking-tight text-white">
          <span className="text-red-600">Pre-Plan</span> App
        </h1>
        <p className="mt-2 text-center text-sm text-zinc-500">
          Sign in to access building information
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-4 text-lg text-white placeholder-zinc-600 outline-none focus:border-red-600"
              placeholder="you@department.gov"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-300">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-4 text-lg text-white placeholder-zinc-600 outline-none focus:border-red-600"
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-200"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-lg bg-red-600 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Accounts are issued by your department. There is no public sign-up.
        </p>
      </div>
    </main>
  );
}
