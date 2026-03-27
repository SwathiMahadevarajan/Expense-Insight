import React from "react";
import { useAccounts, createAccount, updateAccount, deleteAccount } from "@/hooks/use-local-accounts";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Wallet, CreditCard, Banknote, Landmark, Trash2, Edit2, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Account } from "@/lib/db";

const ACCOUNT_ICONS: Record<string, React.ReactNode> = {
  bank: <Landmark className="w-5 h-5" />,
  credit_card: <CreditCard className="w-5 h-5" />,
  cash: <Banknote className="w-5 h-5" />,
  wallet: <Wallet className="w-5 h-5" />,
  other: <Wallet className="w-5 h-5" />,
};

const ACCOUNT_COLORS = ["#22c55e", "#3b82f6", "#8b5cf6", "#f97316", "#ec4899", "#14b8a6", "#eab308", "#ef4444"];

export default function Accounts() {
  const { toast } = useToast();
  const { data, isLoading } = useAccounts();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState<(Account & { currentBalance?: number }) | null>(null);

  const totalBalance = data?.accounts.reduce((sum, a) => sum + (a.currentBalance ?? a.openingBalance), 0) ?? 0;

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this account? Transactions linked to it will remain but lose account association.")) return;
    try {
      await deleteAccount(id);
      toast({ title: "Account deleted" });
    } catch {
      toast({ title: "Error deleting account", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground mt-1">Manage your payment accounts.</p>
        </div>
        <Button onClick={() => { setEditingAccount(null); setIsDialogOpen(true); }} className="bg-green-500 hover:bg-green-600 text-white">
          <Plus className="w-4 h-4 mr-2" /> Add Account
        </Button>
      </div>

      <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
        <CardContent className="pt-6">
          <p className="text-green-100 text-sm font-medium">Total Balance</p>
          <p className="text-4xl font-bold mt-1">{formatCurrency(totalBalance)}</p>
          <p className="text-green-100 text-xs mt-1">{data?.accounts.length ?? 0} accounts</p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({length: 3}).map((_, i) => <div key={i} className="h-40 rounded-xl bg-muted/20 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.accounts.map(account => (
            <Card key={account.id} className="hover-elevate relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: account.color }} />
              <CardHeader className="flex flex-row items-start justify-between pb-2 pt-5">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${account.color}20`, color: account.color }}>
                    {ACCOUNT_ICONS[account.type] ?? <Wallet className="w-5 h-5" />}
                  </div>
                  <div>
                    <CardTitle className="text-base">{account.name}</CardTitle>
                    <p className="text-xs text-muted-foreground capitalize">{account.type.replace("_", " ")}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingAccount(account); setIsDialogOpen(true); }}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(account.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-2xl font-bold" style={{ color: account.color }}>
                    {formatCurrency(account.currentBalance ?? account.openingBalance)}
                  </p>
                  <p className="text-xs text-muted-foreground">Opening: {formatCurrency(account.openingBalance)}</p>
                </div>
              </CardContent>
            </Card>
          ))}

          {data?.accounts.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No accounts yet. Add your first account to get started.</p>
            </div>
          )}
        </div>
      )}

      <AccountDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        accountToEdit={editingAccount}
        onSave={async (data) => {
          if (editingAccount) {
            await updateAccount(editingAccount.id, data);
            toast({ title: "Account updated" });
          } else {
            await createAccount(data as Omit<Account, "id" | "createdAt" | "updatedAt">);
            toast({ title: "Account added" });
          }
          setIsDialogOpen(false);
        }}
      />
    </div>
  );
}

function AccountDialog({ open, onOpenChange, accountToEdit, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accountToEdit: (Account & { currentBalance?: number }) | null;
  onSave: (data: Partial<Account>) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<Account["type"]>("bank");
  const [openingBalance, setOpeningBalance] = React.useState("");
  const [color, setColor] = React.useState(ACCOUNT_COLORS[0]);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(accountToEdit?.name ?? "");
      setType(accountToEdit?.type ?? "bank");
      setOpeningBalance(accountToEdit ? String(accountToEdit.openingBalance) : "");
      setColor(accountToEdit?.color ?? ACCOUNT_COLORS[0]);
    }
  }, [open, accountToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        name,
        type,
        openingBalance: parseFloat(openingBalance) || 0,
        color,
        icon: type,
        currency: "INR",
        isDefault: false,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{accountToEdit ? "Edit Account" : "Add Account"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Account Name</Label>
            <Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. HDFC Savings" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={v => setType(v as Account["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank Account</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="wallet">Wallet/UPI</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Opening Balance (₹)</Label>
              <Input type="number" step="0.01" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {ACCOUNT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? "scale-125 border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving} className="bg-green-500 hover:bg-green-600 text-white">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
