"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";

// Small account menu tucked in the header, so the main screen stays a list.
export default function AccountMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 active:bg-zinc-800"
      >
        Account
      </button>

      {open ? (
        <>
          {/* Tap anywhere else to close */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-xl"
          >
            <p className="text-xs uppercase tracking-wide text-zinc-500">Signed in as</p>
            <p className="mb-4 truncate text-sm text-white">{user?.email}</p>
            <button
              type="button"
              onClick={signOut}
              className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white active:bg-red-500"
            >
              Sign out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
