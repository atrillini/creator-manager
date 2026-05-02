"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AIThinkingLoader } from "@/components/ai/ai-thinking-loader";
import { Sparkles, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export function AIAssistantDrawer() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [modelsInfo, setModelsInfo] = useState<{
    available: string[];
    preferred: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const hasMessages = useMemo(() => messages.length > 0, [messages]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const res = await fetch("/api/gemini/models");
      const data = (await res.json()) as
        | { ok: true; available: string[]; preferred: string | null }
        | { ok: false };
      if (data.ok) {
        setModelsInfo({ available: data.available, preferred: data.preferred });
      }
    })();
  }, [open]);

  const onAsk = () => {
    const q = question.trim();
    if (!q) return;
    setErr(null);
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text: q }]);
    setQuestion("");
    setIsLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/ai/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q }),
        });
        const data = (await res.json()) as
          | { ok: true; answer: string }
          | { ok: false; error?: string };
        if (!data.ok) {
          setErr(data.error ?? "Errore risposta IA");
          return;
        }
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", text: data.answer || "Nessuna risposta." },
        ]);
      } finally {
        setIsLoading(false);
      }
    })();
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1 rounded-full border-gray-200 bg-white/80"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="size-4" />
        Chiedi all&apos;IA
      </Button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
            aria-label="Chiudi assistente IA"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-[min(100vw,28rem)] flex-col border-l border-white/60 bg-white/80 shadow-[0_8px_40px_rgba(0,0,0,0.1)] backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-gray-100/80 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Assistente BI</p>
                {modelsInfo?.available?.length ? (
                  <p className="text-[10px] text-gray-500">
                    Modelli: {modelsInfo.available.slice(0, 3).join(", ")}
                    {modelsInfo.available.length > 3 ? "…" : ""}
                  </p>
                ) : null}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <ScrollArea className="min-h-0 flex-1 px-3 py-3">
              {!hasMessages && (
                <p className="px-1 text-sm text-gray-500">
                  Fai una domanda sui tuoi dati (brand, incassi, deliverable, performance).
                </p>
              )}
              <div className="space-y-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.role === "user"
                        ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-blue-500 px-3 py-2 text-sm text-white"
                        : "mr-auto max-w-[90%] rounded-2xl rounded-bl-md bg-gray-100 px-3 py-2 text-sm text-gray-800"
                    }
                  >
                    {m.text}
                  </div>
                ))}
                {isLoading && (
                  <div className="mr-auto max-w-[90%] rounded-2xl rounded-bl-md bg-gray-100 px-3 py-2 text-sm text-gray-800">
                    <AIThinkingLoader label="L'assistente sta analizzando i dati..." />
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="border-t border-gray-100/80 p-3">
              {err ? <p className="mb-2 text-xs text-red-600">{err}</p> : null}
              <div className="flex items-end gap-2">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={2}
                  placeholder="Es. Quali brand hanno pagato di più quest'anno?"
                  className="min-h-[2.5rem] flex-1 resize-y rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-blue-500/30 focus:ring-2"
                  disabled={isLoading}
                />
                <Button type="button" onClick={onAsk} disabled={isLoading || question.trim().length < 2}>
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : "Invia"}
                </Button>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
