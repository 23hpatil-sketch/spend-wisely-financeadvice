import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type Profile = { id: string; yearly_salary: number; onboarded: boolean };
export type Category = { id: string; name: string; monthly_budget: number };
export type Transaction = {
  id: string;
  amount: number;
  description: string | null;
  category_id: string | null;
  occurred_at: string;
};

export function useProfileData() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: p }, { data: c }, { data: t }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("categories").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("transactions").select("*").eq("user_id", user.id).order("occurred_at", { ascending: false }),
    ]);
    setProfile(p as Profile | null);
    setCategories(((c ?? []) as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      monthly_budget: Number(r.monthly_budget ?? 0),
    })) as Category[]);
    setTransactions(((t ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`profile-data-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "categories", filter: `user_id=eq.${user.id}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);

  return { profile, categories, transactions, loading, refresh };
}
