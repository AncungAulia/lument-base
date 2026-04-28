import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


export default function GameModesSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <Badge className="mb-4">Game Modes</Badge>
          <h2 className="text-3xl sm:text-4xl font-heading text-foreground">Choose Your Battle</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card data-scroll-card data-kinetic className=" transform-gpu">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Solo</CardTitle>
                <Badge className="bg-main text-main-foreground">
                  <span className="inline-flex items-center gap-1">5 USDC</span>
                </Badge>
              </div>
              <CardDescription>
                Hone your skills. Only your accuracy matters. Score ≥90% to profit, hit ≥98% for the 10.0 USDC Jackpot!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
              </div>
            </CardContent>
          </Card>
          <Card data-scroll-card data-kinetic data-rotate="-0.5" className="transform-gpu">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Duel</CardTitle>
                <Badge className="bg-main text-main-foreground">
                  <span className="inline-flex items-center gap-1">10 USDC</span>
                </Badge>
              </div>
              <CardDescription>
                <span className="inline-flex items-center gap-1">Head-to-head showdown. 20 seconds. Highest accuracy survives. Winner takes 16 USDC.</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
            
            </CardContent>
          </Card>
          <Card data-scroll-card data-kinetic className="transform-gpu">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Royale</CardTitle>
                <Badge className="bg-main text-main-foreground">
                  <span className="inline-flex items-center gap-1">10 USDC</span>
                </Badge>
              </div>
              <CardDescription>
                <span className="inline-flex items-center gap-1">5-player free-for-all. Same color, same timer. Highest accuracy wins the huge 40 USDC pool!</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
