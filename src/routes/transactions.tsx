import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfileData } from "@/lib/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AdGate } from "@/components/AdGate";
import { useRewardedAd, getTxnSinceLastAd, setTxnSinceLastAd } from "@/lib/rewardedAds";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Search, X } from "lucide-react";
import { gbp } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/transactions")({
  component: TransactionsPage,
});

function TransactionsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { categories, transactions, refresh } = useProfileData();
  const { showAd } = useRewardedAd();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [catId, setCatId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((t) => {
      const desc = (t.description ?? "").toLowerCase();
      const cat = (categories.find((c) => c.id === t.category_id)?.name ?? "uncategorised").toLowerCase();
      const amt = String(t.amount);
      return desc.includes(q) || cat.includes(q) || amt.includes(q);
    });
  }, [transactions, categories, query]);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorised";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0) return toast.error("Enter a valid amount.");
    setBusy(true);
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      amount: amt,
      description: desc.trim() || null,
      category_id: catId || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setAmount(""); setDesc(""); setCatId("");
    setOpen(false);
    await refresh();
    toast.success("Transaction added");

    // Show a rewarded ad every 3 transactions
    const count = getTxnSinceLastAd(user.id) + 1;
    if (count >= 3) {
      setTxnSinceLastAd(user.id, 0);
      toast.info("Quick ad break — thanks for supporting us!");
      await showAd();
    } else {
      setTxnSinceLastAd(user.id, count);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await refresh();
  };

  return (
    <AppShell>
      <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {filtered.length} of {transactions.length} transactions
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New transaction</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label htmlFor="amt">Amount (£)</Label>
                <Input id="amt" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="desc">Description</Label>
                <Input id="desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Groceries" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={catId} onValueChange={setCatId}>
                  <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "…" : "Add transaction"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by description, category, or amount…"
          className="pl-9 pr-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All transactions</CardTitle></CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet. Tap "Add" to record one.</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions match "{query}".</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.description || "Transaction"}</p>
                    <p className="text-xs text-muted-foreground">
                      {catName(t.category_id)} · {new Date(t.occurred_at).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{gbp(Number(t.amount))}</span>
                    <Button variant="ghost" size="icon" onClick={() => remove(t.id)} aria-label="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
