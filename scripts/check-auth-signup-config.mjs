import process from "node:process";

const urlValue = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const keyValue = String(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
const expectedRef = String(
  process.env.EXPECTED_SUPABASE_PROJECT_REF ?? process.env.SUPABASE_PROJECT_REF ?? "",
).trim();
const allowLocal = process.env.ALLOW_LOCAL_SUPABASE === "true";

function fail(message) {
  console.error(`auth signup preflight failed: ${message}`);
  process.exitCode = 1;
}

if (!urlValue || !keyValue) {
  fail("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required");
} else {
  let url;
  try {
    url = new URL(urlValue);
  } catch {
    fail("Supabase URL is invalid");
  }

  if (url) {
    const isRemote = url.protocol === "https:" && /^([a-z0-9-]+)\.supabase\.co$/i.test(url.hostname);
    const isLocal = allowLocal && (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      (url.protocol === "http:" || url.protocol === "https:");
    if (!isRemote && !isLocal) {
      fail("Supabase URL host is not an explicitly allowed project or local test host");
    } else {
      const ref = isRemote ? url.hostname.split(".")[0] : "local";
      if (expectedRef && expectedRef !== ref) {
        fail("configured Supabase project ref does not match the URL");
      } else {
        const endpoint = new URL("/auth/v1/settings", url);
        try {
          const response = await fetch(endpoint, {
            headers: {
              apikey: keyValue,
              Authorization: `Bearer ${keyValue}`,
            },
            cache: "no-store",
          });
          if (!response.ok) {
            fail(`Supabase Auth settings request returned HTTP ${response.status}`);
          } else {
            let settings;
            try {
              settings = await response.json();
            } catch {
              fail("Supabase Auth settings response was not JSON");
            }
            if (settings && settings.disable_signup !== true) {
              fail(`disable_signup must be true for project ${ref}`);
            } else if (settings) {
              console.log(`Auth signup preflight passed for project ${ref} (disable_signup=true)`);
            }
          }
        } catch {
          fail("Supabase Auth settings request could not be completed");
        }
      }
    }
  }
}

