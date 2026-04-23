import { useCallback, useEffect, useRef, useState } from "react";
import despia from "despia-native";
import { useAuth } from "@/lib/auth";

/**
 * Daily-limited rewarded ad system using Despia Native SDK.
 * - 15 ads max per user per day
 * - 15 views of "graph" / "transactions" per user per day
 * - Reward only granted when updateRewardedStatus('true') AND user agent contains "despia"
 */

export const DAILY_AD_LIMIT = 15;
export const DAILY_VIEW_LIMIT = 15;

const todayKey = () => new Date().toISOString().slice(0, 10);
const k = (uid: string, kind: string) => `swl:${kind}:${uid}:${todayKey()}`;

export function getAdsWatchedToday(userId: string): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(k(userId, "ads")) ?? 0);
}

export function incrementAdsWatched(userId: string): number {
  const next = getAdsWatchedToday(userId) + 1;
  localStorage.setItem(k(userId, "ads"), String(next));
  return next;
}

export function getViewsToday(userId: string, page: "graph" | "transactions"): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(k(userId, `view:${page}`)) ?? 0);
}

export function incrementViews(userId: string, page: "graph" | "transactions"): number {
  const next = getViewsToday(userId, page) + 1;
  localStorage.setItem(k(userId, `view:${page}`), String(next));
  return next;
}

export function getTxnSinceLastAd(userId: string): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(`swl:txnSinceAd:${userId}`) ?? 0);
}

export function setTxnSinceLastAd(userId: string, value: number) {
  localStorage.setItem(`swl:txnSinceAd:${userId}`, String(value));
}

/** Hook to trigger a rewarded ad and await the global callback. */
export function useRewardedAd() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const resolverRef = useRef<((granted: boolean) => void) | null>(null);

  useEffect(() => {
    // Define the global callback the Despia native runtime calls
    (window as any).updateRewardedStatus = (status: string) => {
      const isDespia = navigator.userAgent.includes("despia");
      const granted = isDespia && status === "true";
      const resolve = resolverRef.current;
      resolverRef.current = null;
      setLoading(false);
      resolve?.(granted);
    };
    return () => {
      // Keep callback installed across mounts; don't delete to avoid races.
    };
  }, []);

  const showAd = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    if (getAdsWatchedToday(user.id) >= DAILY_AD_LIMIT) return false;
    setLoading(true);
    try {
      despia("displayrewardedad://");
    } catch {
      setLoading(false);
      return false;
    }
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      // Safety timeout — if no callback in 60s, treat as failure
      window.setTimeout(() => {
        if (resolverRef.current) {
          resolverRef.current = null;
          setLoading(false);
          resolve(false);
        }
      }, 60_000);
    }).then((granted) => {
      if (granted) incrementAdsWatched(user.id);
      return granted;
    });
  }, [user]);

  return {
    showAd,
    loading,
    adsWatchedToday: user ? getAdsWatchedToday(user.id) : 0,
    adsRemaining: user ? Math.max(0, DAILY_AD_LIMIT - getAdsWatchedToday(user.id)) : 0,
  };
}