import { Card, CardContent } from "@/components/ui/card";

export default function StatsSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="bg-main text-main-foreground">
          <CardContent className="pt-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div><div className="text-3xl font-heading">$12.4K</div><div className="text-sm opacity-80">Current Jackpot</div></div>
              <div><div className="text-3xl font-heading">$248K</div><div className="text-sm opacity-80">Total Value Locked</div></div>
              <div><div className="text-3xl font-heading">$4.8K</div><div className="text-sm opacity-80">Solo Reserve</div></div>
              <div><div className="text-3xl font-heading">127</div><div className="text-sm opacity-80">Players Online</div></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
