// Security test: behaves like a signed-out stranger with your public key
// and confirms the database refuses to give up or accept any data.
// Run it with:  npm run check:security
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.error("❌ Missing environment variables. Expected them in .env.local");
    return 1;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  let failures = 0;

  console.log("Acting as: signed-out visitor holding the public publishable key\n");

  // 1. A stranger must not be able to write data.
  const { data: inserted, error: insertError } = await supabase
    .from("buildings")
    .insert({ address: "SECURITY TEST — should never be saved" })
    .select();

  if (insertError) {
    console.log("✅ PASS  Write blocked  —", insertError.code ?? "", insertError.message);
  } else {
    console.error("❌ FAIL  Write SUCCEEDED. The table is NOT locked down.");
    console.error("         Row created:", inserted);
    failures++;
  }

  // 2. A stranger must not be able to read data.
  const { data: rows, error: readError } = await supabase.from("buildings").select("*");

  if (readError) {
    console.log("✅ PASS  Read blocked   —", readError.message);
  } else if (!rows || rows.length === 0) {
    console.log("✅ PASS  Read returned no data (Row Level Security hid everything)");
  } else {
    console.error(`❌ FAIL  Read returned ${rows.length} row(s) to a signed-out visitor.`);
    failures++;
  }

  // 3. A stranger must not be able to create themselves an account.
  const probeEmail = `security-probe-${Date.now()}@example.com`;
  const { error: signUpError } = await supabase.auth.signUp({
    email: probeEmail,
    password: `Tmp-${Math.random().toString(36).slice(2)}-7xZq!`,
  });

  if (signUpError) {
    console.log("✅ PASS  Sign-up blocked —", signUpError.message);
  } else {
    console.error("❌ FAIL  Public sign-up SUCCEEDED for", probeEmail);
    console.error("         Turn OFF 'Allow new users to sign up', then DELETE this user");
    console.error("         in Authentication -> Users.");
    failures++;
  }

  console.log(
    failures === 0
      ? "\n🔒 All security checks passed. Signed-out users can do nothing."
      : `\n⚠️  ${failures} security check(s) FAILED — see above.`
  );
  return failures === 0 ? 0 : 1;
}

process.exitCode = await main();
