"use client";

import type { ReceiptFormOptions } from "@/lib/data/receipts";
import { missingProfileFields } from "@/lib/receipts/model";
import { IssuerProfileDialog } from "@/components/ricevute/issuer-profile-dialog";
import { ReceiptFormDialog, type ReceiptFormMode } from "@/components/ricevute/receipt-form-dialog";
import { Button } from "@/components/ui/button";
import { History, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  options: ReceiptFormOptions;
  /** Apre subito il form collegato a questa collaborazione (da ?collaborazione=). */
  autoOpenCollaborationId?: string | null;
};

export function ReceiptsToolbar({ options, autoOpenCollaborationId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<ReceiptFormMode | null>(autoOpenCollaborationId ? "new" : null);
  const incomplete = missingProfileFields(options.profile, options.profile.defaultPaymentMethod).length > 0;

  function onOpenChange(open: boolean) {
    if (open) return;
    setMode(null);
    if (autoOpenCollaborationId) router.replace(pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <IssuerProfileDialog profile={options.profile} incomplete={incomplete} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1.5 rounded-full border-gray-200 text-gray-700"
        onClick={() => setMode("legacy")}
      >
        <History className="size-4" />
        Registra storico
      </Button>
      <Button type="button" size="sm" className="h-9 gap-1.5 rounded-full" onClick={() => setMode("new")}>
        <Plus className="size-4" />
        Nuova ricevuta
      </Button>
      {mode && (
        <ReceiptFormDialog
          options={options}
          mode={mode}
          open
          onOpenChange={onOpenChange}
          initialCollaborationId={mode === "new" ? autoOpenCollaborationId : null}
        />
      )}
    </div>
  );
}
