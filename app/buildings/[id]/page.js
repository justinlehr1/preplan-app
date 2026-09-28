"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

// One labelled section of the card. Hidden entirely when empty so the screen
// stays scannable. `danger` renders it in red for hazards / medical.
function Field({ label, value, danger }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <section className="border-b border-zinc-800 px-5 py-4">
      <h2
        className={`text-sm font-bold uppercase tracking-wide ${
          danger ? "text-red-500" : "text-zinc-500"
        }`}
      >
        {label}
      </h2>
      <p
        className={`mt-1 whitespace-pre-line text-2xl font-medium leading-snug ${
          danger ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </section>
  );
}

export default function BuildingDetail() {
  const params = useParams();
  const id = params?.id;
  const [building, setBuilding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      const { data, error: loadError } = await supabase
        .from("buildings")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      if (loadError) setError(loadError.message);
      else setBuilding(data);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const typeLine = building
    ? [
        building.building_type,
        building.construction_type,
        building.stories ? `${building.stories} stories` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <main className="flex flex-1 flex-col bg-black">
      <Link
        href="/"
        className="sticky top-0 z-10 flex items-center gap-3 border-b border-zinc-800 bg-black px-5 py-4 text-xl font-semibold text-white active:bg-zinc-900"
      >
        <span aria-hidden="true" className="text-2xl">
          ←
        </span>
        Back to list
      </Link>

      {loading ? (
        <p className="p-6 text-center text-zinc-500">Loading…</p>
      ) : error ? (
        <p className="p-6 text-center text-red-400">Couldn’t load building: {error}</p>
      ) : !building ? (
        <p className="p-6 text-center text-zinc-500">Building not found.</p>
      ) : (
        <div className="flex-1 overflow-y-auto pb-20">
          <div className="px-5 py-5">
            <h1 className="text-4xl font-extrabold leading-tight text-white">
              {building.name || building.address}
            </h1>
            {building.name ? (
              <p className="mt-2 text-2xl text-zinc-300">{building.address}</p>
            ) : null}
          </div>

          <Field label="Type & Construction" value={typeLine} />

          {building.has_oxygen ? (
            <div className="mx-5 my-3 rounded-lg bg-red-600 px-4 py-4 text-center text-2xl font-extrabold uppercase tracking-wide text-white">
              ⚠ Occupants on Oxygen
            </div>
          ) : null}
          <Field label="Medical Needs" value={building.medical_notes} danger />

          <Field label="Access / Alarm Codes" value={building.access_codes} />
          <Field label="Knox Box" value={building.knox_box} />
          <Field label="Hazards" value={building.hazards} danger />
          <Field label="Utility Shutoffs" value={building.utility_shutoffs} />
          <Field label="Notes" value={building.layout_notes} />
          <Field label="Emergency Contacts" value={building.emergency_contacts} />
        </div>
      )}
    </main>
  );
}
