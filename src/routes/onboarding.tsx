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
  const [salary, setSalary] = useState("");
  const [cats, setCats] = useState<string[]>([...DEFAULT_CATEGORIES]);
  const [newCat, setNewCat] = useState("");
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

  const removeCat = (c: string) => setCats(cats.filter((x) => x !== c));

  const finish = async () => {
    if (!user) return;
    const sal = parseFloat(salary);
    if (Number.isNaN(sal) || sal < 0) return toast.error("Enter a valid yearly salary.");
    if (cats.length === 0) return toast.error("Add at least one category.");
    setBusy(true);
    const { error: pErr } = await supabase
      .from("profiles")
      .upsert({ id: user.id, yearly_salary: sal, onboarded: true });
    if (pErr) {
      setBusy(false);
      return toast.error(pErr.message);
    }
    const { error: cErr } = await supabase
      .from("categories")
      .insert(cats.map((name) => ({ user_id: user.id, name })));
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
            {step === 0 ? "What is your yearly salary?" : "Pick your spending categories."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 ? (
            <>
              <div>
                <Label htmlFor="salary">Yearly salary (£)</Label>
                <Input
                  id="salary"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 35000"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={() => setStep(1)} disabled={!salary}>
                Continue
              </Button>
            </>
          ) : (
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
