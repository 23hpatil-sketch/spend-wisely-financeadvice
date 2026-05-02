import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfileData } from "@/lib/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, ImageIcon, Loader2, RotateCcw, ScanLine } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/scan")({
  component: ScanPage,
});

type Extracted = {
  merchant: string | null;
  total: number | null;
  currency: string | null;
  date: string | null;
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

function ScanPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { categories, refresh } = useProfileData();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [catId, setCatId] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  const reset = () => {
    setPreviewUrl(null);
    setExtracted(null);
    setMerchant("");
    setAmount("");
    setCatId("");
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  };

  const onFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setScanning(true);
    setExtracted(null);
    try {
      const dataUrl = await fileToBase64(file);
      setPreviewUrl(dataUrl);

      const { data, error } = await supabase.functions.invoke("scan-receipt", {
        body: { imageBase64: dataUrl },
      });
      if (error) throw new Error(error.message);
      const result = data as Extracted | { error: string };
      if ("error" in result) throw new Error(result.error);

      setExtracted(result);
      setMerchant(result.merchant ?? "");
      setAmount(result.total != null ? String(result.total) : "");
      if (!result.merchant && result.total == null) {
        toast.warning("Couldn't read this receipt — try a clearer photo.");
      } else {
        toast.success("Receipt scanned! Confirm and save.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to scan receipt.");
    } finally {
      setScanning(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (!catId) {
      toast.error("Pick a category.");
      return;
    }
    setSaving(true);
    const description = merchant.trim() || "Scanned receipt";
    const occurredAt = extracted?.date
      ? new Date(extracted.date).toISOString()
      : new Date().toISOString();
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      amount: amt,
      description,
      merchant_name: merchant.trim() || null,
      category_id: catId,
      occurred_at: occurredAt,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
    toast.success("Transaction saved from receipt.");
    reset();
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanLine className="h-5 w-5" /> Scan a receipt
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Take a photo of any receipt. We'll read the merchant and total
              automatically — you just pick the category.
            </p>

            {/* Hidden inputs: one opens the camera, one opens the gallery/files */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />

            {!previewUrl && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  disabled={scanning}
                  className="group flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card p-6 h-36 transition-colors hover:border-primary hover:bg-accent disabled:opacity-50"
                >
                  <Camera className="h-8 w-8 text-primary" />
                  <span className="font-medium">Use camera</span>
                  <span className="text-xs text-muted-foreground">Scan a receipt now</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  disabled={scanning}
                  className="group flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card p-6 h-36 transition-colors hover:border-primary hover:bg-accent disabled:opacity-50"
                >
                  <ImageIcon className="h-8 w-8 text-primary" />
                  <span className="font-medium">From gallery</span>
                  <span className="text-xs text-muted-foreground">Pick an existing photo</span>
                </button>
              </div>
            )}

            {previewUrl && (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden border border-border bg-muted">
                  <img
                    src={previewUrl}
                    alt="Receipt preview"
                    className="w-full max-h-80 object-contain bg-background"
                  />
                  {scanning && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Loader2 className="h-4 w-4 animate-spin" /> Reading receipt…
                      </div>
                    </div>
                  )}
                </div>
                <Button variant="outline" className="w-full" onClick={reset} disabled={scanning || saving}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Use a different photo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {extracted && !scanning && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Confirm details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={save} className="space-y-3">
                <div>
                  <Label htmlFor="merchant">Merchant</Label>
                  <Input
                    id="merchant"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="e.g. Tesco"
                  />
                </div>
                <div>
                  <Label htmlFor="total">Total (£)</Label>
                  <Input
                    id="total"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Deduct from category</Label>
                  <Select value={catId} onValueChange={setCatId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {categories.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Add a category in Settings first.
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Saving…" : "Save transaction"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}