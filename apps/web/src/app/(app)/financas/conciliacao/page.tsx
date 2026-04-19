"use client";

import * as React from "react";
import { GitMerge, X, Sparkles, CheckCircle2, FileSpreadsheet, Link2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable
} from "@dnd-kit/core";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { useExtratos, useExtratoLinhas } from "@/hooks/use-extratos";
import { useContasPagar } from "@/hooks/use-contas-pagar";
import { useContasReceber } from "@/hooks/use-contas-receber";
import {
  useConfirmMatch,
  useIgnoreMatch,
  useReconciliationSuggestions,
  useRunReconciliationIA
} from "@/hooks/use-reconciliation";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ExtratoLinha, ContaPagar, ContaReceber } from "@/types";

type TituloAberto =
  | (ContaPagar & { _tipo: "pagar" })
  | (ContaReceber & { _tipo: "receber" });

// -------------------------------------------------------
// Draggable extrato line
// -------------------------------------------------------
function DraggableLinhaCard({
  linha,
  onIgnore,
  suggestion,
  onConfirmSuggestion,
  isSelected,
  onClick
}: {
  linha: ExtratoLinha;
  onIgnore: (id: string) => void;
  suggestion?: { titleId: string; tipo: "pagar" | "receber"; confidence: number; descricaoLinha: string } | null;
  onConfirmSuggestion?: (linhaId: string, titleId: string, tipo: "pagar" | "receber") => void;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: linha.id,
    data: { linha }
  });
  const isDebito = linha.tipo === "debito";

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Don't trigger click when starting drag
        if (!isDragging) onClick();
        e.stopPropagation();
      }}
      className={cn(
        "rounded-md border p-3 text-sm space-y-2 cursor-grab active:cursor-grabbing select-none transition-all",
        isDragging && "opacity-50 scale-95",
        isSelected && "ring-2 ring-primary bg-primary/5",
        linha.status === "conciliado" && "opacity-40 cursor-default",
        linha.status === "ignorado" && "opacity-30 cursor-default"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 pointer-events-none">
          <p className="font-medium truncate">{linha.descricao}</p>
          <p className="text-xs text-muted-foreground">{formatDate(linha.data)}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0 pointer-events-none">
          <span className={`font-semibold ${isDebito ? "text-destructive" : "text-success"}`}>
            {isDebito ? "-" : "+"}
            {formatCurrency(linha.valor)}
          </span>
          <Badge
            variant={
              linha.status === "conciliado" ? "success" : linha.status === "ignorado" ? "outline" : "secondary"
            }
          >
            {linha.status === "conciliado" ? "Conciliada" : linha.status === "ignorado" ? "Ignorada" : "Pendente"}
          </Badge>
        </div>
      </div>

      {suggestion && linha.status === "pendente" && (
        <div className="rounded bg-primary/5 border border-primary/20 p-2 text-xs space-y-1">
          <div className="flex items-center gap-1 text-primary font-medium">
            <Sparkles className="h-3 w-3" />
            IA {Math.round(suggestion.confidence * 100)}% — {suggestion.descricaoLinha}
          </div>
          <div className="flex gap-1 pt-0.5" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              className="h-6 text-xs"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onConfirmSuggestion?.(linha.id, suggestion.titleId, suggestion.tipo);
              }}
            >
              <CheckCircle2 className="h-3 w-3" /> Aceitar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onIgnore(linha.id);
              }}
            >
              <X className="h-3 w-3" /> Ignorar
            </Button>
          </div>
        </div>
      )}

      {!suggestion && linha.status === "pendente" && (
        <div className="flex gap-1 pointer-events-none">
          <p className="text-xs text-muted-foreground">
            {isSelected ? "Clique em um título para vincular ou arraste-o" : "Clique ou arraste para conciliar"}
          </p>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Droppable titulo card
// -------------------------------------------------------
function DroppableTituloCard({
  titulo,
  isOver,
  onMatch,
  selectedLinhaId
}: {
  titulo: TituloAberto;
  isOver: boolean;
  onMatch: (titleId: string, tipo: "pagar" | "receber") => void;
  selectedLinhaId: string | null;
}) {
  const { setNodeRef } = useDroppable({
    id: `titulo-${titulo._tipo}-${titulo.id}`,
    data: { titulo }
  });

  const isPagar = titulo._tipo === "pagar";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md border p-3 text-sm space-y-1 transition-all",
        isOver && "ring-2 ring-primary bg-primary/5 scale-[1.01]",
        selectedLinhaId && "cursor-pointer hover:bg-muted/50",
        !selectedLinhaId && !isOver && "hover:bg-muted/20"
      )}
      onClick={() => {
        if (selectedLinhaId) onMatch(titulo.id, titulo._tipo);
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate">{titulo.historico}</p>
          <p className="text-xs text-muted-foreground">
            {titulo.contatoNome ?? "-"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="font-semibold">{formatCurrency(titulo.valor)}</span>
          <span className="text-xs text-muted-foreground">Venc. {formatDate(titulo.dataVencimento)}</span>
        </div>
      </div>
      {(selectedLinhaId || isOver) && (
        <Badge variant="outline" className="text-xs">
          <Link2 className="h-3 w-3 mr-1" />
          {isOver ? "Solte para vincular" : "Clique para vincular"}
        </Badge>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Confirm match dialog
// -------------------------------------------------------
function ConfirmMatchDialog({
  open,
  onOpenChange,
  linha,
  titulo,
  onConfirm
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  linha: ExtratoLinha | null;
  titulo: TituloAberto | null;
  onConfirm: () => void;
}) {
  if (!linha || !titulo) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar conciliação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md border p-3 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Linha do extrato</p>
            <p className="font-medium">{linha.descricao}</p>
            <p className="text-muted-foreground">{formatDate(linha.data)} — {formatCurrency(linha.valor)}</p>
          </div>
          <div className="flex justify-center">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <div className="rounded-md border p-3 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">
              {titulo._tipo === "pagar" ? "Conta a pagar" : "Conta a receber"}
            </p>
            <p className="font-medium">{titulo.historico}</p>
            <p className="text-muted-foreground">
              {titulo.contatoNome ?? "-"}{" "}
              — {formatCurrency(titulo.valor)}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirm}>
            <CheckCircle2 className="h-4 w-4" /> Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------
// Main page
// -------------------------------------------------------
export default function ConciliacaoPage() {
  const [extratoId, setExtratoId] = React.useState<string | null>(null);
  const [selectedLinhaId, setSelectedLinhaId] = React.useState<string | null>(null);
  const [activeLinhaId, setActiveLinhaId] = React.useState<string | null>(null);
  const [confirmPayload, setConfirmPayload] = React.useState<{
    linhaId: string;
    titleId: string;
    tipo: "pagar" | "receber";
  } | null>(null);
  const [overTituloId, setOverTituloId] = React.useState<string | null>(null);

  const extratosQ = useExtratos({});
  const extratos = extratosQ.data?.data ?? [];
  const linhasQ = useExtratoLinhas(extratoId);
  const linhas = (linhasQ.data ?? []).filter((l) => l.status !== "conciliado");
  const cpQ = useContasPagar({ situacao: "aberto", pageSize: 50 });
  const crQ = useContasReceber({ situacao: "aberto", pageSize: 50 });
  const suggestionsQ = useReconciliationSuggestions(extratoId);
  const suggestions = suggestionsQ.data ?? [];

  const confirmMatch = useConfirmMatch();
  const ignoreMatch = useIgnoreMatch();
  const iaJob = useRunReconciliationIA(extratoId);

  const titulos: TituloAberto[] = [
    ...(cpQ.data?.data ?? []).map((c) => ({ ...c, _tipo: "pagar" as const })),
    ...(crQ.data?.data ?? []).map((c) => ({ ...c, _tipo: "receber" as const }))
  ];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (e: DragStartEvent) => {
    setActiveLinhaId(e.active.id as string);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveLinhaId(null);
    setOverTituloId(null);
    const { over, active } = e;
    if (!over) return;
    const tituloData = over.data.current?.titulo as TituloAberto | undefined;
    if (!tituloData) return;
    const linhaId = active.id as string;
    setConfirmPayload({ linhaId, titleId: tituloData.id, tipo: tituloData._tipo });
  };

  const handleDragOver = (e: DragOverEvent) => {
    setOverTituloId(e.over ? String(e.over.id) : null);
  };

  const handleConfirm = (linhaId: string, titleId: string, tipo: "pagar" | "receber") => {
    confirmMatch.mutate({ linhaId, titleId, tipo });
    setSelectedLinhaId(null);
  };

  const handleIgnore = (linhaId: string) => {
    ignoreMatch.mutate(linhaId);
    if (selectedLinhaId === linhaId) setSelectedLinhaId(null);
  };

  const handleTituloClick = (titleId: string, tipo: "pagar" | "receber") => {
    if (!selectedLinhaId) return;
    setConfirmPayload({ linhaId: selectedLinhaId, titleId, tipo });
  };

  const selectedLinha = linhas.find((l) => l.id === (confirmPayload?.linhaId ?? selectedLinhaId)) ?? null;
  const confirmTitulo = titulos.find(
    (t) => confirmPayload && t.id === confirmPayload.titleId && t._tipo === confirmPayload.tipo
  ) ?? null;

  const getSuggestion = (linhaId: string) => {
    const found = suggestions.find((s) => s.linhaId === linhaId);
    if (!found) return null;
    return {
      titleId: found.titleId,
      tipo: found.tipo,
      confidence: found.confidence,
      descricaoLinha: found.descricaoLinha
    };
  };

  const activeLinha = linhas.find((l) => l.id === activeLinhaId) ?? null;

  // Keyboard: Escape cancels selection
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedLinhaId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const cpTitulos = titulos.filter((t) => t._tipo === "pagar");
  const crTitulos = titulos.filter((t) => t._tipo === "receber");

  return (
    <>
      <PageHeader
        title="Conciliação bancária"
        description="Vincule linhas do extrato a títulos abertos — arraste ou clique"
        actions={
          <div className="flex items-center gap-2">
            {extratoId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => iaJob.trigger()}
                disabled={iaJob.running}
              >
                {iaJob.running ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {iaJob.running ? "Gerando..." : "Gerar sugestões IA"}
              </Button>
            )}
          <Select
            value={extratoId ?? ""}
            onValueChange={(v) => {
              setExtratoId(v || null);
              setSelectedLinhaId(null);
            }}
          >
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Selecione um extrato..." />
            </SelectTrigger>
            <SelectContent>
              {extratos.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.bancoNome} — {formatDate(e.dataInicio)} a {formatDate(e.dataFim)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
        }
      />

      {!extratoId ? (
        <div className="p-6">
          <EmptyState
            icon={GitMerge}
            title="Selecione um extrato"
            description="Escolha um extrato bancário importado para iniciar a conciliação."
          />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
        >
          <PanelGroup
            orientation="horizontal"
            className="h-[calc(100vh-120px)] overflow-hidden"
          >
            {/* Left panel — extrato lines */}
            <Panel defaultSize={50} minSize={30}>
              <div className="flex h-full flex-col border-r">
                <div className="border-b px-4 py-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">
                      Extrato bancário
                      {linhas.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {linhas.length} pendentes
                        </Badge>
                      )}
                    </h2>
                    {selectedLinhaId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLinhaId(null)}
                        className="text-xs"
                      >
                        <X className="h-3 w-3" /> Cancelar (Esc)
                      </Button>
                    )}
                  </div>
                  {selectedLinhaId && (
                    <p className="text-xs text-primary mt-1 font-medium">
                      Linha selecionada — clique em um título ou arraste-a
                    </p>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {linhasQ.isLoading ? (
                    <div className="space-y-2">
                      {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20" />)}
                    </div>
                  ) : linhas.length === 0 ? (
                    <EmptyState
                      icon={FileSpreadsheet}
                      title="Todas as linhas conciliadas"
                      description="Não há linhas pendentes neste extrato."
                    />
                  ) : (
                    linhas.map((l) => (
                      <DraggableLinhaCard
                        key={l.id}
                        linha={l}
                        onIgnore={handleIgnore}
                        suggestion={getSuggestion(l.id)}
                        onConfirmSuggestion={handleConfirm}
                        isSelected={selectedLinhaId === l.id}
                        onClick={() =>
                          setSelectedLinhaId((prev) => (prev === l.id ? null : l.id))
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/30 transition-colors cursor-col-resize flex items-center justify-center" />

            {/* Right panel — open titles */}
            <Panel defaultSize={50} minSize={30}>
              <div className="flex h-full flex-col">
                <div className="border-b px-4 py-3 bg-muted/30">
                  <h2 className="text-sm font-semibold">
                    Títulos abertos
                    <Badge variant="secondary" className="ml-2">
                      {titulos.length}
                    </Badge>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedLinhaId
                      ? "Clique em um título ou solte a linha arrastada aqui"
                      : "Selecione ou arraste uma linha do extrato"}
                  </p>
                </div>
                <div className="flex-1 overflow-hidden">
                  <Tabs defaultValue="cp" className="h-full flex flex-col">
                    <div className="px-4 pt-2">
                      <TabsList>
                        <TabsTrigger value="cp">
                          CP
                          <Badge variant="secondary" className="ml-1 text-[10px]">
                            {cpTitulos.length}
                          </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="cr">
                          CR
                          <Badge variant="secondary" className="ml-1 text-[10px]">
                            {crTitulos.length}
                          </Badge>
                        </TabsTrigger>
                      </TabsList>
                    </div>
                    <TabsContent value="cp" className="flex-1 overflow-y-auto p-4 space-y-2">
                      {cpQ.isLoading ? (
                        <div className="space-y-2">
                          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                        </div>
                      ) : cpTitulos.length === 0 ? (
                        <EmptyState title="Nenhum CP em aberto" />
                      ) : (
                        cpTitulos.map((t) => (
                          <DroppableTituloCard
                            key={`pagar-${t.id}`}
                            titulo={t}
                            isOver={overTituloId === `titulo-pagar-${t.id}`}
                            onMatch={handleTituloClick}
                            selectedLinhaId={selectedLinhaId}
                          />
                        ))
                      )}
                    </TabsContent>
                    <TabsContent value="cr" className="flex-1 overflow-y-auto p-4 space-y-2">
                      {crQ.isLoading ? (
                        <div className="space-y-2">
                          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                        </div>
                      ) : crTitulos.length === 0 ? (
                        <EmptyState title="Nenhum CR em aberto" />
                      ) : (
                        crTitulos.map((t) => (
                          <DroppableTituloCard
                            key={`receber-${t.id}`}
                            titulo={t}
                            isOver={overTituloId === `titulo-receber-${t.id}`}
                            onMatch={handleTituloClick}
                            selectedLinhaId={selectedLinhaId}
                          />
                        ))
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </Panel>
          </PanelGroup>

          {/* Drag overlay */}
          <DragOverlay>
            {activeLinha && (
              <div className="rounded-md border bg-background shadow-lg p-3 text-sm opacity-95 max-w-xs">
                <p className="font-medium truncate">{activeLinha.descricao}</p>
                <p className="text-muted-foreground">{formatCurrency(activeLinha.valor)}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Confirm dialog */}
      <ConfirmMatchDialog
        open={!!confirmPayload}
        onOpenChange={(v) => !v && setConfirmPayload(null)}
        linha={selectedLinha}
        titulo={confirmTitulo}
        onConfirm={() => {
          if (confirmPayload) {
            handleConfirm(confirmPayload.linhaId, confirmPayload.titleId, confirmPayload.tipo);
          }
          setConfirmPayload(null);
        }}
      />
    </>
  );
}
