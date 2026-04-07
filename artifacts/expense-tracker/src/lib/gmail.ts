import { db, generateId } from "./db";

interface GmailMessage { id: string; threadId: string; }
interface GmailMessageFull {
  id: string;
  payload?: {
    headers?: { name: string; value: string }[];
    parts?: GmailPart[];
    body?: { data?: string };
    mimeType?: string;
  };
}
interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

// --- Sender trust list ---
// Only process emails from known Indian bank / payment service senders
const TRUSTED_SENDER_RE =
  /hdfc|sbi|icici|axis|kotak|idbi|indusind|yesbank|canarabank|unionbank|bankofbaroda|pnb|boi\.|paytm|phonepe|gpay|googlepay|amazonpay|mobikwik|freecharge|cred\.|alerts@|notify@|noreply@|transaction@|netbanking|upi@|upi-|npci|alerts\.bank|bankof/i;

// --- Subjects that are definitely NOT transaction alerts ---
const SKIP_SUBJECT_RE =
  /\botp\b|one.time.pass|e-statement|password|reset|special offer|exclusive offer|pre.?approved|credit limit increase|bill generated|minimum amount due|payment due date|earn cashback|reward point|newsletter|marketing|congratul|welcome.*card|welcome.*account|feedback|survey|apply now|upgrade your|know your|dear customer.*offer|get.{0,30}(?:₹|rs\.?|inr)?.{0,10}\d+.{0,20}cashback|cashback.{0,20}on.{0,40}(?:payment|paying|tax|bill|recharge|purchase)|avail.{0,30}(?:cashback|offer|reward)|save.{0,20}(?:with|using|on).{0,30}card/i;

// --- Debit signals (covers all major Indian bank alert formats) ---
const DEBIT_RE =
  /\b(debited|debit|paid|payment made|withdrawn|spent|charged|purchase|sent|transferred to|has been used|used at|used for a transaction|amount.*deducted|card.*used|tap.*pay|mandate.*executed|emi.*deducted|standing instruction|auto.?debit|fund.?transfer|outward.{0,10}(?:neft|imps|rtgs)|neft.{0,20}(?:transfer|debit|outward)|imps.{0,20}(?:transfer|debit)|rtgs.{0,20}(?:transfer|debit)|account.*transfer)\b/i;

// --- Credit signals (must look like an actual credit, not a cashback offer) ---
const CREDIT_RE =
  /\b(credited|credit|received|refund|salary|deposited|transfer received|payment received|amount.*credited|money.*received|funds.*received|neft.*credit|imps.*credit|inward.*neft|inward.*imps)\b/i;

// --- Hard filters: skip if body or subject matches these promotional patterns ---
const SKIP_BODY_RE =
  /click here to (apply|buy|shop|avail)|limited time offer|exclusive deal|shop now|buy now|upgrade now|pre.?approved offer|special discount|upto \d+% off|\d+% cashback on shopping/i;

// --- Promotional offer pattern: "Get ₹X cashback", "Earn X cashback when you pay", etc.
// These are marketing emails, not real transaction confirmations.
const PROMO_OFFER_RE =
  /\bget\b.{0,60}(?:₹|rs\.?|inr\s*)?\d.{0,20}\bcashback\b|\bcashback\b.{0,40}(?:on|when|by|if)\b.{0,60}(?:pay|using|with|transact)|\bavail\b.{0,40}\bcashback\b|\bexclusive\b.{0,30}\bcashback\b/i;

// --- Words that should never appear in a real merchant name ---
const INVALID_MERCHANT_RE =
  /\b(?:cashback|reward|offer|discount|voucher|prize|win|upto|bonus|exclusive|limited|click|avail|earn reward)\b/i;

