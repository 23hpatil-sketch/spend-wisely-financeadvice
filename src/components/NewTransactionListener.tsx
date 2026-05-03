import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const QUICK_CATEGORIES = ["Food", "Transport", "Shopping"] as const;

async function assignCategory(transactionId: string, userId: string, categoryName: string) {
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", categoryName)
    .maybeSingle();

  let categoryId = existing?.id;
  if (!categoryId) {
    const { data: created, error } = await supabase
      .from("categories")
      .insert({ user_id: userId, name: categoryName, monthly_budget: 0 })
      .select("id")
      .single();
    if (error || !created) {
      toast.error("Could not create category");
      return;
    }
    categoryId = created.id;
  }

  const { error: updErr } = await supabase
    .from("transactions")
    .update({ category_id: categoryId, pending_category: false })
    .eq("id", transactionId);

  if (updErr) toast.error("Failed to assign category");
  else toast.success(`Assigned to ${categoryName}`);
}

export function NewTransactionListener() {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`tx-inserts-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const tx = payload.new as {
            id: string;
            amount: number;
            description: string | null;
            merchant_name: string | null;
          };
          const label = tx.merchant_name || tx.description || "New transaction";
          const amount = Number(tx.amount).toFixed(2);

          toast.custom(
            (t) => (
              <div className="rounded-lg border border-border bg-background p-4 shadow-lg w-[340px]">
                <div className="font-semibold text-sm">{label} — £{amount}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Which category do you want to deduct this from?
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  {QUICK_CATEGORIES.map((cat) => (
                    <Button
                      key={cat}
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        toast.dismiss(t);
                        await assignCategory(tx.id, userId, cat);
                      }}
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
              </div>
            ),
            { duration: 30000 }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return null;
}
