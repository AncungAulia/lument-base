"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showErrorToast } from "@/src/utils/toast";

export default function EditNameModal({
  currentName,
  displayName,
  onSave,
  onClose,
}: {
  currentName: string;
  displayName: string | null;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [nameInput, setNameInput] = useState(currentName);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(nameInput);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save name";
      showErrorToast("Could not update username", {
        description: message,
        id: `username-error:${message}`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md mx-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            if (!saving) onClose();
          }}
          disabled={saving}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-secondary-background border-2 border-border flex items-center justify-center text-foreground/60 hover:text-foreground transition-all cursor-pointer"
          aria-label="Close username editor"
        >
          <X className="w-4 h-4" />
        </button>
        <Card>
          <CardContent className="pt-6 flex flex-col gap-4">
            <div>
              <p className="font-heading text-lg text-foreground">
                Edit Username
              </p>
              <p className="text-sm text-foreground/60">
                This name is saved per wallet and will appear on the leaderboard
                and in other players&apos; lobbies.
              </p>
            </div>
            <Input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value.slice(0, 24))}
              placeholder="Enter username"
            />
            <div className="flex gap-3">
              <Button
                variant="neutral"
                className="flex-1"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={
                  saving || nameInput.trim() === (displayName ?? "").trim()
                }
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
