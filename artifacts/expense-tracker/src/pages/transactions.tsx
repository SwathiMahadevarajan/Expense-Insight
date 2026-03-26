import React from "react";
import { useListTransactions, type ParsedTransaction } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowDownRight, ArrowUpRight, Search, Mail, Edit2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDeleteTransaction } from "@/hooks/use-transactions";
import { useParseEmailTransaction, useImportEmailTransactions } from "@/hooks/use-email-import";
import { useToast } from "@/hooks/use-toast";
import { TransactionDialog } from "../components/transaction-dialog";

export default function Transactions() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState("");
  const { data, isLoading } = useListTransactions({ limit: 100 });
  const deleteTx = useDeleteTransaction();
  
  const [txToEdit, setTxToEdit] = React.useState<any>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = React.useState(false);
  const [emailContent, setEmailContent] = React.useState("");
  
  const parseEmail = useParseEmailTransaction();
  const importEmails = useImportEmailTransactions();
  const [parsedTxs, setParsedTxs] = React.useState<ParsedTransaction[]>([]);

  const filteredTxs = data?.transactions.filter(tx => 
    tx.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
    tx.merchantName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      deleteTx.mutate({ id }, {
        onSuccess: () => toast({ title: "Deleted successfully" }),
        onError: () => toast({ title: "Error deleting", variant: "destructive" })
      });
    }
  };

  const handleParseEmail = () => {
    if (!emailContent.trim()) return;
    parseEmail.mutate(
      { data: { emailContent } },
      {
        onSuccess: (res) => {
          if (res.transactions.length > 0) {
            setParsedTxs(res.transactions);
            toast({ title: `Found ${res.transactions.length} transactions` });
          } else {
            toast({ title: "No transactions found in text", variant: "destructive" });
          }
        },
        onError: () => toast({ title: "Failed to parse", variant: "destructive" })
      }
    );
  };

  const handleImportEmails = () => {
    if (parsedTxs.length === 0) return;
    
    const mappedTxs = parsedTxs.map(pt => ({
      amount: pt.amount,
      type: pt.type,
      description: pt.description,
      merchantName: pt.merchantName,
      date: pt.date,
      categoryId: pt.suggestedCategoryId,
      accountId: pt.accountId,
      importSource: "email" as const
    }));

    importEmails.mutate(
      { data: { transactions: mappedTxs } },
      {
        onSuccess: (res) => {
          toast({ title: `Imported ${res.imported} transactions successfully` });
          setIsEmailModalOpen(false);
          setEmailContent("");
          setParsedTxs([]);
        },
        onError: () => toast({ title: "Import failed", variant: "destructive" })
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground mt-1">Manage all your income and expenses.</p>
        </div>
        
        <Button 
          variant="outline" 
          className="hover-elevate shadow-sm bg-primary/5 text-primary border-primary/20 hover:bg-primary/10"
          onClick={() => setIsEmailModalOpen(true)}
        >
          <Mail className="w-4 h-4 mr-2" />
          Smart Email Import
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b flex items-center gap-4 bg-muted/20">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search transactions..." 
                className="pl-9 bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="relative w-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Loading transactions...
                    </TableCell>
                  </TableRow>
                ) : filteredTxs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No transactions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTxs?.map((tx) => (
                    <TableRow key={tx.id} className="group transition-colors hover:bg-muted/30">
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{tx.description}</div>
                        {tx.merchantName && (
                          <div className="text-xs text-muted-foreground">{tx.merchantName}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {tx.categoryName ? (
                          <Badge variant="secondary" className="font-normal bg-secondary">
                            <span className="mr-1">{tx.categoryIcon}</span>
                            {tx.categoryName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {tx.accountName || '-'}
                      </TableCell>
                      <TableCell className={`text-right font-bold whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-600' : 'text-foreground'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setTxToEdit(tx)}>
                            <Edit2 className="w-4 h-4 text-muted-foreground hover:text-primary" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(tx.id)}>
                            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <TransactionDialog 
        open={!!txToEdit} 
        onOpenChange={(open) => !open && setTxToEdit(null)}
        transactionToEdit={txToEdit}
      />

      {/* Email Import Modal */}
      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import via Email Text</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2">
            {parsedTxs.length === 0 ? (
              <div className="space-y-4 h-full flex flex-col">
                <p className="text-sm text-muted-foreground">
                  Paste the content of your bank transaction emails here. Our AI will extract the amount, merchant, date, and suggest a category.
                </p>
                <textarea
                  className="w-full flex-1 min-h-[250px] p-4 rounded-xl border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none bg-muted/10 font-mono text-sm"
                  placeholder="Paste email text here..."
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-primary/10 text-primary p-3 rounded-lg text-sm font-medium flex items-center justify-between">
                  <span>Found {parsedTxs.length} transactions</span>
                  <Button variant="ghost" size="sm" onClick={() => setParsedTxs([])}>Reset</Button>
                </div>
                {parsedTxs.map((pt, i) => (
                  <div key={i} className="border rounded-xl p-4 bg-card shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-lg">{pt.description}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(pt.date)}</p>
                      </div>
                      <div className={`font-bold text-xl ${pt.type === 'income' ? 'text-emerald-600' : 'text-foreground'}`}>
                        {pt.type === 'income' ? '+' : '-'}{formatCurrency(pt.amount)}
                      </div>
                    </div>
                    {pt.suggestedCategoryName && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Suggested Category:</span>
                        <Badge variant="secondary">{pt.suggestedCategoryName}</Badge>
                        <span className="text-xs text-muted-foreground ml-auto">Confidence: {Math.round(pt.confidence * 100)}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t flex justify-end gap-3 mt-auto">
            <Button variant="outline" onClick={() => setIsEmailModalOpen(false)}>Cancel</Button>
            {parsedTxs.length === 0 ? (
              <Button 
                onClick={handleParseEmail} 
                disabled={!emailContent.trim() || parseEmail.isPending}
              >
                {parseEmail.isPending ? "Extracting..." : "Extract Transactions"}
              </Button>
            ) : (
              <Button 
                onClick={handleImportEmails}
                disabled={importEmails.isPending}
                className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25"
              >
                {importEmails.isPending ? "Importing..." : `Import ${parsedTxs.length} Transactions`}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
