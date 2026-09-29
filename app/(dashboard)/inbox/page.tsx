import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { InboxFiltersPanel } from "@/components/inbox/inbox-filters";
import { InboxSearch } from "@/components/inbox/inbox-search";
import { InboxSuggestionsDialog } from "@/components/inbox/inbox-suggestions-dialog";
import { InboxSyncButton } from "@/components/inbox/inbox-sync-button";
import { InboxThreadDetailView } from "@/components/inbox/inbox-thread-detail";
import { InboxThreadList } from "@/components/inbox/inbox-thread-list";
import { getBrands, getCollaborationOptions } from "@/lib/data/fetchers";
import {
  getInboxCounts,
  getInboxSyncStatus,
  getInboxTags,
  getInboxThreadDetail,
  getInboxThreads,
  parseInboxView,
} from "@/lib/data/inbox";
import { getInboxSuggestions } from "@/lib/data/inbox-suggestions";
import { isInboxCategory } from "@/lib/inbox/constants";
import { inboxHref, type InboxParams } from "@/lib/inbox/url";
import { canAccessInbox } from "@/lib/inbox-access";
import { requireUserId } from "@/lib/supabase-server";
import { cn } from "@/lib/utils";

// "Sincronizza ora" gira come server action di questa pagina.
export const maxDuration = 60;

type PageProps = { searchParams?: Promise<InboxParams> };

export default async function InboxPage({ searchParams }: PageProps) {
  const userId = await requireUserId();
  if (!canAccessInbox(userId)) redirect("/dashboard");

  const sp = (await searchParams) ?? {};
  const view = parseInboxView(sp.view);
  const category = isInboxCategory(sp.cat) ? sp.cat : undefined;

  const [list, counts, tags, brandRows, collaborations, syncStatus, detail, suggestions] = await Promise.all([
    getInboxThreads({
      view,
      category,
      brandId: sp.brand,
      tagId: sp.tag,
      unlinked: sp.unlinked === "1",
      q: sp.q,
      before: sp.before,
    }),
    getInboxCounts(),
    getInboxTags(),
    getBrands(),
    getCollaborationOptions(),
    getInboxSyncStatus(),
    sp.t ? getInboxThreadDetail(sp.t) : Promise.resolve(null),
    getInboxSuggestions(),
  ]);
  const brands = brandRows.map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="min-h-0">
      <DashboardHeader
        title="Inbox collaborazioni"
        description="Email per le collaborazioni, scaricate in automatico ogni 15 minuti e catalogate dall'AI."
        end={
          <div className={cn("flex w-full flex-col items-end gap-2", detail && "max-lg:hidden")}>
            <InboxSearch initialQuery={sp.q ?? ""} params={sp} />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <InboxSuggestionsDialog brands={suggestions.brands} links={suggestions.links} />
              <InboxSyncButton status={syncStatus} aiPending={counts.aiPending} />
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[13rem_minmax(0,22rem)_minmax(0,1fr)]">
        <aside className={cn("min-w-0", detail && "hidden lg:block")}>
          <InboxFiltersPanel params={sp} view={view} counts={counts} tags={tags} brands={brands} />
        </aside>

        <section className={cn("min-w-0", detail && "hidden lg:block")}>
          <InboxThreadList
            items={list.items}
            params={sp}
            selectedId={detail?.id ?? null}
            tags={tags}
            searching={Boolean(sp.q?.trim())}
          />
          <div className="mt-3 flex justify-between text-xs">
            {sp.before ? (
              <Link href={inboxHref(sp, { before: null, t: null })} className="text-blue-600 hover:underline">
                ← Più recenti
              </Link>
            ) : (
              <span />
            )}
            {list.nextCursor ? (
              <Link href={inboxHref(sp, { before: list.nextCursor, t: null })} className="text-blue-600 hover:underline">
                Meno recenti →
              </Link>
            ) : null}
          </div>
        </section>

        <section className={cn("min-w-0", !detail && "hidden lg:block")}>
          {detail ? (
            <>
              <Link
                href={inboxHref(sp, { t: null })}
                className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 lg:hidden"
              >
                <ArrowLeft className="size-4" />
                Torna alla lista
              </Link>
              <InboxThreadDetailView
                key={detail.id}
                thread={detail}
                brands={brands}
                collaborations={collaborations}
              />
            </>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-3xl bg-white text-sm text-gray-400 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              Seleziona una conversazione
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
