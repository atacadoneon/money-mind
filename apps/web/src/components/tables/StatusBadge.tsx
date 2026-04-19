import { Badge } from "@/components/ui/badge";

const labels: Record<string, string> = {
  aberto: "Em aberto",
  pago: "Pago",
  recebido: "Recebido",
  parcial: "Parcial",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
  em_aberto: "Em aberto",
  emitida: "Emitida",
  paga: "Paga",
  recebida: "Recebida",
  atrasada: "Atrasada",
  cancelada: "Cancelada"
};

const variants: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "outline"> = {
  aberto: "secondary",
  pago: "success",
  recebido: "success",
  parcial: "warning",
  atrasado: "destructive",
  cancelado: "outline",
  em_aberto: "secondary",
  emitida: "default",
  paga: "success",
  recebida: "success",
  atrasada: "destructive",
  cancelada: "outline"
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={variants[status] ?? "outline"}>{labels[status] ?? status}</Badge>;
}
