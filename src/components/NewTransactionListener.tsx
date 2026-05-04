import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/lib/usePushNotifications";

async function assignCategory(transactionId: string, categoryId: string, categoryName: string) {
  const { error } = await supabase
    .from("transactions")
    .update({ category_id: categoryId, pending_category: false })
    .eq("id", transactionId);
  if (error) toast.error("Failed to assign category");
  else toast.success(`Assigned to ${categoryName}`);
}

export function NewTransactionListener() {
  const { user } = useAuth();
  const userId = user?.id;
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  usePushNotifications();

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("categories")
      .select("id, name")
      .eq("user_id", userId)
      .order("created_at")
      .then(({ data }) => setCats((data ?? []) as any));
  }, [userId]);

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
          const label = tx.merchant_name || tx.description || "Unknown";
          const amount = Number(tx.amount).toFixed(2);

          toast.custom(
            (t) => (
              <div className="rounded-lg border border-border bg-background p-4 shadow-lg w-[360px]">
                <div className="font-semibold text-sm">New Transaction: £{amount} at {label}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Select category to deduct from:
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  {cats.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No categories. Add some in Settings.</span>
                  ) : (
                    cats.map((c) => (
                      <Button
                        key={c.id}
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          toast.dismiss(t);
                          await assignCategory(tx.id, c.id, c.name);
                        }}
                      >
                        {c.name}
                      </Button>
                    ))
                  )}
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
  }, [userId, cats]);

  return null;
}
