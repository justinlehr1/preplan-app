// Connection test for the Pre-Plan App database.
// Run it with:  npm run check:db
import { createClient } from "@supabase/supabase-js";

const REQUIRED_COLUMNS =
  "id,address,name,building_type,construction_type,stories,has_oxygen,medical_notes," +
  "hazards,access_codes,utility_shutoffs,emergency_contacts,layout_notes,photo_urls," +
  "created_at,updated_at";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.error("❌ Missing environment variables. Expected them in .env.local");
    return 1;
  }

  console.log("Project URL :", url);
  console.log(
    "Key type    :",
    key.startsWith("sb_publishable_") ? "publishable (browser-safe)" : "unknown"
  );

  const supabase = createClient(url, key);

  const { error, count } = await supabase
    .from("buildings")
    .select("*", { count: "exact" })
    .limit(1);

  if (error) {
    console.error("\n❌ Could not read the buildings table.");
    console.error("   Code    :", error.code ?? "(none)");
    console.error("   Message :", error.message);
    if (error.code === "PGRST205" || /schema cache|does not exist/i.test(error.message)) {
      console.error("\n   Diagnosis: reached Supabase successfully, but the table does not exist yet.");
      console.error("   Fix: run supabase/schema.sql in the Supabase SQL Editor.");
    }
    return 2;
  }

  console.log("\n✅ Connected to Supabase and read the buildings table.");
  console.log("   Rows currently stored:", count);

  const { error: columnError } = await supabase
    .from("buildings")
    .select(REQUIRED_COLUMNS)
    .limit(1);

  if (columnError) {
    console.error("\n⚠️  Table exists but a column is missing or misnamed.");
    console.error("   Message :", columnError.message);
    return 3;
  }

  console.log("✅ All 13 required columns (plus id/created_at/updated_at) verified present.");
  return 0;
}

process.exitCode = await main();
