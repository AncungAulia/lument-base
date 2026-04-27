"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useWallet } from "@/src/provider/WalletContext";
import { useTheme } from "@/src/provider/ThemeProvider";
import { Gamepad2, Vault, User } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/play", label: "Play", icon: Gamepad2 },
  { href: "/vault", label: "Payout", icon: Vault },
  { href: "/me", label: "Me", icon: User },
];

export default function Navbar() {
  const pathname = usePathname();
  const { isConnected } = useWallet();
  const { theme, toggle } = useTheme();

  return (
    <>
      <nav className="sticky top-0 z-50 bg-secondary-background border-b-2 border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            <Link href="/" className="flex items-center gap-2 no-underline">
              <div className="w-8 h-8 rounded-base bg-main border-2 border-border shadow-shadow flex items-center justify-center">
                <span className="text-main-foreground font-heading text-sm">N</span>
              </div>
              <span className="font-heading text-xl text-foreground">Nadient</span>
            </Link>

            {isConnected && (
              <div className="flex items-center gap-2 md:gap-8">
                <div className="hidden md:flex items-center gap-8">
                  {NAV_LINKS.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`text-sm font-heading transition-colors no-underline ${
                          isActive
                            ? "text-foreground"
                            : "text-foreground/60 hover:text-foreground"
                        }`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
                <Button variant="neutral" size="icon" onClick={toggle} aria-label="Toggle theme">
                  {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </Button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {isConnected && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-secondary-background border-t-2 border-border md:hidden touch-none px-2 pb-safe">
          <div className="flex items-center justify-around h-16">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex flex-col items-center justify-center w-full h-full no-underline transition-colors ${
                    isActive
                      ? "text-foreground"
                      : "text-foreground/40 hover:text-foreground/60"
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1 ${isActive ? "text-main" : ""}`} />
                  <span className="text-[10px] font-heading">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
