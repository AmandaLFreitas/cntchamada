// Tool files are bundled into a Deno Edge Function where `process.env` is
// polyfilled by Supabase's edge runtime. Provide a local type shim so the
// Vite/TS frontend build succeeds without pulling in @types/node globally.
declare const process: {
  env: Record<string, string | undefined>;
};
