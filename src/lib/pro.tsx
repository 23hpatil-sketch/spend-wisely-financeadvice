import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import despia from "despia-native";
import { useAuth } from "@/lib/auth";

/**
 * Pro / Premium subscription state via RevenueCat through the Despia native bridge.
 * Entitlement id: "pro"
 */

// TODO: replace with your real RevenueCat web paywall token for the web fallback
const REVCAT_WEB_TOKEN = "YOUR_REVCAT_WEB_TOKEN";
const OFFERING = "default";
const ENTITLEMENT_ID = "pro";

type ProCtx = {
  isPro: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  launchPaywall: () => void;
  restore: () => Promise<void>;
};

const Ctx = createContext<ProCtx>({
  isPro: false,
  loading: false,
  refresh: async () => {},
  launchPaywall: () => {},
  restore: async () => {},
});

const isDespiaUA = () =>
  typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("despia");

function localKey(userId: string) {
  return `swl:isPro:${userId}`;
}

async function fetchEntitlement(): Promise<boolean> {
  if (!isDespiaUA()) return false;
  try {
    const data: any = await despia("getpurchasehistory://", ["restoredData"] as any);
    const restored: any[] = data?.restoredData ?? [];
    const active = restored.filter((p) => p?.isActive);
    return active.some((p) => p?.entitlementId === ENTITLEMENT_ID);
  } catch {
    return false;
  }
}

export function ProProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(false);

  // Hydrate cached state instantly so UI doesn't flicker
  useEffect(() => {
    if (!user) {
      setIsPro(false);
      return;
    }
    try {
      const cached = localStorage.getItem(localKey(user.id));
      if (cached === "1") setIsPro(true);
    } catch {
      // ignore
    }
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const active = await fetchEntitlement();
    setIsPro(active);
    try {
      localStorage.setItem(localKey(user.id), active ? "1" : "0");
    } catch {
      // ignore
    }
    setLoading(false);
  }, [user]);

  // Check entitlement on every app load (when user is known)
  useEffect(() => {
    if (!user) return;
    refresh();
  }, [user, refresh]);

  const launchPaywall = useCallback(() => {
    if (!user) return;
    const appUserId = user.id;
    if (isDespiaUA()) {
      despia(
        `revenuecat://launchPaywall?external_id=${encodeURIComponent(appUserId)}&offering=${OFFERING}` as any
      );
    } else {
      window.location.href = `https://pay.rev.cat/${REVCAT_WEB_TOKEN}/${encodeURIComponent(appUserId)}`;
    }
  }, [user]);

  const restore = useCallback(async () => {
    await refresh();
  }, [refresh]);

  return (
    <Ctx.Provider value={{ isPro, loading, refresh, launchPaywall, restore }}>
      {children}
    </Ctx.Provider>
  );
}

export const usePro = () => useContext(Ctx);
export const useIsPro = () => useContext(Ctx).isPro;