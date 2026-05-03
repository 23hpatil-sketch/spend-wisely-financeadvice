import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createPlaidLinkToken, exchangePlaidPublicToken } from "@/server/plaid.functions";

export function ConnectBankButton({ onConnected }: { onConnected?: () => void }) {
  const createToken = useServerFn(createPlaidLinkToken);
  const exchangeToken = useServerFn(exchangePlaidPublicToken);

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    try {
      const res = await createToken();
      setLinkToken(res.linkToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start bank connection.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [createToken]);

  const onSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      try {
        await exchangeToken({
          data: {
            publicToken,
            institutionId: metadata.institution?.institution_id ?? null,
            institutionName: metadata.institution?.name ?? null,
          },
        });
        toast.success(`Connected ${metadata.institution?.name ?? "your bank"}`);
        onConnected?.();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save bank connection.";
        toast.error(msg);
      } finally {
        setLinkToken(null);
      }
    },
    [exchangeToken, onConnected],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => setLinkToken(null),
  });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return (
    <Button onClick={fetchToken} disabled={loading} variant="default">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
      {loading ? "Starting…" : "Connect Bank"}
    </Button>
  );
}