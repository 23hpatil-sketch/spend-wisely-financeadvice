import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const QUICK_CATEGORIES = ["Food", "Transport", "Shopping"] as const;

async function assignCategory(transactionId: string, userId: string, categoryName: string) {
  // Find or create category by name for this user
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

  if (updErr) {
    toast.error("Failed to assign category");
  } else {
    toast.success(`Assigned to ${categoryName}`);
  }
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

          toast(`${label} — £${amount}`, {
            description: "Which category do you want to deduct this from?",
            duration: 30000,
            action: {
              label: QUICK_CATEGORIES[0],
              onClick: () => assignCategory(tx.id, userId, QUICK_CATEGORIES[0]),
            },
            cancel: {
              label: QUICK_CATEGORIES[1],
              onClick: () => assignCategory(tx.id, userId, QUICK_CATEGORIES[1]),
            },
          });

          // Second toast for Shopping since sonner only supports 1 action + 1 cancel
          toast(`${label}`, {
            description: `Or assign to ${QUICK_CATEGORIES[2]}?`,
            duration: 30000,
            action: {
              label: QUICK_CATEGORIES[2],
              onClick: () => assignCategory(tx.id, userId, QUICK_CATEGORIES[2]),
            },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return null;
}
