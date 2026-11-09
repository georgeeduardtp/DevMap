// Set this before importing Next so development, build and production all opt out.
process.env.NEXT_TELEMETRY_DISABLED = "1";
await import("next/dist/bin/next");
