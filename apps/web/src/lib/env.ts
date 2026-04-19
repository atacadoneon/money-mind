/** Base URL da API Nest (inclui /api/v1). Alinhar com API_PORT (default 3333) no backend. */
export const env = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api/v1",
};
