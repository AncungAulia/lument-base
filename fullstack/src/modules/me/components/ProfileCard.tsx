"use client";

import { LogOut, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { shortenAddress } from "@/src/provider/WalletContext";

export default function ProfileCard({
  address,
  displayName,
  onEditName,
  onDisconnect,
}: {
  address: string;
  displayName: string | null;
  onEditName: () => void;
  onDisconnect: () => void;
}) {
  return (
    <Card className="mb-6 bg-main/10">
      <CardContent className="pt-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-main border-2 border-border flex items-center justify-center text-main-foreground font-heading text-sm shrink-0">
          {address.slice(2, 4).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <p className="font-heading text-foreground text-lg truncate">
              {displayName ?? "Unnamed"}
            </p>
            <button
              type="button"
              onClick={onEditName}
              className="shrink-0 w-7 text-foreground/80 hover:text-foreground hover:border-foreground/30 transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Edit username"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
          <p className="font-base text-foreground/60 text-sm truncate">
            {shortenAddress(address)}
          </p>
        </div>
        <Button variant="neutral" size="sm" className="gap-1 shrink-0" onClick={onDisconnect}>
          <LogOut className="w-3 h-3" /> Disconnect
        </Button>
      </CardContent>
    </Card>
  );
}
