"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  CheckCheck,
  CreditCard,
  RefreshCw,
  GitMerge,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type Notification
} from "@/hooks/useNotifications";

const TYPE_CONFIG: Record<
  Notification["tipo"],
  { icon: React.ElementType; color: string; label: string }
> = {
  cobranca: { icon: CreditCard, color: "text-blue-500", label: "Cobrança" },
  sync: { icon: RefreshCw, color: "text-orange-500", label: "Sync" },
  conciliacao: { icon: GitMerge, color: "text-purple-500", label: "Conciliação" },
  sistema: { icon: Info, color: "text-muted-foreground", label: "Sistema" }
};

function NotifRow({ notif, onRead }: { notif: Notification; onRead: (id: string) => void }) {
  const router = useRouter();
  const cfg = TYPE_CONFIG[notif.tipo];
  const Icon = cfg.icon;

  const handleClick = () => {
    if (!notif.lida) onRead(notif.id);
    if (notif.url) router.push(notif.url);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full flex items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted/60",
        !notif.lida && "bg-primary/5 hover:bg-primary/10"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted",
          cfg.color
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm leading-tight", !notif.lida && "font-semibold")}>
            {notif.titulo}
          </p>
          {!notif.lida && (
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Não lida" />
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground leading-snug line-clamp-2">
          {notif.corpo}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(notif.criadoEm), {
            addSuffix: true,
            locale: ptBR
          })}
        </p>
      </div>
    </button>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NotificationCenter({ open, onOpenChange }: Props) {
  const { data, unreadCount } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const all = data ?? [];
  const unread = all.filter((n) => !n.lida);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-96 p-0 flex flex-col">
        <SheetHeader className="flex flex-row items-center justify-between px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notificações
            {unreadCount > 0 && (
              <Badge variant="default" className="h-5 text-xs px-1.5">
                {unreadCount}
              </Badge>
            )}
          </SheetTitle>
          <div className="flex items-center gap-1 mr-6">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Marcar todas
              </Button>
            )}
          </div>
        </SheetHeader>

        <Tabs defaultValue="todas" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pt-2 border-b">
            <TabsList className="h-8">
              <TabsTrigger value="todas" className="text-xs">
                Todas ({all.length})
              </TabsTrigger>
              <TabsTrigger value="nao-lidas" className="text-xs">
                Não lidas ({unreadCount})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="todas" className="flex-1 overflow-y-auto p-2 space-y-0.5 mt-0">
            {all.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-30" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              all.map((n) => (
                <NotifRow key={n.id} notif={n} onRead={(id) => markRead.mutate(id)} />
              ))
            )}
          </TabsContent>

          <TabsContent value="nao-lidas" className="flex-1 overflow-y-auto p-2 space-y-0.5 mt-0">
            {unread.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <CheckCheck className="h-8 w-8 opacity-30" />
                <p className="text-sm">Tudo em dia!</p>
              </div>
            ) : (
              unread.map((n) => (
                <NotifRow key={n.id} notif={n} onRead={(id) => markRead.mutate(id)} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
