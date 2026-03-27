import React from "react";
import { useTransactions, createTransaction, deleteTransaction } from "@/hooks/use-local-transactions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDownRight, ArrowUpRight, Search, Plus, Trash2, Edit2, Download, ArrowUpDown, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TransactionDialog } from "@/components/transaction-dialog";

type SortField = "date" | "amount" | "description";
type SortDir = "asc" | "desc";
type TypeFilter = "all" | "income" | "expense";

export default function Transactions() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [sortField, setSortField] = React.useState<SortField>("date");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const { data, isLoading } = useTransactions({ limit: 500 });
  const [txToEdit, setTxToEdit] = React.useState<any>(null);
  const [isAddOpen, setIsAddOpen] = React.useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedFiltered = React.useMemo(() => {
    let txs = data?.transactions ?? [];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      txs = txs.filter(tx =>
        tx.description.toLowerCase().includes(q) ||
        tx.merchantName?.toLowerCase().includes(q) ||
        tx.categoryName?.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== "all") txs = txs.filter(tx => tx.type === typeFilter);
    txs = [...txs].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = a.date.localeCompare(b.date);
      else if (sortField === "amount") cmp = a.amount - b.amount;
      else if (sortField === "description") cmp = a.description.localeCompare(b.description);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return txs;
  }, [data, searchTerm, typeFilter, sortField, sortDir]);

  const totalShown = sortedFiltered.reduce(
    (acc, tx) => {
      if (tx.type === "income") acc.income += tx.amount;
      else acc.expense += tx.amount;
      return acc;
    },
    { income: 0, expense: 0 }
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

  const handleExportCSV = () => {
    const rows = [
      ["Date", "Description", "Merchant", "Category", "Account", "Type", "Amount (₹)", "Source"],
      ...sortedFiltered.map(tx => [
        tx.date.split("T")[0],
        tx.description,
        tx.merchantName ?? "",
        tx.categoryName ?? "",
        tx.accountName ?? "",
        tx.type,
        tx.amount.toFixed(2),
        tx.importSource ?? "manual",
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smarttrack-transactions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${sortedFiltered.length} transactions` });
  };

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => handleSort(field)}
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortField === field ? "text-green-500" : "text-muted-foreground/50"}`} />
    </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground mt-1">{data?.total ?? 0} total transactions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} title="Export as CSV">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white" onClick={() => { setTxToEdit(null); setIsAddOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add
          </Button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={v => setTypeFilter(v as TypeFilter)}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income only</SelectItem>
            <SelectItem value="expense">Expenses only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quick totals for filtered view */}
      {sortedFiltered.length > 0 && (
        <div className="flex gap-4 text-sm px-1">
          <span className="text-muted-foreground">{sortedFiltered.length} shown</span>
          {(typeFilter === "all" || typeFilter === "income") && totalShown.income > 0 && (
            <span className="text-emerald-600 font-medium">+{formatCurrency(totalShown.income)}</span>
          )}
          {(typeFilter === "all" || typeFilter === "expense") && totalShown.expense > 0 && (
            <span className="text-red-500 font-medium">−{formatCurrency(totalShown.expense)}</span>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({length: 5}).map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted/20 animate-pulse" />)}
        </div>
      ) : !sortedFiltered.length ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {searchTerm || typeFilter !== "all" ? "No transactions match your filters." : "No transactions yet. Add your first one!"}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortBtn field="description" label="Description" /></TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell"><SortBtn field="date" label="Date" /></TableHead>
                <TableHead className="hidden md:table-cell">Account</TableHead>
                <TableHead className="text-right"><SortBtn field="amount" label="Amount" /></TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFiltered.map(tx => (
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
    </div>
  );
}
