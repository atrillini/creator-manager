"use client";

import type { MockCollaboration } from "@/lib/data/mock";
import { isValidUuid } from "@/lib/is-uuid";
import { KANBAN_COLUMNS, type KanbanStatus } from "@/lib/types";
import { moveCollaborationToColumn } from "@/lib/actions/collaboration-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { GripVertical } from "lucide-react";
import { useId, useState, useTransition } from "react";

const COL_PREFIX = "col-";

type Props = {
  collaborations: MockCollaboration[];
};

function columnItems(
  all: MockCollaboration[],
  status: KanbanStatus
): MockCollaboration[] {
  return all.filter((c) => c.kanbanStatus === status);
}

function colId(s: KanbanStatus) {
  return `${COL_PREFIX}${s}` as const;
}
function isColId(over: string) {
  return over.startsWith(COL_PREFIX) ? (over.slice(COL_PREFIX.length) as KanbanStatus) : null;
}

function MockRow({ c }: { c: MockCollaboration }) {
  return (
    <div className="w-full pl-0.5">
      <div
        className="cursor-not-allowed rounded-xl bg-white/80 px-2 py-1.5 opacity-90 ring-1 ring-gray-100"
        title="Dato di esempio, non tracciabile in Supabase"
      >
        <p className="line-clamp-2 text-xs font-medium leading-tight text-gray-900">
          {c.title}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[10px] text-amber-700/90">
          Demo: crea un deal in DB per trascinare
        </p>
      </div>
    </div>
  );
}

function DraggableRow({ c, droppableId }: { c: MockCollaboration; droppableId: string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable(
    { id: c.id, data: { droppable: droppableId } }
  );
  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    zIndex: isDragging ? 50 : undefined,
    position: (isDragging ? "relative" : undefined) as "relative" | undefined,
  };
  if (!isValidUuid(c.id)) {
    return <MockRow c={c} />;
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex min-h-0 w-full min-w-0 max-w-full gap-0.5 overflow-hidden",
        isDragging && "cursor-grabbing opacity-0"
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="shrink-0 touch-none self-start rounded p-0.5 text-gray-400 transition-colors hover:bg-white/60 hover:text-blue-500"
        title="Trascina in un’altra colonna"
        {...listeners}
        {...attributes}
        aria-label="Trascina su un’altra colonna"
      >
        <GripVertical className="size-3" />
      </button>
      <div className="min-w-0 flex-1">
        <Link
          href={`/collaborations/${c.id}`}
          className="block w-full min-w-0 max-w-full rounded-xl border border-gray-100/80 bg-white px-2 py-1.5 shadow-sm transition-shadow hover:shadow"
          style={{ textDecoration: "none" }}
          tabIndex={isDragging ? -1 : 0}
        >
          <p className="line-clamp-2 text-xs font-medium leading-tight text-gray-900">
            {c.title}
          </p>
          <p className="mt-0.5 line-clamp-1 text-[10px] text-gray-500">{c.brandName}</p>
          {c.agreedFee && (
            <p className="mt-0.5 text-[10px] font-medium tabular-nums text-gray-800">
              {c.agreedFee}
            </p>
          )}
        </Link>
      </div>
    </div>
  );
}

/** Compatta, mostrata nel DragOverlay (evita card “enorme” sotto al cursore) */
function KanbanCardPreview({ c }: { c: MockCollaboration }) {
  return (
    <div className="w-[200px] max-w-[min(200px,88vw)] cursor-grabbing select-none rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 shadow-md">
      <p className="line-clamp-2 text-xs font-medium leading-tight text-gray-900">
        {c.title}
      </p>
      <p className="mt-0.5 line-clamp-1 text-[10px] text-gray-500">{c.brandName}</p>
      {c.agreedFee ? (
        <p className="mt-0.5 text-[10px] font-medium tabular-nums text-gray-800">
          {c.agreedFee}
        </p>
      ) : null}
    </div>
  );
}

function DroppableColumnContent({
  colIdStr,
  children,
}: {
  colIdStr: string;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: colIdStr });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[120px] rounded-2xl rounded-t-none transition-[box-shadow,background] duration-200",
        isOver && "bg-blue-500/5 ring-1 ring-inset ring-blue-400/25"
      )}
    >
      {children}
    </div>
  );
}

export function CollaborationKanban({ collaborations }: Props) {
  const dndId = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [activeDrag, setActiveDrag] = useState<MockCollaboration | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const onDragStart = (e: DragStartEvent) => {
    const c = collaborations.find((x) => x.id === e.active.id);
    if (c && isValidUuid(c.id)) {
      setActiveDrag(c);
    } else {
      setActiveDrag(null);
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const { over, active } = e;
    if (!over || !active) return;
    if (over.id === active.id) return;
    const collabId = active.id as string;
    if (!isValidUuid(collabId)) return;
    let col = isColId(over.id as string);
    if (!col) {
      // rilascio su un’altra card: trova la colonna
      const overC = collaborations.find((x) => x.id === (over.id as string));
      if (overC) {
        col = overC.kanbanStatus;
      } else {
        return;
      }
    }
    const from = collaborations.find((x) => x.id === collabId);
    if (!from || from.kanbanStatus === col) return;
    start(() => {
      void (async () => {
        const r = await moveCollaborationToColumn(collabId, col!);
        if (r.ok) {
          router.refresh();
        } else {
          if (process.env.NODE_ENV === "development")
            console.error(r.error);
        }
      })();
    });
  };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      onDragStart={onDragStart}
      onDragCancel={() => {
        setActiveDrag(null);
      }}
      onDragEnd={onDragEnd}
    >
      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {KANBAN_COLUMNS.map((col) => {
          const items = columnItems(collaborations, col.id);
          const cId = colId(col.id);
          return (
            <Card
              key={col.id}
              className="flex min-h-[320px] flex-col overflow-hidden border-0 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
            >
              <CardHeader className="shrink-0 space-y-1 border-b-0 bg-white px-3 py-2 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-xs font-medium tracking-tight text-gray-900">
                    {col.title}
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="h-5 border-0 bg-gray-100/80 px-1.5 text-[10px] tabular-nums text-gray-600"
                  >
                    {items.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 p-0">
                <DroppableColumnContent colIdStr={cId}>
                  <ScrollArea className="h-[min(300px,42vh)]">
                    <ul className="space-y-1.5 px-2 py-0.5 pb-3 pr-1.5">
                      {items.map((c) => (
                        <li key={c.id} className="w-full min-w-0 max-w-full">
                          <div className="w-full min-w-0 max-w-full pr-0.5">
                            <DraggableRow c={c} droppableId={cId} />
                          </div>
                        </li>
                      ))}
                      {items.length === 0 && !pending && (
                        <p className="px-1 py-6 text-center text-xs text-gray-400">
                          Rilascia una card qui
                        </p>
                      )}
                    </ul>
                  </ScrollArea>
                </DroppableColumnContent>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDrag ? <KanbanCardPreview c={activeDrag} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
