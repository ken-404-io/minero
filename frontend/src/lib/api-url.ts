// Browser-safe API URL with a dev fallback. Kept separate from `api.ts`
// because that module imports `next/headers`, which can't be used in Client
// Components.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
