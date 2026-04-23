import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

/**
 * Sends a daily local notification reminding the user to track their spending.
 * Uses the Web Notifications API (works in PWA / Despia native shell).
 */
export function DailyReminder() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    const today = new Date().toISOString().slice(0, 10);
    const key = `swl:reminderSent:${user.id}:${today}`;
    if (localStorage.getItem(key)) return;

    const send = () => {
      try {
        new Notification("Spend Wisely", {
          body: "Time to track your spending today and stay on budget!",
          icon: "/favicon.ico",
          tag: `daily-${today}`,
        });
        localStorage.setItem(key, "1");
      } catch {
        // ignore
      }
    };

    if (Notification.permission === "granted") {
      send();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((p) => {
        if (p === "granted") send();
      });
    }
  }, [user]);

  return null;
}