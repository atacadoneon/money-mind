import axios, { AxiosError, type AxiosInstance } from "axios";
import { env } from "@/lib/env";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export const api: AxiosInstance = axios.create({
  baseURL: env.API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000
});

api.interceptors.request.use(async (config) => {
  if (typeof window !== "undefined") {
    try {
      let token: string | null = null;

      if (env.SUPABASE_URL) {
        const supabase = createSupabaseBrowser();
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token ?? null;
      } else {
        token = window.localStorage.getItem("mm:dev-token");
      }

      if (token) config.headers.set("Authorization", `Bearer ${token}`);

      const orgId = window.localStorage.getItem("mm:orgId");
      if (orgId) config.headers.set("x-org-id", orgId);
    } catch {
      /* ignore */
    }
  }

  if (config.params) {
    const p = config.params as Record<string, unknown>;
    if (p.pageSize != null && p.limit == null) {
      p.limit = p.pageSize;
      delete p.pageSize;
    }
    if (p.sortBy != null && p.order_by == null) {
      p.order_by = p.sortBy;
      delete p.sortBy;
    }
    if (p.sortDir != null && p.order_dir == null) {
      p.order_dir = p.sortDir;
      delete p.sortDir;
    }
    if (p.situacao === "todas") {
      delete p.situacao;
    }
    if (p.status === "todas") {
      delete p.status;
    }
    if (p.vencimentoFrom != null && p.vencimento_de == null) {
      p.vencimento_de = p.vencimentoFrom;
      delete p.vencimentoFrom;
    }
    if (p.vencimentoTo != null && p.vencimento_ate == null) {
      p.vencimento_ate = p.vencimentoTo;
      delete p.vencimentoTo;
    }
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ message?: string }>) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      // TODO: disparar refresh de sessão / redirect login
    }
    return Promise.reject(err);
  }
);

export type ApiError = {
  message: string;
  status?: number;
};

export function extractApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    return {
      message: err.response?.data?.message ?? err.message,
      status: err.response?.status
    };
  }
  return { message: (err as Error)?.message ?? "Erro desconhecido" };
}
