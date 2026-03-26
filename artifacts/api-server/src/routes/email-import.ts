import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { transactionsTable, categoriesTable } from "@workspace/db/schema";
import { ParseEmailTransactionBody, ImportEmailTransactionsBody } from "@workspace/api-zod";

const router: IRouter = Router();

interface ParsedTx {
  amount: number;
  type: "income" | "expense";
  description: string;
  merchantName?: string | null;
  date: string;
  suggestedCategoryName?: string | null;
  suggestedCategoryId?: string | null;
  accountId?: string | null;
  confidence: number;
  rawText?: string | null;
}

function parseEmailContent(emailContent: string, emailSubject?: string | null): ParsedTx[] {
  const transactions: ParsedTx[] = [];

  // Common bank transaction email patterns
  const patterns = [
    // HDFC, ICICI, SBI, Axis style: "debited/credited for Rs.1,234.56"
    /(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:has been\s*)?(?:debited|credited|deducted|received|transferred)(?:[^.]*?(?:at|to|from|for)\s*([A-Za-z0-9\s&'-]+?))?(?:\s*on\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{2,4}[/-]\d{1,2}[/-]\d{1,2}))?/gi,
    // "debited Rs X for Y"
    /(debited|credited)\s+(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:for|to|from|at)\s*([A-Za-z0-9\s&'-]+?)(?:\s*on\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}))?/gi,
    // "Amount: Rs 1234.56"
    /Amount[:\s]+(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
    // "transaction of Rs X"
    /transaction\s+of\s+(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
    // "spent Rs X at Y"
    /spent\s+(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s+at\s+([A-Za-z0-9\s&'-]+)/gi,
  ];

  const text = emailContent + (emailSubject ? " " + emailSubject : "");

  // Try to extract from common bank email formats
  const debitMatch = text.match(/debited?/i);
  const creditMatch = text.match(/credited?/i);
  const isExpense = debitMatch ? true : !creditMatch;

  // Extract amounts
  const amountMatches = [...text.matchAll(/(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi)];

  // Extract merchant/description
  const merchantPatterns = [
    /(?:at|to|from|for)\s+([A-Z][A-Za-z0-9\s&'.-]{2,40}?)(?:\s+on|\s+dated|\s+via|\s*\.|\s*$)/i,
    /(?:merchant|payee|beneficiary)[:\s]+([A-Za-z0-9\s&'.-]+?)(?:\s*$|\n|\.)/i,
    /(?:UPI|NEFT|IMPS|RTGS)[:\s-]*([A-Za-z0-9\s&'.-]+?)(?:VPA|UPI|@|\n|$)/i,
  ];

  let merchantName: string | null = null;
  for (const pattern of merchantPatterns) {
    const m = text.match(pattern);
    if (m?.[1]) {
      merchantName = m[1].trim().slice(0, 50);
      break;
    }
  }

  // Extract date
  const datePatterns = [
    /(\d{2})[/-](\d{2})[/-](\d{4})/,
    /(\d{4})[/-](\d{2})[/-](\d{2})/,
    /(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i,
  ];

  let txDate = new Date();
  for (const pattern of datePatterns) {
    const m = text.match(pattern);
    if (m) {
      try {
        const parsed = new Date(m[0]);
        if (!isNaN(parsed.getTime())) {
          txDate = parsed;
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  if (amountMatches.length > 0) {
    for (const match of amountMatches.slice(0, 3)) {
      const amountStr = match[1].replace(/,/g, "");
      const amount = parseFloat(amountStr);

      if (!isNaN(amount) && amount > 0) {
        const type: "income" | "expense" = isExpense ? "expense" : "income";
        const description = merchantName
          ? `${type === "expense" ? "Payment to" : "Receipt from"} ${merchantName}`
          : emailSubject || "Bank transaction";

        // Suggest category based on merchant name
        let suggestedCategoryName: string | null = null;
        if (merchantName) {
          const lower = merchantName.toLowerCase();
          if (/swiggy|zomato|food|restaurant|cafe|hotel|domino|pizza|kfc|mcdonald/i.test(lower)) {
            suggestedCategoryName = "Food & Dining";
          } else if (/uber|ola|rapido|taxi|auto|cab|metro|railway|flight|bus/i.test(lower)) {
            suggestedCategoryName = "Transport";
          } else if (/amazon|flipkart|myntra|shopping|mart|store|mall/i.test(lower)) {
            suggestedCategoryName = "Shopping";
          } else if (/netflix|spotify|prime|hotstar|youtube|entertainment/i.test(lower)) {
            suggestedCategoryName = "Entertainment";
          } else if (/hospital|clinic|pharma|medicine|doctor|health/i.test(lower)) {
            suggestedCategoryName = "Health";
          } else if (/electricity|water|gas|broadband|airtel|jio|vi|recharge/i.test(lower)) {
            suggestedCategoryName = "Bills & Utilities";
          } else if (/salary|payroll|income/i.test(lower)) {
            suggestedCategoryName = "Salary";
          }
        }

        transactions.push({
          amount,
          type,
          description,
          merchantName,
          date: txDate.toISOString(),
          suggestedCategoryName,
          suggestedCategoryId: null,
          accountId: null,
          confidence: 0.75,
          rawText: match[0],
        });

        // Only take first unique amount to avoid duplicates in same email
        break;
      }
    }
  }

  // If no amount found but email content exists, return a low-confidence placeholder
  if (transactions.length === 0 && text.trim().length > 20) {
    const subject = emailSubject?.slice(0, 100) || "Imported transaction";
    transactions.push({
      amount: 0,
      type: "expense",
      description: subject,
      merchantName: null,
      date: new Date().toISOString(),
      suggestedCategoryName: null,
      suggestedCategoryId: null,
      accountId: null,
      confidence: 0.1,
      rawText: null,
    });
  }

  return transactions;
}

router.post("/email-import/parse", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const body = ParseEmailTransactionBody.parse(req.body);

    const parsed = parseEmailContent(body.emailContent, body.emailSubject);

    // Try to match suggested category IDs from DB
    const categories = await db.select().from(categoriesTable);

    const transactions = parsed.map((tx) => {
      let suggestedCategoryId: string | null = null;
      if (tx.suggestedCategoryName) {
        const matched = categories.find(
          (c) => c.name.toLowerCase().includes(tx.suggestedCategoryName!.toLowerCase()) ||
            tx.suggestedCategoryName!.toLowerCase().includes(c.name.toLowerCase())
        );
        suggestedCategoryId = matched?.id ?? null;
      }
      return { ...tx, suggestedCategoryId };
    });

    res.json({
      success: true,
      transactions,
      rawExtracted: body.emailContent.slice(0, 500),
      errors: [],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to parse email");
    res.status(400).json({
      success: false,
      transactions: [],
      errors: ["Failed to parse email content"],
    });
  }
});

router.post("/email-import/import", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const body = ImportEmailTransactionsBody.parse(req.body);

    const inserted = await db
      .insert(transactionsTable)
      .values(
        body.transactions.map((tx) => ({
          ...tx,
          userId: req.user.id,
          date: new Date(tx.date),
          importSource: "email" as const,
        }))
      )
      .returning();

    res.json({ imported: inserted.length, transactions: inserted });
  } catch (err) {
    req.log.error({ err }, "Failed to import transactions");
    res.status(400).json({ error: "Failed to import transactions" });
  }
});

export default router;
