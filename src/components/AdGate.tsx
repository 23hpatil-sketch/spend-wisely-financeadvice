import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import {
  DAILY_AD_LIMIT,
  DAILY_VIEW_LIMIT,
  getViewsToday,
  incrementViews,
  useRewardedAd,
} from "@/lib/rewardedAds";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, Lock } from "lucide-react";
import { toast } from "sonner";

type Props = {
  page: "graph" | "transactions";
  rewardLabel: string;
  children: ReactNode;
};

/**
 * Gates a page behind a rewarded ad.
 * - User must watch an ad to view the content
 * - Counts toward daily 15-view limit per page
 * - Counts toward daily 15-ad limit
 */
export function AdGate({ page, rewardLabel, children }: Props) {
  const { user } = useAuth();
  const { showAd, loading, adsRemaining } = useRewardedAd();
  const [unlocked, setUnlocked] = useState(false);
  const [viewsUsed, setViewsUsed] = useState(0);

  useEffect(() => {
    if (user) setViewsUsed(getViewsToday(user.id, page));
  }, [user, page]);

  const viewsRemaining = Math.max(0, DAILY_VIEW_LIMIT - viewsUsed);

  const handleWatch = async () => {
    if (!user) return;
    if (viewsRemaining <= 0) {
      toast.error(`Daily limit reached: ${DAILY_VIEW_LIMIT} ${page} views per day.`);
      return;
    }
    if (adsRemaining <= 0) {
      toast.error(`Daily limit reached: ${DAILY_AD_LIMIT} ads per day.`);
      return;
    }
    const granted = await showAd();
    if (granted) {
      const next = incrementViews(user.id, page);
      setViewsUsed(next);
      setUnlocked(true);
      toast.success(rewardLabel);
    } else {
      toast.error("Ad not completed. Reward not granted.");
    }
  };

  if (unlocked) return <>{children}</>;

  const blocked = viewsRemaining <= 0 || adsRemaining <= 0;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Watch an ad to continue
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {blocked
              ? "You've reached your daily limit. Come back tomorrow to unlock again."
              : `Watch a short video ad to ${rewardLabel.toLowerCase()}.`}
          </p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Ads remaining today: <span className="font-medium text-foreground">{adsRemaining} / {DAILY_AD_LIMIT}</span></p>
          </div>
          <Button onClick={handleWatch} disabled={loading || blocked} className="w-full">
            <PlayCircle className="h-4 w-4 mr-2" />
            {loading ? "Loading ad…" : "Watch ad"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}