async function gmailFetch(path: string, token: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail API error: ${res.status}`);
  return res.json();
}

function extractText(part: GmailMessageFull["payload"]): string {
  if (!part) return "";
  // Prefer plain text
  if (part.mimeType === "text/plain" && part.body?.data) {
    return atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
  }
  // Fall back to HTML (strip tags)
  if (part.mimeType === "text/html" && part.body?.data) {
    const html = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  }
  if (part.parts) return part.parts.map(p => extractText(p as GmailMessageFull["payload"])).join("\n");
  return "";
}

export interface ParsedEmailTransaction {
  tempId: string;
  gmailMessageId: string;
  amount: number;
  type: "income" | "expense";
  description: string;
  merchantName: string | null;
  date: string;
  categoryId: string | null;
  subject: string;
  fromEmail: string;
}

function parseEmailForTransaction(
  body: string,
  subject: string,
  from: string,
  emailDate: string,
  gmailMessageId: string,
): ParsedEmailTransaction | null {
  const fromLower = from.toLowerCase();

  // Must be from a trusted sender
  if (!TRUSTED_SENDER_RE.test(fromLower)) return null;

  // Skip known non-transaction subjects
  if (SKIP_SUBJECT_RE.test(subject)) return null;

  const text = `${subject}\n${body}`;

  // Hard filter on body content
  if (SKIP_BODY_RE.test(body)) return null;

  // Skip promotional cashback/offer emails.
  // Only check subject + first 500 chars of body — many legitimate transaction alert emails
  // have promotional footers that would otherwise cause false negatives.
  const promoCheckArea = `${subject}\n${body.slice(0, 500)}`;
  if (PROMO_OFFER_RE.test(promoCheckArea)) return null;

  // Must have a debit or credit signal
  const isDebit = DEBIT_RE.test(text);
  const isCredit = CREDIT_RE.test(text);
  if (!isDebit && !isCredit) return null;

  // Must have a rupee amount in a recognised format
  const amountMatch =
    text.match(/(?:Rs\.?\s*|INR\s*|₹\s*)([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
    text.match(/([0-9,]+(?:\.[0-9]{2}))\s*(?:Rs\.?|INR|₹)/i);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (isNaN(amount) || amount <= 0 || amount > 10_000_000) return null;

  const type: "income" | "expense" = isCredit && !isDebit ? "income" : "expense";

  // --- Merchant extraction (order matters — first match wins) ---
  let merchantName: string | null = null;
  const merchantPatterns = [
    // ICICI "Info: MERCHANT NAME" format
    /\binfo[:\s]+([A-Z][A-Za-z0-9\s&'.\-/]{2,60}?)(?:\s*[.\n]|$)/i,
    // NEFT/IMPS beneficiary / remitter (sender for incoming)
    /(?:beneficiary name|remitter name|payee name)[:\s]+([A-Za-z0-9\s&'.\-]{2,60}?)(?:\s*[\n.,]|$)/i,
    // "at MERCHANT" / "to MERCHANT" — most common
    /(?:\bat\b|\bto\b|\btowards\b)\s+([A-Z][A-Za-z0-9\s&'.\-/]{2,60}?)(?:\s+on\b|\s+via\b|\s+UPI\b|\s+dated\b|\s*[.,\n]|$)/i,
    // "merchant: / payee: / beneficiary: / VPA:"
    /(?:merchant|payee|beneficiary|VPA)[:\s]+([A-Za-z0-9\s&'.\-@]{2,60}?)(?:\s*[\n.,]|$)/i,
    // "paid to / payment to"
    /(?:paid to|payment to)\s+([A-Za-z0-9\s&'.\-]{2,60}?)(?:\s+on\b|\s*[\n.,]|$)/i,
    // "transferred to" / "sent to"
    /(?:transferred to|sent to)\s+([A-Za-z0-9\s&'.\-]{2,60}?)(?:\s+on\b|\s*[\n.,]|$)/i,
  ];
  for (const p of merchantPatterns) {
    const m = text.match(p);
    const candidate = m?.[1]?.trim();
    if (candidate && candidate.length > 1 && candidate.length < 65) {
      // Skip if the extracted "merchant" looks like a date, amount, or promo text
      if (/^\d/.test(candidate)) continue;
      if (INVALID_MERCHANT_RE.test(candidate)) continue;
      // Skip if too many words — likely grabbed a sentence fragment, not a merchant name
      if (candidate.split(/\s+/).length > 6) continue;
      merchantName = candidate.replace(/\s+/g, " ");
      break;
    }
  }

  // --- Date extraction ---
  let date = emailDate || new Date().toISOString();
  const datePatterns = [
    /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/,
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*[,.]?\s*(\d{4})/i,
    /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/,
  ];
  for (const p of datePatterns) {
    const m = body.match(p) || subject.match(p);
    if (m) {
      try {
        const parsed = new Date(m[0]);
        if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2020 && parsed <= new Date()) {
          date = parsed.toISOString();
          break;
        }
      } catch { /* keep email header date */ }
    }
  }

  // --- Auto-categorise ---
  const categoryMap: Record<string, RegExp> = {
    "cat-food": /swiggy|zomato|dominos|pizza|kfc|mcdonald|burger|restaurant|cafe|foodpanda|dunzo|blinkit.*food/i,
    "cat-transport": /uber|ola|rapido|taxi|cab|auto|metro|irctc|makemytrip|goibibo|flight|petrol|fuel|fastag|parking|toll|fuel station|petrol pump/i,
    "cat-shopping": /amazon|flipkart|myntra|meesho|nykaa|ajio|snapdeal|shopping|mart|store|reliance|dmart/i,
    "cat-entertainment": /netflix|spotify|prime.*video|hotstar|youtube.*premium|disney|bookmyshow|inox|pvr/i,
    "cat-health": /hospital|clinic|pharma|medicine|doctor|health|apollo|medplus|1mg|netmeds/i,
    "cat-bills": /electricity|water.*bill|gas.*bill|broadband|wifi|airtel|jio|\bvi\b|bsnl|recharge|postpaid|bill.*pay/i,
    "cat-groceries": /blinkit|zepto|bigbasket|grofers|grocery|supermarket|fresh.*market/i,
    "cat-salary": /salary|payroll|wages|stipend/i,
  };
  let categoryId: string | null = null;
  const haystack = `${merchantName ?? ""} ${subject} ${body.slice(0, 200)}`;
  for (const [catId, re] of Object.entries(categoryMap)) {
    if (re.test(haystack)) { categoryId = catId; break; }
  }

  // Build a clean fallback description when no merchant name could be extracted.
  // Prefer "HDFC UPI Debit" style labels over dumping the raw subject line.
  const bankName =
    /hdfc/i.test(from) ? "HDFC" :
    /icici/i.test(from) ? "ICICI" :
    /axis/i.test(from) ? "Axis" :
    /kotak/i.test(from) ? "Kotak" :
    /sbi/i.test(from) ? "SBI" :
    /indusind/i.test(from) ? "IndusInd" :
    /yesbank/i.test(from) ? "Yes Bank" :
    /paytm/i.test(from) ? "Paytm" :
    /phonepe/i.test(from) ? "PhonePe" :
    /gpay|google/i.test(from) ? "Google Pay" :
    null;
  const txChannel =
    /\bneft\b/i.test(text) ? "NEFT" :
    /\bimps\b/i.test(text) ? "IMPS" :
    /\bupi\b/i.test(text) ? "UPI" :
    /\brtgs\b/i.test(text) ? "RTGS" :
    null;
  const fallback = [bankName, txChannel, type === "expense" ? "Debit" : "Credit"]
    .filter(Boolean).join(" ") || (type === "expense" ? "Bank Debit" : "Bank Credit");

  const description = merchantName
    ? `${type === "expense" ? "Payment to" : "Receipt from"} ${merchantName}`
    : fallback;

  return {
    tempId: generateId(),
    gmailMessageId,
    amount,
    type,
    description,
    merchantName: merchantName ?? null,
    date,
    categoryId,
    subject,
    fromEmail: from,
  };
}

export interface GmailScanOptions {
  fromDate?: Date;
  toDate?: Date;
  maxResults?: number;
}

/**
 * Scan Gmail for transaction emails and return a preview list.
 * Does NOT save anything to the database — call importSelectedTransactions for that.
 */
export async function scanGmail(
  accessToken: string,
  options: GmailScanOptions = {}
): Promise<{ transactions: ParsedEmailTransaction[]; totalScanned: number }> {
  const { fromDate, toDate, maxResults = 200 } = options;

  // Always default to 90 days back — never use lastSyncSetting for interactive scan
  // (lastSync is only for incremental background sync, not for manual scan)
  const defaultFrom = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const afterTimestamp = Math.floor((fromDate ? fromDate.getTime() : defaultFrom) / 1000);

  // Keep query intentionally BROAD — category filters excluded because Indian bank
  // transaction alerts (HDFC, ICICI, Axis, etc.) routinely land in Gmail's "Updates"
  // tab, which -category:updates would silently block. Content-based filtering in
  // parseEmailForTransaction() handles false positives instead.
  let query = [
    `after:${afterTimestamp}`,
    `(debited OR credited OR "has been used" OR "transaction of" OR "UPI" OR "NEFT" OR "IMPS" OR "transaction alert" OR "account alert")`,
    `-subject:OTP`,
    `-subject:"one time password"`,
    `-subject:"bill generated"`,
    `-subject:"minimum amount due"`,
    `-subject:"payment due"`,
  ].join(" ");

  if (toDate) {
    query += ` before:${Math.floor(toDate.getTime() / 1000)}`;
  }

  const listData = await gmailFetch(
    `users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    accessToken
  ) as { messages?: GmailMessage[] };

  const messages = listData.messages ?? [];
  const results: ParsedEmailTransaction[] = [];

  for (const msg of messages) {
    try {
      // Skip already-imported emails
      const existing = await db.transactions.where("gmailMessageId").equals(msg.id).count();
      if (existing > 0) continue;

      const full = await gmailFetch(`users/me/messages/${msg.id}?format=full`, accessToken) as GmailMessageFull;
      const headers = full.payload?.headers ?? [];
      const subject = headers.find(h => h.name === "Subject")?.value ?? "";
      const from = headers.find(h => h.name === "From")?.value ?? "";
      const dateHeader = headers.find(h => h.name === "Date")?.value ?? "";

      let emailDate = new Date().toISOString();
      try {
        const parsed = new Date(dateHeader);
        if (!isNaN(parsed.getTime())) emailDate = parsed.toISOString();
      } catch { /* keep fallback */ }

      const body = extractText(full.payload) || subject;
      const parsed = parseEmailForTransaction(body, subject, from, emailDate, msg.id);
      if (parsed) results.push(parsed);
    } catch (e) {
      console.warn("Failed to process message", msg.id, e);
    }
  }

  // Sort newest first
  results.sort((a, b) => b.date.localeCompare(a.date));

  return { transactions: results, totalScanned: messages.length };
}

/**
 * Save the user-selected transactions from the preview list into the database.
 */
export async function importSelectedTransactions(
  selected: ParsedEmailTransaction[]
): Promise<number> {
  let count = 0;
  const now = new Date().toISOString();

  for (const item of selected) {
    // Final dedup guard
    const existing = await db.transactions.where("gmailMessageId").equals(item.gmailMessageId).count();
    if (existing > 0) continue;

    await db.transactions.add({
      id: generateId(),
      amount: item.amount,
      type: item.type,
      description: item.description,
      merchantName: item.merchantName,
      date: item.date,
      categoryId: item.categoryId,
      accountId: null,
      notes: null,
      importSource: "email",
      gmailMessageId: item.gmailMessageId,
      createdAt: now,
      updatedAt: now,
    });
    count++;
  }

  await db.settings.put({ id: "gmail_last_sync", key: "gmail_last_sync", value: String(Date.now()) });
  return count;
}

export async function getGmailStatus(): Promise<{ lastSyncAt: Date | null }> {
  const lastSync = await db.settings.get("gmail_last_sync");
  return { lastSyncAt: lastSync ? new Date(parseInt(lastSync.value)) : null };
}
