import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const VAPID_PUBLIC = "BH7pAnd4EUbZiGypKZws474Uk5ZTho1AWQGyvgw_M6byp6Q4R3EwGIOXcdbL3CfF3EC8csZzv8cuqvlyuzgdIAE";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToB64(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isPreviewOrIframe() {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
}

export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (isPreviewOrIframe()) return;
    if (Notification.permission === "denied") return;

    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/push-sw.js");
        if (Notification.permission === "default") {
          const perm = await Notification.requestPermission();
          if (perm !== "granted") return;
        }
        if (cancelled) return;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
          });
        }
        const json = sub.toJSON() as any;
        const endpoint = sub.endpoint;
        const p256dh = json.keys?.p256dh ?? bufToB64(sub.getKey("p256dh"));
        const auth = json.keys?.auth ?? bufToB64(sub.getKey("auth"));
        await supabase.from("push_subscriptions").upsert(
          { user_id: user.id, endpoint, p256dh, auth },
          { onConflict: "endpoint" },
        );
      } catch (err) {
        console.warn("push subscribe failed", err);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);
}