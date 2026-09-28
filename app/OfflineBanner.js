"use client";

import { useEffect, useState } from "react";

/**
 * Tells the crew plainly when the phone has no signal, so nobody wonders
 * whether what they are looking at is current.
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-black"
    >
      Offline — showing saved information
    </div>
  );
}
