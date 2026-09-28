"use client";

import { useAuth } from "./AuthProvider";

export default function Home() {
  const { user, signOut } = useAuth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-black px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
        <span className="text-red-600">Pre-Plan</span> App
      </h1>
      <p className="text-sm text-zinc-500">Offline building info for fire crews</p>

      <p className="mt-8 text-xs text-zinc-600">Signed in as {user?.email}</p>
      <button
        type="button"
        onClick={signOut}
        className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
      >
        Sign out
      </button>
    </main>
  );
}
