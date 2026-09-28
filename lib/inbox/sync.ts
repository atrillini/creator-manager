import "server-only";
import { ImapFlow, type ListResponse, type SearchObject } from "imapflow";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadBrandMatcher } from "@/lib/inbox/brand-match";
import { htmlToText, normalizeBodyText, normalizeSubject, stripQuotedReply } from "@/lib/inbox/text";

/**
 * Sync incrementale IMAP → Supabase.
 * - Per ogni cartella salva l'ultimo UID letto: a ogni giro scarica solo i messaggi nuovi.
 * - Il filtro sull'indirizzo collaborazioni lo fa il server IMAP (SEARCH TO/CC/FROM).
 * - Primo avvio: storico degli ultimi INBOX_BACKFILL_DAYS giorni, a blocchi, anche su più giri.
 * - Rispetta una deadline: si ferma in tempo e riprende al giro successivo.
 */

const BATCH_SIZE = 40;
const DEFAULT_BACKFILL_DAYS = 365;
/** Thread nuovi più vecchi di così (import storico) partono come "gestita". */
const HISTORY_CUTOFF_DAYS = 14;

type Direction = "in" | "out";

export type InboxSyncResult = {
  inbound: number;
  outbound: number;
  threadsTouched: number;
  /** false = rimasti messaggi da scaricare (deadline raggiunta). */
  complete: boolean;
  errors: string[];
};

type SyncOptions = {
  supabase: SupabaseClient;
  userId: string;
  /** Timestamp (ms) entro cui chiudere. */
  deadline: number;
};

type ParsedItem = {
  uid: number;
  direction: Direction;
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  subject: string;
  fromName: string | null;
  fromEmail: string | null;
  toEmails: string[];
  bodyText: string;
  bodyHtml: string | null;
  preview: string;
  receivedAt: string;
  attachments: { filename: string; contentType: string; size: number }[];
};

