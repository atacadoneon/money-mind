"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { isSupabaseEnabled, createSupabaseBrowser } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth";

export interface Notification {
  id: string;
  tipo: "cobranca" | "sync" | "conciliacao" | "sistema";
  titulo: string;
  corpo: string;
  lida: boolean;
  url?: string | null;
  orgId: string;
  criadoEm: string;
}

const QUERY_KEY = ["notificacoes"] as const;

async function fetchNotifications(): Promise<Notification[]> {
  try {
    const { data } = await api.get<Notification[]>(
      "/notificacoes?unread_only=false&limit=50"
    );
    return data ?? [];
  } catch {
    return [];
  }
}

export function useNotifications() {
  const qc = useQueryClient();
  const orgId = useAuthStore((s) => s.orgId);

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchNotifications,
    staleTime: 60_000
  });

  React.useEffect(() => {
    if (!orgId || !isSupabaseEnabled) return;
    const supabase = createSupabaseBrowser();
    const channel = supabase
      .channel(`notificacoes:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `org_id=eq.${orgId}`
        },
        (payload) => {
          const notif = payload.new as Notification;
          qc.setQueryData<Notification[]>(QUERY_KEY, (prev) => {
            if (!prev) return [notif];
            return [notif, ...prev];
          });
          toast(notif.titulo, {
            description: notif.corpo
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, qc]);

  const unreadCount = (query.data ?? []).filter((n) => !n.lida).length;

  return { ...query, unreadCount };
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await api.patch(`/notificacoes/${id}/read`);
      } catch {
        /* ignore in dev */
      }
    },
    onSuccess: (_, id) => {
      qc.setQueryData<Notification[]>(QUERY_KEY, (prev) =>
        (prev ?? []).map((n) => (n.id === id ? { ...n, lida: true } : n))
      );
    }
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await api.post("/notificacoes/mark-all-read");
      } catch {
        /* ignore in dev */
      }
    },
    onSuccess: () => {
      qc.setQueryData<Notification[]>(QUERY_KEY, (prev) =>
        (prev ?? []).map((n) => ({ ...n, lida: true }))
      );
    }
  });
}
