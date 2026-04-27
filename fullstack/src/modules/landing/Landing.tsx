"use client";

import { useRouter } from "next/navigation";
import { useWallet } from "@/src/provider/WalletContext";
import LandingNavbar from "./components/LandingNavbar";
import HeroSection from "./components/HeroSection";
import HowItWorksSection from "./components/HowItWorksSection";
import GameModesSection from "./components/GameModesSection";
import StatsSection from "./components/StatsSection";
import Footer from "@/src/components/layouts/Footer";

export default function LandingPage() {
  const router = useRouter();
  const { isConnected, connect } = useWallet();

  const handlePlay = () => {
    if (isConnected) router.push("/play");
    else connect();
  };

  return (
    <div className="min-h-screen bg-background grid-bg">
      <LandingNavbar onPlay={handlePlay} />
      <HeroSection onPlay={handlePlay} />
      <HowItWorksSection />
      <GameModesSection />
      <StatsSection />
      <Footer />
    </div>
  );
}
