import { InboxCollaborazioniView } from "@/components/inbox/inbox-collaborazioni-view";
import { getBrands } from "@/lib/data/fetchers";
import { requireUserId } from "@/lib/supabase-server";
import { canAccessInbox } from "@/lib/inbox-access";
import { redirect } from "next/navigation";

export default async function InboxPage() {
  const userId = await requireUserId();
  if (!canAccessInbox(userId)) {
    redirect("/dashboard");
  }
  const brandRows = await getBrands();
  const brands = brandRows.map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="min-h-0 bg-[#F5F5F7]">
      <InboxCollaborazioniView brands={brands} />
    </div>
  );
}
