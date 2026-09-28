// End-to-end check of Milestone 4A: signs in as a real user and confirms that
// department-scoped reads return the seeded buildings.
// Requires a throwaway account's credentials in .env.local:
//   TEST_EMAIL=...   TEST_PASSWORD=...
// Run with:  npm run check:buildings
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!url || !key) {
    console.error("❌ Missing Supabase env vars in .env.local");
    return 1;
  }
  if (!email || !password) {
    console.log("⏭  Skipped: set TEST_EMAIL and TEST_PASSWORD in .env.local to run this check.");
    return 0;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    console.error("❌ Sign-in failed:", signInError.message);
    return 2;
  }
  console.log("✅ Signed in as", email);

  const { data, error } = await supabase
    .from("buildings")
    .select("id, name, address, has_oxygen, department_id")
    .order("name");

  if (error) {
    console.error("❌ Read failed:", error.message);
    return 3;
  }

  console.log(`\nBuildings visible to this user: ${data.length}`);
  for (const b of data) {
    console.log(`  • ${b.name}  —  ${b.address}${b.has_oxygen ? "  [O2]" : ""}`);
  }

  const departments = new Set(data.map((b) => b.department_id));
  const allFake = data.every((b) => (b.name ?? "").startsWith("TEST"));

  console.log("\nChecks:");
  console.log(`  ${data.length >= 3 ? "✅" : "⚠️ "} at least 3 seeded buildings visible`);
  console.log(`  ${departments.size <= 1 ? "✅" : "❌"} all rows belong to a single department (scoping works)`);
  console.log(`  ${allFake ? "✅" : "⚠️ "} every visible building is clearly-fake TEST data`);

  await supabase.auth.signOut({ scope: "local" });
  return 0;
}

process.exitCode = await main();
