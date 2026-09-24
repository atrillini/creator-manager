import { NextResponse } from "next/server";
import { getReceiptById, loadIssuerProfile } from "@/lib/data/receipts";
import { isValidUuid } from "@/lib/is-uuid";
import {
  buildReceiptDocument,
  formatReceiptNumber,
  receiptFileName,
} from "@/lib/receipts/model";
import { renderReceiptPdf } from "@/lib/receipts/pdf";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ ok: false, error: "ID non valido" }, { status: 400 });
  }

  const supabase = await createSupabaseClient();
  const receipt = await getReceiptById(supabase, userId, id);
  if (!receipt) {
    return NextResponse.json({ ok: false, error: "Ricevuta non trovata" }, { status: 404 });
  }
  if (receipt.isLegacy || !receipt.issuer || !receipt.payment) {
    return NextResponse.json(
      { ok: false, error: "Ricevuta storica: il PDF non è stato generato dal portale" },
      { status: 409 }
    );
  }

  const profile = await loadIssuerProfile(supabase, userId);
  const doc = buildReceiptDocument({
    language: receipt.language,
    number: receipt.number,
    year: receipt.year,
    issueDate: receipt.issueDate,
    place: receipt.place,
    description: receipt.description,
    gross: receipt.gross,
    withholdingRate: receipt.withholdingRate,
    stampDuty: receipt.stampDuty,
    paymentMethod: receipt.paymentMethod,
    recipient: receipt.recipient,
    issuer: receipt.issuer,
    payment: receipt.payment,
  });

  const bytes = await renderReceiptPdf(doc, {
    title: `Ricevuta ${formatReceiptNumber(receipt.number, receipt.year)} - ${receipt.recipient.name}`,
    signatureDataUrl: profile.signatureDataUrl,
    watermark: receipt.status === "annullata" ? "ANNULLATA" : null,
  });

  const fileName = receiptFileName({
    number: receipt.number,
    year: receipt.year,
    recipientName: receipt.recipient.name,
  });
  const download = new URL(request.url).searchParams.get("download") === "1";

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
