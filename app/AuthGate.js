"use client";

import { useAuth } from "./AuthProvider";
import LoginForm from "./LoginForm";

/**
 * Wraps the whole app. Nothing inside is rendered unless a session exists,
 * so no building data can appear on screen for a signed-out user.
 */
export default function AuthGate({ children }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center bg-black">
        <p className="text-sm text-zinc-600">Loading…</p>
      </main>
    );
  }

  if (!session) {
    return <LoginForm />;
  }

  return children;
}
