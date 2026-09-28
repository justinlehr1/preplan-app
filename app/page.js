"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AccountMenu from "./AccountMenu";

export default function Home() {
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error: loadError } = await supabase
        .from("buildings")
        .select("id, name, address")
        .order("name", { ascending: true });
      if (!active) return;
      if (loadError) setError(loadError.message);
      else setBuildings(data ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return buildings;
    return buildings.filter(
      (b) =>
        (b.name ?? "").toLowerCase().includes(q) ||
        (b.address ?? "").toLowerCase().includes(q)
    );
  }, [buildings, query]);

  return (
    <main className="flex flex-1 flex-col bg-black">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h1 className="text-lg font-bold tracking-tight text-white">
          <span className="text-red-600">Pre-Plan</span> App
        </h1>
        <AccountMenu />
      </header>

      <div className="sticky top-0 z-10 border-b border-zinc-800 bg-black px-4 py-3">
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or address"
          autoCapitalize="none"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-4 text-lg text-white placeholder-zinc-500 outline-none focus:border-red-600"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-6 text-center text-zinc-500">Loading buildings…</p>
        ) : error ? (
          <p className="p-6 text-center text-red-400">Couldn’t load buildings: {error}</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-zinc-500">
            {query ? "No buildings match your search." : "No buildings yet."}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {filtered.map((building) => (
              <li key={building.id}>
                <Link
                  href={`/buildings/${building.id}`}
                  className="block px-4 py-5 active:bg-zinc-900"
                >
                  <div className="text-2xl font-semibold leading-tight text-white">
                    {building.name || building.address}
                  </div>
                  {building.name ? (
                    <div className="mt-1 text-base text-zinc-400">{building.address}</div>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
