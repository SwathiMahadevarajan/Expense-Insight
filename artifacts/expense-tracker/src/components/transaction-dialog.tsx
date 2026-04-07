import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTransaction, updateTransaction } from "@/hooks/use-local-transactions";
import { useAccounts } from "@/hooks/use-local-accounts";
import { useCategories } from "@/hooks/use-local-categories";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionToEdit?: any;
  onDelete?: (id: string) => Promise<void>;
}

export function TransactionDialog({ open, onOpenChange, transactionToEdit, onDelete }: TransactionDialogProps) {
  const { toast } = useToast();
  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [type, setType] = React.useState<"expense" | "income">("expense");
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [accountId, setAccountId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (open) {
      if (transactionToEdit) {
        setType(transactionToEdit.type ?? "expense");
        setAmount(String(transactionToEdit.amount ?? ""));
        setDescription(transactionToEdit.description ?? "");
        setDate(new Date(transactionToEdit.date).toISOString().split("T")[0]);
        setAccountId(transactionToEdit.accountId ?? "");
        setCategoryId(transactionToEdit.categoryId ?? "");
        setNotes(transactionToEdit.notes ?? "");
      } else {
        setType("expense");
        setAmount("");
        setDescription("");
        setDate(new Date().toISOString().split("T")[0]);
        setAccountId("");
        setCategoryId("");
        setNotes("");
      }
    }
  }, [open, transactionToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !date) return;
    setIsSaving(true);
    try {
      const payload = {
        amount: parseFloat(amount),
        type,
        description,
        date: new Date(date).toISOString(),
        accountId: accountId && accountId !== "none" ? accountId : null,
        categoryId: categoryId && categoryId !== "none" ? categoryId : null,
        notes: notes || null,
        merchantName: null,
        importSource: "manual" as const,
        gmailMessageId: null,
      };
      if (transactionToEdit) {
        await updateTransaction(transactionToEdit.id, payload);
        toast({ title: "Transaction updated" });
      } else {
        await createTransaction(payload);
        toast({ title: "Transaction added" });
      }
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Error saving transaction", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{transactionToEdit ? "Edit Transaction" : "New Transaction"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant={type === "expense" ? "default" : "outline"}
              className={type === "expense" ? "bg-red-500 hover:bg-red-600 text-white" : ""}
              onClick={() => setType("expense")}>
              Expense
            </Button>
            <Button type="button" variant={type === "income" ? "default" : "outline"}
              className={type === "income" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
              onClick={() => setType("income")}>
              Income
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Amount (₹)</Label>
            <Input type="number" step="0.01" required min="0.01"
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00" className="text-lg font-medium" />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input required value={description} onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Grocery shopping" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" required value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categoriesData?.categories
                    .filter(c => c.type === type || c.type === "both")
                    .map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="No account" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No account</SelectItem>
                {accountsData?.accounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any extra notes..." />
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            {/* Delete — only shown when editing */}
            {transactionToEdit && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try { await onDelete(transactionToEdit.id); }
                  catch { toast({ title: "Delete failed", variant: "destructive" }); }
                  finally { setIsDeleting(false); }
                }}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                {isDeleting ? "Deleting…" : "Delete"}
              </Button>
            ) : <span />}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSaving} className="bg-green-500 hover:bg-green-600 text-white">
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
