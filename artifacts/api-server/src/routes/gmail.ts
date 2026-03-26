import { Router, type IRouter, type Request, type Response } from "express";
import { google } from "googleapis";
import { db } from "@workspace/db";
import { gmailTokensTable, transactionsTable, categoriesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// GET /gmail/auth-url — returns OAuth URL for the frontend to redirect to
router.get("/gmail/auth-url", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const oauth2Client = getOAuth2Client();
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: GMAIL_SCOPES,
      prompt: "consent",
      state: req.user.id,
    });
    res.json({ url });
  } catch (err) {
    req.log.error({ err }, "Failed to generate Gmail auth URL");
    res.status(500).json({ error: "Gmail credentials not configured" });
  }
});

// GET /gmail/callback — handles OAuth redirect from Google
router.get("/gmail/callback", async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;
  const baseUrl = process.env.APP_BASE_URL || "/";

  if (error) {
    res.redirect(`${baseUrl}?gmail_error=${encodeURIComponent(error)}`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${baseUrl}?gmail_error=missing_params`);
    return;
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    await db
      .insert(gmailTokensTable)
      .values({
        userId: state,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        scope: tokens.scope ?? undefined,
      })
      .onConflictDoUpdate({
        target: gmailTokensTable.userId,
        set: {
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token ?? undefined,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          scope: tokens.scope ?? undefined,
          updatedAt: new Date(),
        },
      });

    // Trigger initial sync
    try {
      await syncGmailTransactions(state);
    } catch (syncErr) {
      logger.warn({ err: syncErr }, "Initial Gmail sync failed, will retry later");
    }

    res.redirect(`${baseUrl}?gmail_connected=1`);
  } catch (err) {
    logger.error({ err }, "Gmail OAuth callback error");
    res.redirect(`${baseUrl}?gmail_error=auth_failed`);
  }
});

// GET /gmail/status
router.get("/gmail/status", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const [token] = await db
      .select()
      .from(gmailTokensTable)
      .where(eq(gmailTokensTable.userId, req.user.id));

    if (!token) {
      res.json({ connected: false, email: null, lastSyncAt: null, autoSyncEnabled: false });
      return;
    }

    // Get email from token info
    let email: string | null = null;
    try {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials({ access_token: token.accessToken, refresh_token: token.refreshToken });
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const info = await oauth2.userinfo.get();
      email = info.data.email ?? null;
    } catch {
      // ignore
    }

    res.json({
      connected: true,
      email,
      lastSyncAt: token.lastSyncAt?.toISOString() ?? null,
      autoSyncEnabled: true,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get Gmail status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /gmail/disconnect
router.delete("/gmail/disconnect", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await db.delete(gmailTokensTable).where(eq(gmailTokensTable.userId, req.user.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to disconnect Gmail");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /gmail/sync — manual trigger
router.post("/gmail/sync", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await syncGmailTransactions(req.user.id);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Gmail sync failed");
    res.status(500).json({ error: "Sync failed" });
  }
});

export async function syncGmailTransactions(userId: string) {
  const [tokenRow] = await db
    .select()
    .from(gmailTokensTable)
    .where(eq(gmailTokensTable.userId, userId));

  if (!tokenRow) {
    return { imported: 0, skipped: 0, errors: 0, transactions: [] };
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokenRow.accessToken,
    refresh_token: tokenRow.refreshToken ?? undefined,
  });

  // Auto-refresh token if needed
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await db.update(gmailTokensTable).set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? tokenRow.refreshToken ?? undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        updatedAt: new Date(),
      }).where(eq(gmailTokensTable.userId, userId));
    }
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Search for bank transaction emails — after last sync or last 30 days
  const afterDate = tokenRow.lastSyncAt
    ? Math.floor(tokenRow.lastSyncAt.getTime() / 1000)
    : Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

  const query = `after:${afterDate} (transaction OR debited OR credited OR "bank alert" OR "payment" OR "UPI" OR "NEFT" OR "IMPS" OR "RTGS" OR "Rs." OR "INR") -category:promotions -category:social`;

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 50,
  });

  const messages = listRes.data.messages ?? [];
  const categories = await db.select().from(categoriesTable)
    .where(eq(categoriesTable.userId, userId));
  const defaultCategories = await db.select().from(categoriesTable);

  const allCategories = [...categories, ...defaultCategories];

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const importedTransactions: typeof transactionsTable.$inferSelect[] = [];

  for (const msg of messages) {
    if (!msg.id) continue;

    try {
      // Check if already imported
      const existing = await db.select({ id: transactionsTable.id })
        .from(transactionsTable)
        .where(eq(transactionsTable.gmailMessageId, msg.id))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      });

      const headers = fullMsg.data.payload?.headers ?? [];
      const subject = headers.find(h => h.name === "Subject")?.value ?? "";
      const from = headers.find(h => h.name === "From")?.value ?? "";

      // Extract body text
      let body = "";
      const parts = fullMsg.data.payload?.parts ?? [];
      const mainPart = fullMsg.data.payload;

      function extractText(part: typeof mainPart): string {
        if (!part) return "";
        if (part.mimeType === "text/plain" && part.body?.data) {
          return Buffer.from(part.body.data, "base64").toString("utf-8");
        }
        if (part.parts) {
          return part.parts.map(extractText).join("\n");
        }
        return "";
      }

      body = extractText(mainPart) || subject;

      // Parse transactions
      const parsed = parseEmailForTransactions(body, subject, from, allCategories);

      if (parsed.length === 0) {
        skipped++;
        continue;
      }

      for (const tx of parsed) {
        const [inserted] = await db.insert(transactionsTable).values({
          ...tx,
          userId,
          importSource: "email",
          gmailMessageId: msg.id,
        }).returning();
        if (inserted) {
          importedTransactions.push(inserted);
          imported++;
        }
      }
    } catch (err) {
      logger.warn({ err, msgId: msg.id }, "Failed to process Gmail message");
      errors++;
    }
  }

  // Update last sync time
  await db.update(gmailTokensTable).set({
    lastSyncAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(gmailTokensTable.userId, userId));

  return { imported, skipped, errors, transactions: importedTransactions };
}

function parseEmailForTransactions(
  body: string,
  subject: string,
  from: string,
  categories: { id: string; name: string; type: string }[]
): Array<{
  amount: number;
  type: "income" | "expense";
  description: string;
  merchantName: string | null;
  date: Date;
  categoryId: string | null;
}> {
  const text = `${subject} ${body}`;
  const results = [];

  const isDebit = /debited|payment|spent|charged|purchase|withdrew|deducted/i.test(text);
  const isCredit = /credited|received|refund|cashback|salary|payment received/i.test(text);

  if (!isDebit && !isCredit) return [];

  // Extract amount
  const amountMatch = text.match(/(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i)
    || text.match(/([0-9,]+(?:\.[0-9]{2}))\s*(?:Rs|INR|₹)/i);

  if (!amountMatch) return [];

  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (isNaN(amount) || amount <= 0) return [];

  const type: "income" | "expense" = isCredit && !isDebit ? "income" : "expense";

  // Extract merchant
  let merchantName: string | null = null;
  const merchantPatterns = [
    /(?:at|to|from)\s+([A-Z][A-Za-z0-9\s&'.-]{2,40}?)(?:\s+on|\s+via|\s+UPI|\s*\.|\s*$)/i,
    /(?:merchant|payee|beneficiary)[:\s]+([A-Za-z0-9\s&'.-]+?)(?:\s*\n|\.|$)/i,
    /UPI[:\s-]+([A-Za-z0-9\s@._-]+?)(?:\s+VPA|\s+Ref|\s*$|\n)/i,
  ];
  for (const p of merchantPatterns) {
    const m = text.match(p);
    if (m?.[1]?.trim()) { merchantName = m[1].trim().slice(0, 60); break; }
  }

  // Extract date
  let date = new Date();
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dateMatch) {
    try {
      const parsed = new Date(dateMatch[0]);
      if (!isNaN(parsed.getTime())) date = parsed;
    } catch { /* keep now */ }
  }

  // Suggest category
  let categoryId: string | null = null;
  const lowerMerchant = (merchantName || subject).toLowerCase();

  const categoryMap: Record<string, RegExp> = {
    "Food & Dining": /swiggy|zomato|food|restaurant|cafe|domino|pizza|kfc|mcdonald|burger|meal/i,
    "Transport": /uber|ola|rapido|taxi|auto|cab|metro|railway|irctc|flight|bus|petrol|fuel|fastag/i,
    "Shopping": /amazon|flipkart|myntra|shopping|mart|store|mall|nykaa|meesho/i,
    "Entertainment": /netflix|spotify|prime|hotstar|youtube|entertainment|bookmyshow|pvr/i,
    "Health": /hospital|clinic|pharma|medicine|doctor|health|apollo|medplus/i,
    "Bills & Utilities": /electricity|water|gas|broadband|airtel|jio|vi|bsnl|recharge|bill|utility|bescom|besst/i,
    "Salary": /salary|payroll|payslip/i,
    "Groceries": /grofer|blinkit|zepto|bigbasket|grocery|supermarket/i,
  };

  for (const [catName, regex] of Object.entries(categoryMap)) {
    if (regex.test(lowerMerchant)) {
      const matched = categories.find(c => c.name === catName);
      if (matched) { categoryId = matched.id; break; }
    }
  }

  const description = merchantName
    ? `${type === "expense" ? "Payment to" : "Receipt from"} ${merchantName}`
    : subject.slice(0, 100) || "Bank transaction";

  results.push({ amount, type, description, merchantName, date, categoryId });
  return results;
}

export default router;
