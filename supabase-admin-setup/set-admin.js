const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://wzpxxlkfxymelrodjarl.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6cHh4bGtmeHltZWxyb2RqYXJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njc1MzE2NywiZXhwIjoyMDgyMzI5MTY3fQ.gKsKxq9eM-hLhP5hRtSO0J-UPGewf2v4YTL7fKXa_nY";
const USER_ID = "f1116320-e3d4-46a9-9dee-e42301ab5736"; // tuo utente

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase.auth.admin.updateUserById(USER_ID, {
    app_metadata: { role: "admin" },
  });

  console.log("RESULT:", { data, error });
}

main();
