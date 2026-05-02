import { useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfileData } from "@/lib/useProfile";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { gbp } from "@/lib/format";
import { toast } from "sonner";

type Props = {
  trigger: ReactNode;
  categoryId: string;
  categoryName: string;
  onDeleted?: () => void | Promise<void>;
};

/**
 * Delete a category with a choice:
 *  - Keep transactions (they become "Uncategorised" but still count in totals)
 *  - Delete transactions too (removes them from history and totals)
 */
export function DeleteCategoryDialog({ trigger, categoryId, categoryName, onDeleted }: Props) {
  const { transactions } = useProfileData();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { count, total } = useMemo(() => {
    const txs = transactions.filter((t) => t.category_id === categoryId);
    return {
      count: txs.length,
      total: txs.reduce((s, t) => s + Number(t.amount), 0),
    };
  }, [transactions, categoryId]);

  const finish = async () => {
    setOpen(false);
    await onDeleted?.();
  };

  const keepTx = async () => {
    setBusy(true);
    // Null out the category on existing transactions, then delete the category.
    const { error: updErr } = await supabase
      .from("transactions")
      .update({ category_id: null })
      .eq("category_id", categoryId);
    if (updErr) {
      setBusy(false);
      return toast.error(updErr.message);
    }
    const { error } = await supabase.from("categories").delete().eq("id", categoryId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`"${categoryName}" deleted. Transactions kept as Uncategorised.`);
    await finish();
  };

  const deleteAll = async () => {
    setBusy(true);
    const { error: txErr } = await supabase
      .from("transactions")
      .delete()
      .eq("category_id", categoryId);
    if (txErr) {
      setBusy(false);
      return toast.error(txErr.message);
    }
    const { error } = await supabase.from("categories").delete().eq("id", categoryId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`"${categoryName}" and ${count} transaction${count === 1 ? "" : "s"} deleted.`);
    await finish();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{categoryName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            {count === 0
              ? "This category has no transactions. It will be removed."
              : `This category has ${count} transaction${count === 1 ? "" : "s"} totalling ${gbp(total)}. Choose what to do with them.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {count === 0 ? (
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={keepTx} disabled={busy}>
              {busy ? "…" : "Delete category"}
            </Button>
          </AlertDialogFooter>
        ) : (
          <div className="flex flex-col gap-2 pt-2">
            <Button variant="outline" onClick={keepTx} disabled={busy} className="justify-start h-auto py-3">
              <div className="text-left">
                <div className="font-medium">Keep transactions in spendings</div>
                <div className="text-xs text-muted-foreground">
                  They'll show as "Uncategorised" and still count toward your yearly total.
                </div>
              </div>
            </Button>
            <Button variant="destructive" onClick={deleteAll} disabled={busy} className="justify-start h-auto py-3">
              <div className="text-left">
                <div className="font-medium">Delete all {count} transaction{count === 1 ? "" : "s"} too</div>
                <div className="text-xs opacity-90">
                  Permanently removes {gbp(total)} from your history.
                </div>
              </div>
            </Button>
            <AlertDialogCancel disabled={busy} className="mt-1">Cancel</AlertDialogCancel>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
