import React from "react";
import { useListAccounts } from "@workspace/api-client-react";
import { useCreateAccount, useUpdateAccount, useDeleteAccount } from "@/hooks/use-accounts";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Wallet, CreditCard, Banknote, Landmark, Trash2, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Account, CreateAccountInputType } from "@workspace/api-client-react";

const ACCOUNT_ICONS: Record<string, React.ReactNode> = {
  bank: <Landmark className="w-6 h-6" />,
  credit_card: <CreditCard className="w-6 h-6" />,
  cash: <Banknote className="w-6 h-6" />,
  wallet: <Wallet className="w-6 h-6" />,
  investment: <TrendingUp className="w-6 h-6" />,
  other: <Wallet className="w-6 h-6" />
};

import { TrendingUp } from "lucide-react"; // Import inside to satisfy AST but keep record clean

export default function Accounts() {
  const { toast } = useToast();
  const { data, isLoading } = useListAccounts();
  const deleteAccount = useDeleteAccount();

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingAcc, setEditingAcc] = React.useState<Account | null>(null);

  const handleDelete = (id: string) => {
    if (confirm("Are you sure? Deleting an account may affect transaction history.")) {
      deleteAccount.mutate({ id }, {
        onSuccess: () => toast({ title: "Account deleted" }),
        onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
      });
    }
  };

  const openEdit = (acc: Account) => {
    setEditingAcc(acc);
    setIsDialogOpen(true);
  };

  const openNew = () => {
    setEditingAcc(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground mt-1">Manage your payment sources and balances.</p>
        </div>
        <Button onClick={openNew} className="hover-elevate shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" /> Add Account
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse h-40 bg-muted/20" />
          ))
        ) : data?.accounts.map((acc) => (
          <Card key={acc.id} className="relative group hover:shadow-md transition-shadow overflow-hidden">
            {/* Header background band using acc.color if valid, else primary */}
            <div className="h-12 w-full bg-primary/10 absolute top-0 left-0" />
            
            <CardContent className="pt-6 relative">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-card border shadow-sm flex items-center justify-center text-primary">
                  {ACCOUNT_ICONS[acc.type] || <Wallet className="w-6 h-6" />}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(acc)}>
                    <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(acc.id)}>
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
              
              <h3 className="font-bold text-lg">{acc.name}</h3>
              <p className="text-sm text-muted-foreground capitalize mb-4">{acc.type.replace('_', ' ')}</p>
              
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Opening</span>
                  <span>{formatCurrency(acc.openingBalance)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg text-foreground border-t pt-2 mt-2">
                  <span>Current</span>
                  <span className={acc.currentBalance < 0 ? "text-destructive" : ""}>
                    {formatCurrency(acc.currentBalance)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AccountDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        accountToEdit={editingAcc} 
      />
    </div>
  );
}

function AccountDialog({ open, onOpenChange, accountToEdit }: { open: boolean, onOpenChange: (open: boolean) => void, accountToEdit: Account | null }) {
  const { toast } = useToast();
  const createAcc = useCreateAccount();
  const updateAcc = useUpdateAccount();

  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<CreateAccountInputType>("bank");
  const [balance, setBalance] = React.useState("");

  React.useEffect(() => {
    if (open) {
      if (accountToEdit) {
        setName(accountToEdit.name);
        setType(accountToEdit.type as CreateAccountInputType);
        setBalance(accountToEdit.openingBalance.toString());
      } else {
        setName("");
        setType("bank");
        setBalance("");
      }
    }
  }, [open, accountToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !balance) return;

    const payload = {
      name,
      type,
      openingBalance: parseFloat(balance),
      color: "#059669", // default emerald
      icon: "wallet",
    };

    if (accountToEdit) {
      updateAcc.mutate({ id: accountToEdit.id, data: payload }, {
        onSuccess: () => {
          toast({ title: "Account updated" });
          onOpenChange(false);
        }
      });
    } else {
      createAcc.mutate({ data: payload }, {
        onSuccess: () => {
          toast({ title: "Account created" });
          onOpenChange(false);
        }
      });
    }
  };

  const isPending = createAcc.isPending || updateAcc.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{accountToEdit ? "Edit Account" : "Add Account"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Account Name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chase Checking" />
          </div>
          
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CreateAccountInputType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank Account</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="wallet">Digital Wallet</SelectItem>
                <SelectItem value="investment">Investment</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Opening Balance</Label>
            <Input required type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" />
            {accountToEdit && (
              <p className="text-xs text-muted-foreground mt-1">Note: Modifying opening balance will recalculate current balance.</p>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save Account"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
