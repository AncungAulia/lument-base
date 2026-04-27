import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import UsdcIcon from "@/src/components/elements/UsdcIcon";

export default function GameModesSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <Badge className="mb-4">Game Modes</Badge>
          <h2 className="text-3xl sm:text-4xl font-heading text-foreground">Choose Your Battle</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-main/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Solo</CardTitle>
                <Badge><UsdcIcon size={14} /></Badge>
              </div>
              <CardDescription>Play at your own pace. Match colors, earn based on accuracy. Up to 2.0x payout.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-chart-3 text-main-foreground">JACKPOT 10.0</Badge>
                <Badge className="bg-chart-2 text-main-foreground">GREAT 7.5</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Duel</CardTitle>
                <Badge className="bg-chart-4 text-secondary-background">
                  <span className="inline-flex items-center gap-1">10 <UsdcIcon size={12} /></span>
                </Badge>
              </div>
              <CardDescription>
                <span className="inline-flex items-center gap-1">1v1 showdown. 17 seconds. Winner takes 16 <UsdcIcon size={12} /> (80% of the pool).</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2"><Badge>POOL 20</Badge><Badge>17s</Badge></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Royale</CardTitle>
                <Badge className="bg-chart-4 text-secondary-background">
                  <span className="inline-flex items-center gap-1">10 <UsdcIcon size={12} /></span>
                </Badge>
              </div>
              <CardDescription>
                <span className="inline-flex items-center gap-1">5 players. Same color. Highest accuracy wins 40 <UsdcIcon size={12} /> from the pool.</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2"><Badge>POOL 50</Badge><Badge>17s</Badge></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
