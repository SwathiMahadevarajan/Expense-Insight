import React from "react";
import { useTransactions, deleteTransaction, bulkDeleteTransactions, bulkUpdateTransactions } from "@/hooks/use-local-transactions";
import { useCategories } from "@/hooks/use-local-categories";
import { useAccounts } from "@/hooks/use-local-accounts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownRight, ArrowUpRight, ArrowLeftRight, Search, Plus, Trash2, Edit2, Download,
  ArrowUpDown, Filter, Mail, ChevronDown, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TransactionDialog } from "@/components/transaction-dialog";
import { GmailImportPanel } from "@/components/gmail-import-panel";

type SortField = "date" | "amount" | "description";
type SortDir = "asc" | "desc";
type TypeFilter = "all" | "income" | "expense" | "transfer";

// ─── Main Transactions Page ───────────────────────────────────────────────────

export default function Transactions() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [sortField, setSortField] = React.useState<SortField>("date");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const { data, isLoading } = useTransactions({ limit: 500 });
  const { data: categoriesData } = useCategories();
  const { data: accountsData } = useAccounts();

  const [txToEdit, setTxToEdit] = React.useState<any>(null);
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [gmailOpen, setGmailOpen] = React.useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
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
    return [...txs].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = a.date.localeCompare(b.date);
      else if (sortField === "amount") cmp = a.amount - b.amount;
      else cmp = a.description.localeCompare(b.description);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, searchTerm, typeFilter, sortField, sortDir]);

  const totalShown = sortedFiltered.reduce(
    (acc, tx) => {
      if (tx.type === "income") acc.income += tx.amount;
      else if (tx.type === "expense") acc.expense += tx.amount;
      else acc.transfer += tx.amount;
      return acc;
    },
    { income: 0, expense: 0, transfer: 0 }
  );

  const allSelected = sortedFiltered.length > 0 && sortedFiltered.every(tx => selectedIds.has(tx.id));
  const someSelected = selectedIds.size > 0;
  const toggleAll = () => { if (allSelected) setSelectedIds(new Set()); else setSelectedIds(new Set(sortedFiltered.map(tx => tx.id))); };
  const toggleOne = (id: string) => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    await deleteTransaction(id);
    toast({ title: "Deleted" });
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} transaction${selectedIds.size !== 1 ? "s" : ""}?`)) return;
    await bulkDeleteTransactions([...selectedIds]);
    setSelectedIds(new Set());
    toast({ title: `Deleted ${selectedIds.size} transactions` });
  };

  const handleBulkSetCategory = async (categoryId: string) => {
    await bulkUpdateTransactions([...selectedIds], { categoryId: categoryId || null });
    toast({ title: `Category updated for ${selectedIds.size} transactions` });
    setSelectedIds(new Set());
  };

  const handleBulkSetAccount = async (accountId: string) => {
    await bulkUpdateTransactions([...selectedIds], { accountId: accountId || null });
    toast({ title: `Account updated for ${selectedIds.size} transactions` });
    setSelectedIds(new Set());
  };

  const handleExportCSV = () => {
    const rows = [
      ["Date", "Description", "Merchant", "Category", "Account", "Type", "Amount (₹)"],
      ...sortedFiltered.map(tx => [
        tx.date.split("T")[0], tx.description, tx.merchantName ?? "",
        tx.categoryName ?? "", tx.accountName ?? "", tx.type, tx.amount.toFixed(2),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `smarttrack-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: `Exported ${sortedFiltered.length} transactions` });
  };

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => handleSort(field)}>
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortField === field ? "text-green-500" : "text-muted-foreground/50"}`} />
    </button>
  );

  const categories = categoriesData?.categories ?? [];
  const accounts = accountsData?.accounts ?? [];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={gmailOpen ? "default" : "outline"} size="sm"
            className={gmailOpen ? "bg-green-500 hover:bg-green-600 text-white" : ""}
            onClick={() => setGmailOpen(v => !v)}
          >
            <Mail className="w-4 h-4 mr-2" /> Import from Gmail
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white" onClick={() => { setTxToEdit(null); setIsAddOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add
          </Button>
        </div>
      </div>

      {/* Gmail Import Panel */}
      {gmailOpen && <GmailImportPanel onClose={() => setGmailOpen(false)} />}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search transactions…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={v => setTypeFilter(v as TypeFilter)}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expenses</SelectItem>
            <SelectItem value="transfer">Transfers</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-2 flex-wrap p-3 bg-muted/60 border rounded-xl">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">Category <ChevronDown className="w-3.5 h-3.5 ml-1.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
              <DropdownMenuItem onClick={() => handleBulkSetCategory("")}>— None</DropdownMenuItem>
              {categories.map(cat => (
                <DropdownMenuItem key={cat.id} onClick={() => handleBulkSetCategory(cat.id)}>{cat.icon} {cat.name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">Account <ChevronDown className="w-3.5 h-3.5 ml-1.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleBulkSetAccount("")}>— None</DropdownMenuItem>
              {accounts.map(acc => (
                <DropdownMenuItem key={acc.id} onClick={() => handleBulkSetAccount(acc.id)}>{acc.name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="ml-auto">
            <X className="w-3.5 h-3.5 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* Totals */}
      {!someSelected && sortedFiltered.length > 0 && (
        <div className="flex gap-4 text-sm px-1">
          <span className="text-muted-foreground">{sortedFiltered.length} shown</span>
          {totalShown.income > 0 && <span className="text-emerald-600 font-medium">+{formatCurrency(totalShown.income)}</span>}
          {totalShown.expense > 0 && <span className="text-red-500 font-medium">−{formatCurrency(totalShown.expense)}</span>}
          {totalShown.transfer > 0 && <span className="text-indigo-500 font-medium">↔ {formatCurrency(totalShown.transfer)}</span>}
        </div>
      )}

      {/* Transaction Table */}
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
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead><SortBtn field="description" label="Description" /></TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell"><SortBtn field="date" label="Date" /></TableHead>
                <TableHead className="hidden md:table-cell">Account</TableHead>
                <TableHead className="text-right"><SortBtn field="amount" label="Amount" /></TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFiltered.map(tx => {
                const isSelected = selectedIds.has(tx.id);
                return (
                  <TableRow key={tx.id} className={`group ${isSelected ? "bg-green-50/60 dark:bg-green-950/10" : ""}`}>
                    <TableCell>
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(tx.id)} aria-label="Select row" />
                    </TableCell>
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
                          : tx.type === "transfer"
                            ? <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-500" />
                            : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
                        <span className={`font-semibold text-sm ${tx.type === "income" ? "text-emerald-600" : tx.type === "transfer" ? "text-indigo-500" : "text-red-500"}`}>
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
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <TransactionDialog open={isAddOpen} onOpenChange={setIsAddOpen} transactionToEdit={txToEdit} />
    </div>
  );
}
