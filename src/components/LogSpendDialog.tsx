import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

type Props = {
  trigger: ReactNode;
  categoryId?: string | null;
  categoryName?: string;
  onSaved?: () => void | Promise<void>;
};

export function LogSpendDialog({ trigger, categoryId = null, categoryName, onSaved }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

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
      category_id: categoryId,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setAmount("");
    setDesc("");
    setOpen(false);
    await onSaved?.();
    toast.success("Spend logged");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log spend{categoryName ? ` — ${categoryName}` : ""}</DialogTitle>
          <DialogDescription>Record a new transaction.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="ls-amt">Amount (£)</Label>
            <Input
              id="ls-amt"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div>
            <Label htmlFor="ls-desc">Note (optional)</Label>
            <Input
              id="ls-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="e.g. Tesco shop"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "…" : "Log spend"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
