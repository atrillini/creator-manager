"use client";

import type { BrandBilling } from "@/lib/brand-billing";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown } from "lucide-react";

type Props = {
  value: BrandBilling;
  onChange: (next: BrandBilling) => void;
  disabled?: boolean;
};

const inputCls = "h-8 border-gray-200 bg-white text-sm text-gray-900";

/** Dati del committente usati come intestazione nelle ricevute. */
export function BrandBillingFields({ value, onChange, disabled }: Props) {
  const set = <K extends keyof BrandBilling>(k: K, v: BrandBilling[K]) => onChange({ ...value, [k]: v });
  const filled = Boolean(value.billingName || value.billingAddress || value.vatNumber);

  return (
    <details className="group rounded-2xl border border-gray-100 bg-gray-50/80 p-3" open={filled}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-gray-700">
        Dati di fatturazione (per le ricevute)
        <ChevronDown className="size-4 text-gray-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 space-y-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-gray-500">Ragione sociale</Label>
          <Input
            value={value.billingName}
            onChange={(e) => set("billingName", e.target.value)}
            placeholder="Es. beautybears GmbH (vuoto = nome azienda)"
            disabled={disabled}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-gray-500">Indirizzo (una riga per voce)</Label>
          <Textarea
            value={value.billingAddress}
            onChange={(e) => set("billingAddress", e.target.value)}
            rows={3}
            placeholder={"Theresienstraße 1\nMünchen\nGermania"}
            disabled={disabled}
            className="resize-none border-gray-200 bg-white text-sm text-gray-900"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-gray-500">P.IVA / VAT</Label>
            <Input
              value={value.vatNumber}
              onChange={(e) => set("vatNumber", e.target.value)}
              disabled={disabled}
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-gray-500">Lingua ricevuta</Label>
            <Select
              value={value.receiptLanguage}
              onValueChange={(v) => set("receiptLanguage", v as "it" | "en")}
              disabled={disabled}
            >
              <SelectTrigger className={inputCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="it">Italiano</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-gray-500">Righe extra (tel., direzione, C.F.…)</Label>
          <Textarea
            value={value.billingExtra}
            onChange={(e) => set("billingExtra", e.target.value)}
            rows={2}
            disabled={disabled}
            className="resize-none border-gray-200 bg-white text-sm text-gray-900"
          />
        </div>
      </div>
    </details>
  );
}