function env(name: string) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Config email incompleta: manca ${name}`);
  return v;
}

function normalizeMessageId(input: string) {
  return input.trim().replace(/^<|>$/g, "");
}

function addresses(field: AddressObject | AddressObject[] | undefined) {
  const list = Array.isArray(field) ? field : field ? [field] : [];
  return list.flatMap((a) => a.value).map((v) => ({
    name: v.name?.trim() || null,
    email: v.address?.trim().toLowerCase() || null,
  }));
}

function toItem(uid: number, direction: Direction, parsed: ParsedMail, internalDate: Date | null): ParsedItem {
  const from = addresses(parsed.from)[0];
  const toEmails = [...addresses(parsed.to), ...addresses(parsed.cc)]
    .map((a) => a.email)
    .filter((e): e is string => !!e);
  const html = typeof parsed.html === "string" ? parsed.html : "";
  const text = normalizeBodyText(parsed.text ?? "") || htmlToText(html);
  const refs = (Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [])
    .map(normalizeMessageId)
    .filter(Boolean);
  const date = parsed.date instanceof Date && !Number.isNaN(parsed.date.getTime()) ? parsed.date : internalDate;
  return {
    uid,
    direction,
    messageId: normalizeMessageId(parsed.messageId ?? `${uid}.${direction}@imap-uid.local`),
    inReplyTo: parsed.inReplyTo ? normalizeMessageId(parsed.inReplyTo) : null,
    references: refs,
    subject: parsed.subject?.trim() || "(Senza oggetto)",
    fromName: from?.name ?? null,
    fromEmail: from?.email ?? null,
    toEmails,
    bodyText: text,
    bodyHtml: html || null,
    preview: stripQuotedReply(text).replace(/\s+/g, " ").slice(0, 180),
    receivedAt: (date ?? new Date()).toISOString(),
    attachments: parsed.attachments
      .filter((a) => !a.related)
      .map((a) => ({
        filename: a.filename ?? "allegato",
        contentType: a.contentType,
        size: a.size,
      })),
  };
}

async function findSentMailbox(client: ImapFlow): Promise<string | null> {
  const boxes: ListResponse[] = await client.list();
  const bySpecialUse = boxes.find((b) => b.specialUse === "\\Sent");
  if (bySpecialUse) return bySpecialUse.path;
  const byName = boxes.find((b) => /^(sent messages|sent|inviati|posta inviata)$/i.test(b.name));
  return byName?.path ?? null;
}

type SyncState = { uid_validity: string | null; last_uid: number; backfill_since: string | null };

async function loadState(supabase: SupabaseClient, userId: string, mailbox: string): Promise<SyncState | null> {
  const { data } = await supabase
    .from("email_sync_state")
    .select("uid_validity, last_uid, backfill_since")
    .eq("user_id", userId)
    .eq("mailbox", mailbox)
    .maybeSingle<SyncState>();
  return data ?? null;
}

async function saveState(
  supabase: SupabaseClient,
  userId: string,
  mailbox: string,
  patch: Record<string, unknown>
) {
  const { error } = await supabase
    .from("email_sync_state")
    .upsert({ user_id: userId, mailbox, ...patch }, { onConflict: "user_id,mailbox" });
  if (error) throw new Error(`Stato sync: ${error.message}`);
}

/**
 * Trova o crea i thread per i messaggi del blocco e restituisce messageId → threadId.
 * Poche query per blocco (lookup e insert in massa): la latenza verso il DB è il collo di bottiglia.
 */
async function assignThreads(supabase: SupabaseClient, userId: string, items: ParsedItem[]) {
  const candidateIds = new Set<string>();
  for (const it of items) {
    candidateIds.add(it.messageId);
    if (it.inReplyTo) candidateIds.add(it.inReplyTo);
    for (const r of it.references) candidateIds.add(r);
  }
  const known = new Map<string, string>();
  const ids = [...candidateIds];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase
      .from("email_messages")
      .select("external_message_id, thread_id")
      .eq("user_id", userId)
      .in("external_message_id", ids.slice(i, i + 150))
      .not("thread_id", "is", null);
    if (error) throw new Error(`Lettura thread: ${error.message}`);
    for (const r of data ?? []) known.set(String(r.external_message_id), String(r.thread_id));
  }

  // 1) Per ogni messaggio: thread già noto oppure chiave del thread da creare.
  const keyOf = new Map<string, string>();
  const threadOf = new Map<string, string>();
  const subjectOfKey = new Map<string, string>();
  for (const it of [...items].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))) {
    const parents = [it.messageId, it.inReplyTo, ...[...it.references].reverse()].filter((x): x is string => !!x);
    const knownThread = parents.map((x) => known.get(x)).find(Boolean);
    if (knownThread) {
      threadOf.set(it.messageId, knownThread);
      continue;
    }
    const inBatchKey = parents.map((x) => keyOf.get(x)).find(Boolean);
    const key = inBatchKey ?? it.references[0] ?? it.inReplyTo ?? it.messageId;
    keyOf.set(it.messageId, key);
    if (!subjectOfKey.has(key)) subjectOfKey.set(key, normalizeSubject(it.subject));
  }

  // 2) Thread per chiave: esistenti in una query, mancanti in un solo insert.
  const keys = [...subjectOfKey.keys()];
  const idByKey = new Map<string, string>();
  for (let i = 0; i < keys.length; i += 150) {
    const { data, error } = await supabase
      .from("email_threads")
      .select("id, thread_key")
      .eq("user_id", userId)
      .in("thread_key", keys.slice(i, i + 150));
    if (error) throw new Error(`Lettura thread: ${error.message}`);
    for (const r of data ?? []) idByKey.set(String(r.thread_key), String(r.id));
  }
  const missing = keys.filter((k) => !idByKey.has(k));
  if (missing.length) {
    const { data, error } = await supabase
      .from("email_threads")
      .upsert(
        missing.map((k) => ({ user_id: userId, thread_key: k, subject: subjectOfKey.get(k) ?? "" })),
        { onConflict: "user_id,thread_key" }
      )
      .select("id, thread_key");
    if (error) throw new Error(`Creazione thread: ${error.message}`);
    for (const r of data ?? []) idByKey.set(String(r.thread_key), String(r.id));
  }
  for (const [messageId, key] of keyOf) {
    const id = idByKey.get(key);
    if (id) threadOf.set(messageId, id);
  }
  return threadOf;
}

async function storeBatch(
  supabase: SupabaseClient,
  userId: string,
  mailbox: string,
  items: ParsedItem[]
): Promise<string[]> {
  if (!items.length) return [];
  const threadOf = await assignThreads(supabase, userId, items);
  const now = new Date().toISOString();
  const rows = items.map((it) => ({
    user_id: userId,
    provider: "icloud",
    mailbox,
    external_message_id: it.messageId,
    thread_key: it.references[0] ?? it.inReplyTo ?? it.messageId,
    thread_id: threadOf.get(it.messageId),
    direction: it.direction,
    in_reply_to: it.inReplyTo,
    references_ids: it.references,
    from_name: it.fromName,
    from_email: it.fromEmail,
    to_emails: it.toEmails,
    subject: it.subject,
    preview: it.preview,
    body_text: it.bodyText,
    body_html: it.bodyHtml,
    received_at: it.receivedAt,
    attachments: it.attachments,
    imap_uid: it.uid,
    last_synced_at: now,
    updated_at: now,
  }));
  const { error } = await supabase
    .from("email_messages")
    .upsert(rows, { onConflict: "user_id,provider,mailbox,external_message_id" });
  if (error) throw new Error(`Salvataggio email: ${error.message}`);
  return [...new Set(threadOf.values())];
}

async function syncMailbox(
  client: ImapFlow,
  opts: SyncOptions & { mailbox: string; direction: Direction; filter: SearchObject; since: Date },
  touched: Set<string>
) {
  const { supabase, userId, mailbox, direction, deadline } = opts;
  const lock = await client.getMailboxLock(mailbox);
  let processed = 0;
  let complete = true;
  try {
    const box = client.mailbox;
    const uidValidity = box ? String(box.uidValidity) : null;
    const state = await loadState(supabase, userId, mailbox);
    let lastUid = state && state.uid_validity === uidValidity ? Number(state.last_uid) : 0;
    const backfillSince = state?.backfill_since ?? opts.since.toISOString().slice(0, 10);
    await saveState(supabase, userId, mailbox, {
      uid_validity: uidValidity,
      last_uid: lastUid,
      backfill_since: backfillSince,
      last_run_at: new Date().toISOString(),
    });

    const found = await client.search(
      { ...opts.filter, uid: `${lastUid + 1}:*`, since: new Date(`${backfillSince}T00:00:00Z`) },
      { uid: true }
    );
    const uids = (found || []).filter((u) => u > lastUid).sort((a, b) => a - b);

    for (let i = 0; i < uids.length; i += BATCH_SIZE) {
      if (Date.now() > deadline) {
        complete = false;
        break;
      }
      const chunk = uids.slice(i, i + BATCH_SIZE);
      const items: ParsedItem[] = [];
      for await (const msg of client.fetch(chunk, { uid: true, source: true, internalDate: true }, { uid: true })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        const internal = msg.internalDate instanceof Date ? msg.internalDate : null;
        items.push(toItem(msg.uid, direction, parsed, internal));
      }
      const threadIds = await storeBatch(supabase, userId, mailbox, items);
      threadIds.forEach((t) => touched.add(t));
      processed += items.length;
      lastUid = Math.max(lastUid, ...chunk);
      await saveState(supabase, userId, mailbox, { last_uid: lastUid });
    }
    await saveState(supabase, userId, mailbox, {
      last_error: null,
      ...(complete ? { last_success_at: new Date().toISOString() } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await saveState(supabase, userId, mailbox, { last_error: message.slice(0, 500) }).catch(() => undefined);
    throw err;
  } finally {
    lock.release();
  }
  return { processed, complete };
}

/**
 * Aggiorna aggregati, stato "cosa devo fare" e brand (regole) dei thread toccati.
 * - Ultimo messaggio mio → "in attesa del brand".
 * - Nuova risposta del brand su un thread in attesa/gestito → "da rispondere".
 * - Thread nuovi dell'import storico → "gestita" (niente valanga di "nuove").
 */
async function updateTouchedThreads(supabase: SupabaseClient, userId: string, threadIds: string[]) {
  if (!threadIds.length) return;
  const { error: rpcError } = await supabase.rpc("refresh_email_threads", { p_thread_ids: threadIds });
  if (rpcError) throw new Error(`Aggiornamento thread: ${rpcError.message}`);

  const { data: threads } = await supabase
    .from("email_threads")
    .select("id, status, category, brand_id, last_direction, last_message_at, participants")
    .eq("user_id", userId)
    .in("id", threadIds);

  const matcher = await loadBrandMatcher(supabase, userId);
  const historyCutoff = Date.now() - HISTORY_CUTOFF_DAYS * 86_400_000;
  const updates = ((threads ?? []) as {
    id: string;
    status: string;
    category: string | null;
    brand_id: string | null;
    last_direction: string | null;
    last_message_at: string | null;
    participants: string[];
  }[]).map((t) => {
    let status = t.status;
    const isOld = t.last_message_at ? new Date(t.last_message_at).getTime() < historyCutoff : false;
    if (t.last_direction === "out") {
      if (status !== "archiviata" || t.category !== "non_pertinente") status = isOld ? "gestita" : "in_attesa";
    } else if (status === "nuova") {
      if (isOld) status = "gestita";
    } else if (status === "in_attesa" || status === "gestita" || (status === "archiviata" && t.category !== "non_pertinente")) {
      status = isOld ? status : "da_rispondere";
    }
    const patch: Record<string, unknown> = { status, ai_status: "pending" };
    if (!t.brand_id) {
      const brandId = matcher.match(t.participants);
      if (brandId) {
        patch.brand_id = brandId;
        patch.brand_source = "regola";
      }
    }
    return { id: t.id, patch };
  });
  // Aggiornamenti in parallelo (a gruppi) per non pagare la latenza uno alla volta.
  for (let i = 0; i < updates.length; i += 10) {
    await Promise.all(
      updates
        .slice(i, i + 10)
        .map((u) => supabase.from("email_threads").update(u.patch).eq("id", u.id).eq("user_id", userId))
    );
  }
}

export async function syncInbox(opts: SyncOptions): Promise<InboxSyncResult> {
  const address = env("COLLAB_EMAIL_ADDRESS").toLowerCase();
  const backfillDays = Number(process.env.INBOX_BACKFILL_DAYS ?? DEFAULT_BACKFILL_DAYS) || DEFAULT_BACKFILL_DAYS;
  const since = new Date(Date.now() - backfillDays * 86_400_000);
  const client = new ImapFlow({
    host: process.env.IMAP_HOST?.trim() || "imap.mail.me.com",
    port: 993,
    secure: true,
    auth: { user: env("ICLOUD_EMAIL"), pass: env("ICLOUD_APP_PASSWORD") },
    logger: false,
  });

  const touched = new Set<string>();
  const errors: string[] = [];
  let inbound = 0;
  let outbound = 0;
  let complete = true;

  await client.connect();
  try {
    const inRes = await syncMailbox(
      client,
      { ...opts, mailbox: "INBOX", direction: "in", filter: { or: [{ to: address }, { cc: address }] }, since },
      touched
    );
    inbound = inRes.processed;
    complete = inRes.complete;

    if (Date.now() < opts.deadline) {
      const sent = await findSentMailbox(client);
      if (sent) {
        try {
          const outRes = await syncMailbox(
            client,
            { ...opts, mailbox: sent, direction: "out", filter: { from: address }, since },
            touched
          );
          outbound = outRes.processed;
          complete = complete && outRes.complete;
        } catch (err) {
          errors.push(`Inviati: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        errors.push("Cartella Inviati non trovata");
      }
    } else {
      complete = false;
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  await updateTouchedThreads(opts.supabase, opts.userId, [...touched]);
  return { inbound, outbound, threadsTouched: touched.size, complete, errors };
}
