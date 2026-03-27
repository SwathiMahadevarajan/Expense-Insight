import React from "react";
import { useTransactions, createTransaction, deleteTransaction } from "@/hooks/use-local-transactions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDownRight, ArrowUpRight, Search, Plus, Trash2, Edit2, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { TransactionDialog } from "@/components/transaction-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateId } from "@/lib/db";

export default function Transactions() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState("");
  const { data, isLoading } = useTransactions({ limit: 200 });
  const [txToEdit, setTxToEdit] = React.useState<any>(null);
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isEmailOpen, setIsEmailOpen] = React.useState(false);
  const [emailText, setEmailText] = React.useState("");
  const [isParsing, setIsParsing] = React.useState(false);

  const filteredTxs = data?.transactions.filter(tx =>
    tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.merchantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.categoryName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    try {
      await deleteTransaction(id);
      toast({ title: "Deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleParseEmail = async () => {
    if (!emailText.trim()) return;
    setIsParsing(true);
    try {
      const text = emailText;
      const isDebit = /debited|payment|spent|charged|purchase|withdrew/i.test(text);
      const isCredit = /credited|received|refund|cashback|salary/i.test(text);

      const amountMatch = text.match(/(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
      if (!amountMatch) {
        toast({ title: "No amount found in this email", variant: "destructive" });
        setIsParsing(false);
        return;
      }

      const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
      const type: "income" | "expense" = isCredit && !isDebit ? "income" : "expense";

      let merchantName: string | null = null;
      const merchantMatch = text.match(/(?:at|to|from)\s+([A-Z][A-Za-z0-9\s&'.-]{2,40}?)(?:\s+on|\s+via|\s+UPI|\s*\.|\s*$)/i);
      if (merchantMatch) merchantName = merchantMatch[1].trim().slice(0, 60);

      const description = merchantName
        ? `${type === "expense" ? "Payment to" : "Receipt from"} ${merchantName}`
        : text.slice(0, 80);

      const now = new Date().toISOString();
      await createTransaction({
        amount,
        type,
        description,
        merchantName,
        date: now,
        categoryId: null,
        accountId: null,
        notes: null,
        importSource: "email",
        gmailMessageId: null,
      });

      toast({ title: `Imported ${type} of ${formatCurrency(amount)}` });
      setIsEmailOpen(false);
      setEmailText("");
    } catch (e) {
      toast({ title: "Failed to parse email", variant: "destructive" });
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground mt-1">{data?.total ?? 0} total transactions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsEmailOpen(true)}>
            <Mail className="w-4 h-4 mr-2" /> Paste Email
          </Button>
          <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white" onClick={() => { setTxToEdit(null); setIsAddOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search transactions..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({length: 5}).map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted/20 animate-pulse" />)}
        </div>
      ) : !filteredTxs?.length ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {searchTerm ? "No transactions match your search." : "No transactions yet. Add your first one!"}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="hidden md:table-cell">Account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTxs.map(tx => (
                <TableRow key={tx.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
                        style={{ backgroundColor: tx.categoryColor ? `${tx.categoryColor}20` : "#f1f5f9", color: tx.categoryColor ?? "#94a3b8" }}>
                        {tx.categoryIcon ?? (tx.importSource === "email" ? "📧" : "💳")}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{tx.description}</p>
                        {tx.merchantName && <p className="text-xs text-muted-foreground truncate">{tx.merchantName}</p>}
                        <p className="text-xs text-muted-foreground sm:hidden">{formatDate(tx.date)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {tx.categoryName && <Badge variant="outline" className="text-xs">{tx.categoryName}</Badge>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(tx.date)}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{tx.accountName ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {tx.type === "income"
                        ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                        : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
                      <span className={`font-semibold text-sm ${tx.type === "income" ? "text-emerald-600" : "text-red-500"}`}>
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setTxToEdit(tx); setIsAddOpen(true); }}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(tx.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <TransactionDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        transactionToEdit={txToEdit}
      />

      <Dialog open={isEmailOpen} onOpenChange={setIsEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paste Bank Email Content</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Paste the body of a bank transaction SMS or email below. SmartTrack will extract the amount and merchant automatically.</p>
            <div className="space-y-2">
              <Label>Email / SMS Content</Label>
              <Textarea
                rows={6}
                value={emailText}
                onChange={e => setEmailText(e.target.value)}
                placeholder="Rs. 1,500 debited from your HDFC Bank account ending 1234 at Swiggy on 26-Mar-2026..."
                className="resize-none font-mono text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEmailOpen(false)}>Cancel</Button>
              <Button onClick={handleParseEmail} disabled={isParsing || !emailText.trim()} className="bg-green-500 hover:bg-green-600 text-white">
                {isParsing ? "Parsing..." : "Import Transaction"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
