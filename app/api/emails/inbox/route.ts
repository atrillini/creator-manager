import { NextResponse } from "next/server";
import { simpleParser } from "mailparser";
import type { AddressObject } from "mailparser";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";
import { canAccessInbox } from "@/lib/inbox-access";
import imaps from "imap-simple";

type Row = Record<string, unknown>;

const DAYS_WINDOW = 14;
const MAX_DAYS_WINDOW = 180;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

function toImapSinceDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const day = String(d.getDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function normalizeEmail(input: string) {
  return input.trim().toLowerCase();
}

function collapseText(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function compactUrl(raw: string) {
  try {
    const normalized = raw.startsWith("http") ? raw : `https://${raw}`;
    const url = new URL(normalized);
    const clean = `${url.origin}${url.pathname === "/" ? "" : url.pathname}`;
    return clean.length > 90 ? `${clean.slice(0, 87)}...` : clean;
  } catch {
    return raw.length > 90 ? `${raw.slice(0, 87)}...` : raw;
  }
}

function normalizeBodyText(input: string) {
  const noMarkdownLinks = input.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,
    (_m, label: string, url: string) => {
      const cleanUrl = compactUrl(url);
      if (/^https?:\/\//i.test(label.trim())) return cleanUrl;
      return `${label.trim()} (${cleanUrl})`;
    }
  );
  const cleanedUrls = noMarkdownLinks.replace(/https?:\/\/[^\s<>"')\]]+/gi, (u) => compactUrl(u));
  return cleanedUrls
    .replace(/\[\s*([^\]]+)\s*\]/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function htmlToText(input: string) {
  const withBreaks = input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|h1|h2|h3|h4|h5|h6)>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ");
  const plain = withBreaks
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ");
  return normalizeBodyText(plain.trim());
}

function normalizeMessageId(input: string) {
  return input.trim().replace(/^<|>$/g, "");
}

function threadKeyFromHeaders(args: {
  subject: string;
  inReplyTo?: string | null;
  referencesIds?: string[];
}) {
  const ref = args.referencesIds?.[0] || args.inReplyTo;
  if (ref) return normalizeMessageId(ref);
  return args.subject
    .toLowerCase()
    .replace(/^(re|fw|fwd)\s*:\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export const runtime = "nodejs";

function parseSinceDays(input: string | null) {
  const n = Number.parseInt(String(input ?? DAYS_WINDOW), 10);
  if (!Number.isFinite(n)) return DAYS_WINDOW;
  return Math.max(1, Math.min(MAX_DAYS_WINDOW, n));
}

function parseLimit(input: string | null) {
  const n = Number.parseInt(String(input ?? DEFAULT_LIMIT), 10);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.max(10, Math.min(MAX_LIMIT, n));
}

function toIsoDateSince(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function syncInboxFromIcloud(userId: string, sinceDays: number) {
  const emailUser = process.env.ICLOUD_EMAIL;
  const emailPass = process.env.ICLOUD_APP_PASSWORD;
  const collabAddressRaw = process.env.COLLAB_EMAIL_ADDRESS;
  if (!emailUser || !emailPass || !collabAddressRaw) {
    throw new Error("Config email incompleta: ICLOUD_EMAIL, ICLOUD_APP_PASSWORD o COLLAB_EMAIL_ADDRESS");
  }

  const collabAddress = normalizeEmail(collabAddressRaw);
  const config = {
    imap: {
      user: emailUser,
      password: emailPass,
      host: "imap.mail.me.com",
      port: 993,
      tls: true,
      authTimeout: 10000,
    },
  };

  const supabase = await createSupabaseClient();
  const connection = await imaps.connect(config);
  try {
    await connection.openBox("INBOX");
    const messages = await connection.search([["SINCE", toImapSinceDate(sinceDays)]], {
      bodies: [""],
      struct: true,
      markSeen: false,
    });

    const toUpsert: {
      user_id: string;
      provider: string;
      mailbox: string;
      external_message_id: string;
      thread_key: string;
      in_reply_to: string | null;
      references_ids: string[];
      from_name: string | null;
      from_email: string | null;
      to_emails: string[];
      subject: string;
      preview: string;
      body_text: string;
      body_html: string | null;
      received_at: string;
      last_synced_at: string;
      updated_at: string;
    }[] = [];

    for (const message of messages) {
      const sourceBody = message.parts.find((p: { which: string }) => p.which === "")?.body;
      if (typeof sourceBody !== "string" || sourceBody.trim() === "") {
        continue;
      }

      const parsed = await simpleParser(sourceBody);
      const toList = ((parsed.to as AddressObject | undefined)?.value ?? [])
        .map((x: { address?: string }) => normalizeEmail(String(x.address ?? "")))
        .filter(Boolean);
      if (!toList.some((addr: string) => addr === collabAddress)) {
        continue;
      }

      const htmlSource = typeof parsed.html === "string" ? parsed.html : "";
      const plain = normalizeBodyText(collapseText(parsed.text ?? "")) || htmlToText(htmlSource);
      const preview = plain.slice(0, 180);
      const fromName = parsed.from?.value?.[0]?.name?.trim() || null;
      const fromEmail = parsed.from?.value?.[0]?.address?.trim().toLowerCase() || null;
      const internalDate =
        parsed.date instanceof Date ? parsed.date : message.attributes?.date instanceof Date ? message.attributes.date : null;
      const externalMessageId = normalizeMessageId(
        String(parsed.messageId ?? `${message.attributes?.uid ?? crypto.randomUUID()}@imap-uid.local`)
      );
      const refs =
        (Array.isArray(parsed.references) ? parsed.references : [parsed.references])
          .filter((v): v is string => typeof v === "string")
          .map((v) => normalizeMessageId(v))
          .filter(Boolean) ?? [];
      const inReplyTo = parsed.inReplyTo ? normalizeMessageId(parsed.inReplyTo) : null;
      const subject = parsed.subject?.trim() || "(Senza oggetto)";
      const nowIso = new Date().toISOString();

      toUpsert.push({
        user_id: userId,
        provider: "icloud",
        mailbox: "INBOX",
        external_message_id: externalMessageId,
        thread_key: threadKeyFromHeaders({
          subject,
          inReplyTo,
          referencesIds: refs,
        }),
        in_reply_to: inReplyTo,
        references_ids: refs,
        from_name: fromName,
        from_email: fromEmail,
        to_emails: toList,
        subject,
        preview,
        body_text: plain,
        body_html: htmlSource || null,
        received_at: (internalDate ?? new Date()).toISOString(),
        last_synced_at: nowIso,
        updated_at: nowIso,
      });
    }

    if (!toUpsert.length) {
      return { synced: 0, filteredTo: collabAddressRaw };
    }
    const { error: upsertError } = await supabase.from("email_messages").upsert(toUpsert, {
      onConflict: "user_id,provider,mailbox,external_message_id",
    });
    if (upsertError) {
      throw new Error(`Errore salvataggio email: ${upsertError.message}`);
    }
    return { synced: toUpsert.length, filteredTo: collabAddressRaw };
  } finally {
    connection.end();
  }
}

export async function GET(request: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }
  if (!canAccessInbox(userId)) {
    return NextResponse.json({ ok: false, error: "Accesso Inbox negato" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const sinceDays = parseSinceDays(searchParams.get("sinceDays"));
    const limit = parseLimit(searchParams.get("limit"));
    const before = searchParams.get("before");
    const q = String(searchParams.get("q") ?? "").trim();
    const sinceIso = toIsoDateSince(sinceDays);
    const supabase = await createSupabaseClient();
    let query = supabase
      .from("email_messages")
      .select(
        "id, external_message_id, thread_key, from_name, from_email, subject, preview, body_text, body_html, received_at, email_message_tags(tag_id, email_tags(id, name, color))"
      )
      .eq("user_id", userId)
      .gte("received_at", sinceIso)
      .order("received_at", { ascending: false })
      .limit(10000);
    if (before) {
      query = query.lt("received_at", before);
    }
    if (q) {
      const safeQ = q.replace(/[%_]/g, "\\$&");
      query = query.or(
        `subject.ilike.%${safeQ}%,preview.ilike.%${safeQ}%,from_name.ilike.%${safeQ}%,from_email.ilike.%${safeQ}%,body_text.ilike.%${safeQ}%`
      );
    }
    const { data: rows, error } = await query;
    if (error) {
      throw new Error(`Errore lettura inbox: ${error.message}`);
    }

    const grouped = new Map<
      string,
      {
        threadKey: string;
        latestMessage: {
          id: string;
          externalMessageId: string;
          from: string;
          fromEmail: string | null;
          subject: string;
          preview: string;
          date: string;
          hasBody: boolean;
        };
        messageCount: number;
        tagsMap: Map<string, { id: string; name: string; color: string | null }>;
      }
    >();
    for (const row of (rows ?? []) as Row[]) {
      const threadKey = String(row.thread_key ?? row.external_message_id ?? row.id ?? "");
      const id = String(row.id ?? "");
      const fromName = row.from_name == null ? null : String(row.from_name);
      const fromEmail = row.from_email == null ? null : String(row.from_email);
      const existing = grouped.get(threadKey);
      const tagLinks = (row.email_message_tags as Row[] | null) ?? [];
      const tags = tagLinks
        .map((link) => link.email_tags as Row | null)
        .filter((t): t is Row => !!t)
        .map((t) => ({
          id: String(t.id),
          name: String(t.name),
          color: t.color == null ? null : String(t.color),
        }));

      if (!existing) {
        const tagsMap = new Map<string, { id: string; name: string; color: string | null }>();
        for (const tag of tags) tagsMap.set(tag.id, tag);
        grouped.set(threadKey, {
          threadKey,
          latestMessage: {
            id,
            externalMessageId: String(row.external_message_id ?? ""),
            from: fromName || fromEmail || "Mittente sconosciuto",
            fromEmail,
            subject: String(row.subject ?? "(Senza oggetto)"),
            preview: String(row.preview ?? ""),
            date: String(row.received_at ?? new Date().toISOString()),
            hasBody:
              String(row.body_text ?? "").trim().length > 0 ||
              String(row.body_html ?? "").trim().length > 0,
          },
          messageCount: 1,
          tagsMap,
        });
      } else {
        existing.messageCount += 1;
        for (const tag of tags) existing.tagsMap.set(tag.id, tag);
      }
    }

    const threads = [...grouped.values()]
      .sort((a, b) => new Date(b.latestMessage.date).getTime() - new Date(a.latestMessage.date).getTime())
      .map((g) => ({
        threadKey: g.threadKey,
        latestMessage: g.latestMessage,
        messageCount: g.messageCount,
        tags: [...g.tagsMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
      }));
    const page = threads.slice(0, limit);
    const hasMore = threads.length > limit;
    const nextCursor = hasMore ? page[page.length - 1]?.latestMessage.date ?? null : null;

    return NextResponse.json({
      ok: true,
      threads: page,
      meta: {
        count: page.length,
        hasMore,
        nextCursor,
        sinceDays,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore lettura inbox DB";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }
  if (!canAccessInbox(userId)) {
    return NextResponse.json({ ok: false, error: "Accesso Inbox negato" }, { status: 403 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { sinceDays?: number };
    const sinceDays = parseSinceDays(
      body.sinceDays == null ? String(DAYS_WINDOW) : String(body.sinceDays)
    );
    const result = await syncInboxFromIcloud(userId, sinceDays);
    return NextResponse.json({ ok: true, ...result, sinceDays });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sincronizzazione inbox";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
