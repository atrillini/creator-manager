"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CreateCollaborationDialog,
  type BrandOption,
} from "@/components/collaborazioni/create-collaboration-dialog";
import { GenerateFromBriefDialog } from "@/components/collaborazioni/generate-from-brief-dialog";
import { Plus } from "lucide-react";

type Draft = {
  brandId?: string;
  briefText?: string;
  agreedFee?: string;
  isPeriodic?: boolean;
  contentCount?: number;
  feePerContent?: string;
  plannedDeliverables?: { type: string; publishDate: string }[];
  initialTimelineNote?: string;
  initialPayments?: { amount: string; paidAt: string; note?: string }[];
};

type Props = {
  brands: BrandOption[];
};

export function CollaborazioniActions({ brands }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        size="sm"
        className="gap-1"
        onClick={() => {
          setDraft(null);
          setCreateOpen(true);
        }}
      >
        <Plus className="size-4" />
        Nuova collaborazione
      </Button>
      <GenerateFromBriefDialog
        brands={brands}
        onDraftReady={(next) => {
          setDraft(next);
          setCreateOpen(true);
        }}
      />
      <CreateCollaborationDialog
        brands={brands}
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialDraft={draft}
        hideTrigger
      />
    </div>
  );
}
