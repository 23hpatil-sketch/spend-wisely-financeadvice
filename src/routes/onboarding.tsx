import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

const DEFAULT_CATEGORIES = ["Food", "Rent", "Transport", "Entertainment", "Bills", "Shopping"];

function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [monthlySalary, setMonthlySalary] = useState("");
  const [cats, setCats] = useState<string[]>([...DEFAULT_CATEGORIES]);
  const [newCat, setNewCat] = useState("");
  const [budgets, setBudgets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const addCat = () => {
    const v = newCat.trim();
    if (!v || cats.includes(v)) return;
    setCats([...cats, v]);
    setNewCat("");
  };

  const removeCat = (c: string) => {
    setCats(cats.filter((x) => x !== c));
    setBudgets((b) => {
      const n = { ...b };
      delete n[c];
      return n;
    });
  };

  const finish = async () => {
    if (!user) return;
    const monthly = parseFloat(monthlySalary);
    if (Number.isNaN(monthly) || monthly < 0) return toast.error("Enter a valid monthly salary.");
    if (cats.length === 0) return toast.error("Add at least one category.");
    setBusy(true);
    const { error: pErr } = await supabase
      .from("profiles")
      .upsert({ id: user.id, yearly_salary: monthly * 12, onboarded: true });
    if (pErr) {
      setBusy(false);
      return toast.error(pErr.message);
    }
    const { error: cErr } = await supabase
      .from("categories")
      .insert(
        cats.map((name) => {
          const b = parseFloat(budgets[name] ?? "");
          return {
            user_id: user.id,
            name,
            monthly_budget: Number.isFinite(b) && b >= 0 ? b : 0,
          };
        })
      );
    setBusy(false);
    if (cErr) return toast.error(cErr.message);
    toast.success("All set!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Welcome 👋</CardTitle>
          <CardDescription>
            {step === 0
              ? "What is your monthly salary?"
              : step === 1
                ? "Pick your spending categories."
                : "Set a monthly budget for each category."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 ? (
            <>
              <div>
                <Label htmlFor="salary">Monthly salary (£)</Label>
                <Input
                  id="salary"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 2500"
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={() => setStep(1)} disabled={!monthlySalary}>
                Continue
              </Button>
            </>
          ) : step === 1 ? (
            <>
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"
                  >
                    {c}
                    <button onClick={() => removeCat(c)} aria-label={`Remove ${c}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add another category"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCat())}
                />
                <Button type="button" onClick={addCat} variant="secondary">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1">Back</Button>
                <Button onClick={() => setStep(2)} disabled={cats.length === 0} className="flex-1">
                  Continue
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {cats.map((c) => (
                  <div key={c} className="flex items-center gap-3">
                    <Label className="flex-1 text-sm">{c}</Label>
                    <div className="relative w-32">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        className="pl-6"
                        value={budgets[c] ?? ""}
                        onChange={(e) => setBudgets({ ...budgets, [c]: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Leave blank to set later (defaults to £0).</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                <Button onClick={finish} disabled={busy} className="flex-1">
                  {busy ? "…" : "Finish"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
