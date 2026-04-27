"use client";

import { Card, CardContent } from "@/components/ui/card";
import UsdcIcon from "@/src/components/elements/UsdcIcon";
import { formatUsdc } from "@/src/utils/utils";
import type { ProfileData } from "../types/profile.types";

export default function StatsGrid({ profile }: { profile: ProfileData }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card className="bg-chart-3/30">
        <CardContent className="pt-6">
          <p className="text-xs font-heading text-foreground/60">EARNED</p>
          <p className="flex items-center gap-2 text-center text-2xl font-heading text-foreground">
            {formatUsdc(profile.total_earned)} <UsdcIcon size={20} />
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs font-heading text-foreground/60">ROUNDS</p>
          <p className="text-2xl font-heading text-foreground">{profile.total_rounds_played}</p>
          <p className="text-xs text-foreground/50">played</p>
        </CardContent>
      </Card>
      <Card className="bg-chart-5/20">
        <CardContent className="pt-6">
          <p className="text-xs font-heading text-foreground/60">BEST ACC</p>
          <p className="text-2xl font-heading text-foreground">
            {profile.best_accuracy > 0 ? `${profile.best_accuracy.toFixed(1)}%` : "-"}
          </p>
        </CardContent>
      </Card>
      <Card className="bg-chart-4/20">
        <CardContent className="pt-6">
          <p className="text-xs font-heading text-foreground/60">STREAK</p>
          <p className="text-2xl font-heading text-foreground">
            {profile.current_win_streak > 0 ? `${profile.current_win_streak}x` : "-"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
