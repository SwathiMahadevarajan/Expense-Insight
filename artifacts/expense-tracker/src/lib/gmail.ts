import { db, generateId, type Transaction } from "./db";

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

// Only process emails from known Indian bank / payment senders
const TRUSTED_SENDER_RE = /hdfc|sbi|icici|axis|kotak|idbi|indusind|yesbank|canarabank|unionbank|bankofbaroda|pnb|boi\.|paytm|phonepe|gpay|googlepay|amazonpay|mobikwik|freecharge|cred\.|alerts@|notify@|noreply@.*bank|transaction@|netbanking|upi@|upi-|npci/i;

// Skip subjects that are clearly NOT transaction notifications
const SKIP_SUBJECT_RE = /\botp\b|one.time.pass|statement|e-statement|password|reset|offer|promo|cashback offer|congratul|welcome|feedback|survey|reward points|newsletter|marketing/i;

async function gmailFetch(path: string, token: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail API error: ${res.status}`);
  return res.json();
}

function extractText(part: GmailMessageFull["payload"]): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
  }
  if (part.parts) return part.parts.map(p => extractText(p as GmailMessageFull["payload"])).join("\n");
  return "";
}

function parseEmailForTransaction(
  body: string,
  subject: string,
  from: string,
  emailDate: string
): Omit<Transaction, "id" | "createdAt" | "updatedAt" | "gmailMessageId"> | null {
  // Skip if from an untrusted sender
  if (!TRUSTED_SENDER_RE.test(from)) return null;

  // Skip known non-transaction subjects
  if (SKIP_SUBJECT_RE.test(subject)) return null;

  const text = `${subject}\n${body}`;

  // Must have a clear debit or credit signal
  const isDebit = /\b(debited|debit|paid|payment made|withdrawn|spent|charged|purchase|sent|transferred to)\b/i.test(text);
  const isCredit = /\b(credited|credit|received|refund|cashback|salary|deposited|transfer received|payment received)\b/i.test(text);
  if (!isDebit && !isCredit) return null;

  // Must have a rupee amount — be strict about format
  const amountMatch =
    text.match(/(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
    text.match(/([0-9,]+(?:\.[0-9]{2}))\s*(?:Rs\.?|INR|₹)/i);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (isNaN(amount) || amount <= 0 || amount > 10_000_000) return null;

  const type: "income" | "expense" = isCredit && !isDebit ? "income" : "expense";

  // Extract merchant/payee
  let merchantName: string | null = null;
  const merchantPatterns = [
    /(?:at|to|towards)\s+([A-Z][A-Za-z0-9\s&'.\-]{2,50}?)(?:\s+on\b|\s+via\b|\s+UPI\b|\s*[.\n]|$)/i,
    /(?:merchant|payee|beneficiary|VPA)[:\s]+([A-Za-z0-9\s&'.\-@]+?)(?:\s*[\n.]|$)/i,
    /(?:paid to|payment to)\s+([A-Za-z0-9\s&'.\-]{2,50}?)(?:\s+on\b|\s*[\n.]|$)/i,
  ];
  for (const p of merchantPatterns) {
    const m = text.match(p);
    if (m?.[1]?.trim().length > 1) {
      merchantName = m[1].trim().replace(/\s+/g, " ").slice(0, 60);
      break;
    }
  }

  // Extract date from email itself (prefer email header date over body)
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

  // Auto-categorise based on merchant / text
  const categoryMap: Record<string, RegExp> = {
    "cat-food": /swiggy|zomato|dominos|pizza|kfc|mcdonald|burger|restaurant|cafe|foodpanda|dunzo|blinkit.*food/i,
    "cat-transport": /uber|ola|rapido|taxi|cab|auto|metro|irctc|makemytrip|goibibo|flight|petrol|fuel|fastag|parking|toll/i,
    "cat-shopping": /amazon|flipkart|myntra|meesho|nykaa|ajio|snapdeal|shopping|mart|store|reliance|dmart/i,
    "cat-entertainment": /netflix|spotify|prime.*video|hotstar|youtube.*premium|disney|bookmyshow|inox|pvr/i,
    "cat-health": /hospital|clinic|pharma|medicine|doctor|health|apollo|medplus|1mg|netmeds/i,
    "cat-bills": /electricity|water.*bill|gas.*bill|broadband|wifi|airtel|jio|vi |bsnl|recharge|postpaid|bill.*pay/i,
    "cat-groceries": /blinkit|zepto|bigbasket|grofers|grocery|supermarket|fresh.*market/i,
    "cat-salary": /salary|payroll|wages|stipend/i,
  };
  let categoryId: string | null = null;
  const haystack = `${merchantName ?? ""} ${subject}`;
  for (const [catId, re] of Object.entries(categoryMap)) {
    if (re.test(haystack)) { categoryId = catId; break; }
  }

  const description = merchantName
    ? `${type === "expense" ? "Payment to" : "Receipt from"} ${merchantName}`
    : subject.slice(0, 100) || "Bank transaction";

  return { amount, type, description, merchantName: merchantName ?? null, date, categoryId, accountId: null, importSource: "email", notes: null };
}

export interface GmailSyncOptions {
  fromDate?: Date;
  toDate?: Date;
  maxResults?: number;
}

export async function syncGmail(
  accessToken: string,
  options: GmailSyncOptions = {}
): Promise<{ imported: number; skipped: number; errors: number }> {
  const { fromDate, toDate, maxResults = 150 } = options;

  let afterTimestamp: number;
  if (fromDate) {
    afterTimestamp = Math.floor(fromDate.getTime() / 1000);
  } else {
    const lastSyncSetting = await db.settings.get("gmail_last_sync");
    const lastSync = lastSyncSetting
      ? parseInt(lastSyncSetting.value)
      : Date.now() - 30 * 24 * 60 * 60 * 1000;
    afterTimestamp = Math.floor(lastSync / 1000);
  }

  // Tight query — only transaction-like emails
  let query = `after:${afterTimestamp} (debited OR credited OR "UPI payment" OR "NEFT" OR "IMPS" OR "transaction alert" OR "bank alert") -category:promotions -category:social -category:updates -subject:OTP -subject:statement -subject:offer`;

  if (toDate) {
    query += ` before:${Math.floor(toDate.getTime() / 1000)}`;
  }

  let imported = 0, skipped = 0, errors = 0;

  try {
    const listData = await gmailFetch(
      `users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
      accessToken
    ) as { messages?: GmailMessage[] };

    const messages = listData.messages ?? [];

    for (const msg of messages) {
      try {
        // Check duplicate by gmailMessageId
        const existing = await db.transactions.where("gmailMessageId").equals(msg.id).count();
        if (existing > 0) { skipped++; continue; }

        const full = await gmailFetch(`users/me/messages/${msg.id}?format=full`, accessToken) as GmailMessageFull;
        const headers = full.payload?.headers ?? [];
        const subject = headers.find(h => h.name === "Subject")?.value ?? "";
        const from = headers.find(h => h.name === "From")?.value ?? "";
        const dateHeader = headers.find(h => h.name === "Date")?.value ?? "";

        let emailDate = new Date().toISOString();
        try {
          const parsed = new Date(dateHeader);
          if (!isNaN(parsed.getTime())) emailDate = parsed.toISOString();
        } catch { /* ignore */ }

        const body = extractText(full.payload) || subject;
        const parsed = parseEmailForTransaction(body, subject, from, emailDate);
        if (!parsed) { skipped++; continue; }

        // Extra duplicate check: same amount + same date (day) + same type
        const txDate = parsed.date.split("T")[0];
        const dayStart = `${txDate}T00:00:00.000Z`;
        const dayEnd = `${txDate}T23:59:59.999Z`;
        const sameDayTxs = await db.transactions
          .where("date").between(dayStart, dayEnd, true, true)
          .filter(t => t.amount === parsed.amount && t.type === parsed.type && t.importSource === "email")
          .count();
        if (sameDayTxs > 0) { skipped++; continue; }

        const now = new Date().toISOString();
        await db.transactions.add({
          id: generateId(),
          ...parsed,
          gmailMessageId: msg.id,
          createdAt: now,
          updatedAt: now,
        });
        imported++;
      } catch (e) {
        console.warn("Failed to process message", msg.id, e);
        errors++;
      }
    }

    await db.settings.put({ id: "gmail_last_sync", key: "gmail_last_sync", value: String(Date.now()) });
  } catch (e) {
    console.error("Gmail sync error", e);
    throw e;
  }

  return { imported, skipped, errors };
}

export async function getGmailStatus(): Promise<{ lastSyncAt: Date | null }> {
  const lastSync = await db.settings.get("gmail_last_sync");
  return { lastSyncAt: lastSync ? new Date(parseInt(lastSync.value)) : null };
}
