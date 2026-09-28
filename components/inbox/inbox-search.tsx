"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { inboxHref, type InboxParams } from "@/lib/inbox/url";

export function InboxSearch({ initialQuery, params }: { initialQuery: string; params: InboxParams }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const submit = () => {
    const q = query.trim();
    if (q === (params.q ?? "")) return;
    router.push(inboxHref(params, { q: q || null, before: null, t: null }));
  };
  return (
    <form
      className="relative w-full"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={submit}
        placeholder="Cerca in oggetto, mittente, testo, riassunto…"
        aria-label="Cerca nelle email"
        className="h-9 rounded-full border-gray-200 bg-white pl-8 text-sm"
      />
    </form>
  );
}
