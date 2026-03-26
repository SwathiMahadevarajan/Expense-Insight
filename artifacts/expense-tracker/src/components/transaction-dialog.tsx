import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTransaction, useUpdateTransaction } from "@/hooks/use-transactions";
import { useListAccounts, useListCategories } from "@workspace/api-client-react";
import type { Transaction, CreateTransactionInputType } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionToEdit?: Transaction;
}

export function TransactionDialog({ open, onOpenChange, transactionToEdit }: TransactionDialogProps) {
  const { toast } = useToast();
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  
  const { data: accountsData } = useListAccounts();
  const { data: categoriesData } = useListCategories();

  const [type, setType] = React.useState<CreateTransactionInputType>(
    (transactionToEdit?.type as CreateTransactionInputType) || "expense"
  );
  const [amount, setAmount] = React.useState(transactionToEdit?.amount?.toString() || "");
  const [description, setDescription] = React.useState(transactionToEdit?.description || "");
  const [date, setDate] = React.useState(
    transactionToEdit?.date ? new Date(transactionToEdit.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [accountId, setAccountId] = React.useState(transactionToEdit?.accountId || "");
  const [categoryId, setCategoryId] = React.useState(transactionToEdit?.categoryId || "");

  React.useEffect(() => {
    if (open) {
      if (transactionToEdit) {
        setType(transactionToEdit.type as CreateTransactionInputType);
        setAmount(transactionToEdit.amount.toString());
        setDescription(transactionToEdit.description);
        setDate(new Date(transactionToEdit.date).toISOString().split('T')[0]);
        setAccountId(transactionToEdit.accountId || "");
        setCategoryId(transactionToEdit.categoryId || "");
      } else {
        setType("expense");
        setAmount("");
        setDescription("");
        setDate(new Date().toISOString().split('T')[0]);
        setAccountId("");
        setCategoryId("");
      }
    }
  }, [open, transactionToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !date) return;

    const payload = {
      amount: parseFloat(amount),
      type,
      description,
      date: new Date(date).toISOString(),
      accountId: accountId || null,
      categoryId: categoryId || null,
      importSource: "manual" as const,
    };

    if (transactionToEdit) {
      updateTx.mutate(
        { id: transactionToEdit.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Transaction updated" });
            onOpenChange(false);
          },
          onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
        }
      );
    } else {
      createTx.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Transaction created" });
            onOpenChange(false);
          },
          onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
        }
      );
    }
  };

  const isPending = createTx.isPending || updateTx.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{transactionToEdit ? "Edit Transaction" : "New Transaction"}</DialogTitle>
          <DialogDescription>
            Enter the details of your transaction below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <Button
              type="button"
              variant={type === "expense" ? "default" : "outline"}
              className={type === "expense" ? "bg-destructive hover:bg-destructive/90" : ""}
              onClick={() => setType("expense")}
            >
              Expense
            </Button>
            <Button
              type="button"
              variant={type === "income" ? "default" : "outline"}
              className={type === "income" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
              onClick={() => setType("income")}
            >
              Income
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="E.g., Groceries, Salary, Coffee"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categoriesData?.categories.filter(c => c.type === type || c.type === 'both').map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {accountsData?.accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="hover-elevate">
              {isPending ? "Saving..." : "Save Transaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
