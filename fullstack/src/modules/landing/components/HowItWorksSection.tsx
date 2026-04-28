import { Eye, Palette, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <Badge className="mb-4">How It Works</Badge>
          <h2 className="text-3xl sm:text-4xl font-heading text-foreground">Three Steps to Victory</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card data-scroll-card data-kinetic className="text-center transform-gpu">
            <CardHeader>
              <div className="mx-auto w-16 h-16 rounded-base bg-main border-2 border-border shadow-shadow flex items-center justify-center mb-2">
                <Eye className="w-8 h-8 text-main-foreground" />
              </div>
              <CardTitle className="text-xl">1. See</CardTitle>
              <CardDescription>We show you a target color for 5 seconds. Study it carefully, no hex codes, no hints.</CardDescription>
            </CardHeader>
          </Card>
          <Card data-scroll-card data-kinetic data-rotate="-0.5" className="text-center transform-gpu">
            <CardHeader>
              <div className="mx-auto w-16 h-16 rounded-base bg-chart-3 border-2 border-border shadow-shadow flex items-center justify-center mb-2">
                <Palette className="w-8 h-8 text-main-foreground" />
              </div>
              <CardTitle className="text-xl">2. Match</CardTitle>
              <CardDescription>Use HSL sliders to recreate the color from memory. Adjust hue, saturation, and lightness.</CardDescription>
            </CardHeader>
          </Card>
          <Card data-scroll-card data-kinetic className="text-center transform-gpu">
            <CardHeader>
              <div className="mx-auto w-16 h-16 rounded-base bg-chart-2 border-2 border-border shadow-shadow flex items-center justify-center mb-2">
                <Trophy className="w-8 h-8 text-main-foreground" />
              </div>
              <CardTitle className="text-xl">3. Win</CardTitle>
              <CardDescription>
                Crush the target in Solo mode to double your money, or outsmart real players in Multiplayer to sweep the entire prize pool.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </section>
  );
}
