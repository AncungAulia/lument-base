"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useWallet } from "@/src/provider/WalletContext";
import LandingNavbar from "./components/LandingNavbar";
import HeroSection from "./components/HeroSection";
import HowItWorksSection from "./components/HowItWorksSection";
import GameModesSection from "./components/GameModesSection";
import StatsSection from "./components/StatsSection";
import Footer from "@/src/components/layouts/Footer";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export default function LandingPage() {
  const router = useRouter();
  const { isConnected, connect } = useWallet();
  const rootRef = useRef<HTMLDivElement>(null);

  const handlePlay = () => {
    if (isConnected) router.push("/play");
    else connect();
  };

  useGSAP(
    (_context, contextSafe) => {
      const safe =
        contextSafe ??
        (<T extends (...args: never[]) => unknown>(fn: T): T => fn);
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (reduceMotion) {
        gsap.set("[data-gsap-reveal], [data-scroll-card]", {
          clearProps: "all",
        });
        return;
      }

      const intro = gsap.timeline({
        defaults: { duration: 0.72, ease: "back.out(1.7)" },
      });

      intro
        .from("[data-gsap-reveal]", {
          y: 34,
          autoAlpha: 0,
          scale: 0.96,
          stagger: 0.08,
        })
        .fromTo(
          "[data-mouse-track]",
          {
            y: 30,
            autoAlpha: 0,
            scale: 0.75,
            rotation: (index) => [-8, 7, -5][index] ?? 0,
          },
          {
            y: 0,
            autoAlpha: 1,
            scale: 1,
            rotation: 0,
            stagger: 0.09,
          },
          "<0.15",
        );

      ScrollTrigger.batch("[data-scroll-card]", {
        start: "top 82%",
        once: true,
        onEnter: (batch) => {
          gsap.from(batch, {
            y: 42,
            autoAlpha: 0,
            rotation: (index) => [-2, 1.5, -1, 1][index % 4],
            duration: 0.65,
            ease: "back.out(1.45)",
            stagger: 0.08,
          });
        },
      });

      const floaters = gsap.utils.toArray<HTMLElement>("[data-mouse-track]");
      const floaterTweens = floaters.map((item, index) => ({
        x: gsap.quickTo(item, "x", { duration: 0.5, ease: "power3.out" }),
        y: gsap.quickTo(item, "y", { duration: 0.5, ease: "power3.out" }),
        rotation: gsap.quickTo(item, "rotation", {
          duration: 0.55,
          ease: "power3.out",
        }),
        depth: Number(item.dataset.depth ?? index + 1),
      }));

      const handlePointerMove = safe((event: PointerEvent) => {
        const xRatio = event.clientX / window.innerWidth - 0.5;
        const yRatio = event.clientY / window.innerHeight - 0.5;

        floaterTweens.forEach((tween) => {
          tween.x(xRatio * tween.depth * 18);
          tween.y(yRatio * tween.depth * -16);
          tween.rotation(xRatio * tween.depth * 5);
        });
      });

      const kineticItems = gsap.utils.toArray<HTMLElement>("[data-kinetic]");
      const cleanups = kineticItems.map((item) => {
        const enter = safe(() => {
          gsap.to(item, {
            scale: 1.025,
            rotation: Number(item.dataset.rotate ?? 0.5),
            duration: 0.22,
            ease: "power2.out",
            overwrite: "auto",
          });
        });
        const leave = safe(() => {
          gsap.to(item, {
            scale: 1,
            rotation: 0,
            duration: 0.28,
            ease: "power2.out",
            overwrite: "auto",
          });
        });
        const press = safe(() => {
          gsap.to(item, {
            scale: 0.95,
            duration: 0.12,
            ease: "power2.out",
            overwrite: "auto",
          });
        });

        item.addEventListener("pointerenter", enter);
        item.addEventListener("pointerleave", leave);
        item.addEventListener("pointerdown", press);
        item.addEventListener("pointerup", enter);

        return () => {
          item.removeEventListener("pointerenter", enter);
          item.removeEventListener("pointerleave", leave);
          item.removeEventListener("pointerdown", press);
          item.removeEventListener("pointerup", enter);
        };
      });

      window.addEventListener("pointermove", handlePointerMove);

      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        cleanups.forEach((cleanup) => cleanup());
        ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      };
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="min-h-screen bg-background grid-bg">
      <LandingNavbar onPlay={handlePlay} />
      <HeroSection onPlay={handlePlay} />
      <HowItWorksSection />
      <GameModesSection />
      <StatsSection />
      <Footer />
    </div>
  );
}
