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

// Access / alarm codes: the descriptive words stay small; the actual code
// numbers are rendered extra large and bold so they can be read at a glance.
function CodesField({ value }) {
  if (!value) return null;
  const parts = String(value).split(/(\d[\d\-\s]*\d|\d)/g);
  return (
    <section className="border-b border-zinc-800 px-5 py-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">
        Access / Alarm Codes
      </h2>
      <p className="mt-1 whitespace-pre-line text-lg leading-snug text-zinc-400">
        {parts.map((part, index) =>
          /\d/.test(part) ? (
            <span key={index} className="text-4xl font-extrabold tracking-wider text-white">
              {part}
            </span>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </p>
    </section>
  );
}

function formatStatus(status, notes) {
  const label = { yes: "Yes", no: "No", partial: "Partial" }[status] ?? status ?? "";
  if (label && notes) return `${label} — ${notes}`;
  return label || notes || "";
}

function buildMapsUrl(address) {
  const query = encodeURIComponent(address);
  const isApple =
    typeof navigator !== "undefined" && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
  return isApple
    ? `https://maps.apple.com/?q=${query}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export default function BuildingDetail() {
  const params = useParams();
  const id = params?.id;
  const [building, setBuilding] = useState(null);
  const [mapsUrl, setMapsUrl] = useState(null);
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
      else {
        setBuilding(data);
        if (data?.address) setMapsUrl(buildMapsUrl(data.address));
      }
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

  const sprinklers = building ? formatStatus(building.sprinklers_status, building.sprinklers_notes) : "";
  const standpipe = building ? formatStatus(building.standpipe_status, building.standpipe_notes) : "";
  const hasFireProtection =
    building &&
    [building.fdc_location, building.nearest_hydrant, sprinklers, standpipe, building.fire_alarm_panel].some(
      Boolean
    );

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
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 text-2xl text-sky-400 underline decoration-sky-700 underline-offset-4 active:text-sky-300"
              >
                <span aria-hidden="true">📍</span>
                {building.address}
              </a>
            ) : (
              <p className="mt-2 text-2xl text-zinc-300">{building.address}</p>
            )}
            <p className="mt-1 text-xs text-zinc-600">Tap the address for directions</p>
          </div>

          {building.has_oxygen ? (
            <div className="mx-5 my-3 rounded-lg bg-red-600 px-4 py-4 text-center text-2xl font-extrabold uppercase tracking-wide text-white">
              ⚠ Occupants on Oxygen
            </div>
          ) : null}

          {building.hazard_summary ? (
            <div className="mx-5 mb-3 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-lg font-bold leading-snug text-red-300">
              ⚠ {building.hazard_summary}
            </div>
          ) : null}

          <Field label="Type & Construction" value={typeLine} />
          <Field label="Medical Needs" value={building.medical_notes} danger />

          <CodesField value={building.access_codes} />

          {hasFireProtection ? (
            <div className="border-b border-zinc-800 bg-zinc-950 px-5 pt-5 pb-1">
              <h2 className="text-sm font-bold uppercase tracking-widest text-sky-400">
                Water & Fire Protection
              </h2>
            </div>
          ) : null}
          <Field label="FDC Location" value={building.fdc_location} />
          <Field label="Nearest Hydrant" value={building.nearest_hydrant} />
          <Field label="Sprinklers" value={sprinklers} />
          <Field label="Standpipe" value={standpipe} />
          <Field label="Fire Alarm Panel" value={building.fire_alarm_panel} />

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
