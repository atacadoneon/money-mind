"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationCenter } from "./NotificationCenter";
import { useNotifications } from "@/hooks/useNotifications";

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const { unreadCount } = useNotifications();

  return (
    <>
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notificações${unreadCount > 0 ? ` — ${unreadCount} não lidas` : ""}`}
          onClick={() => setOpen(true)}
        >
          <Bell className="h-4 w-4" />
        </Button>
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9px] pointer-events-none"
            aria-hidden
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </div>
      <NotificationCenter open={open} onOpenChange={setOpen} />
    </>
  );
}
