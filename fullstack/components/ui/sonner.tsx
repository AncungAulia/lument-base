"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      style={{ fontFamily: "inherit", overflowWrap: "anywhere" }}
      position={isMobile ? "top-center" : "bottom-right"}
      offset={isMobile ? 16 : 24}
      visibleToasts={4}
      icons={{
        success: null,
        error: null,
        info: null,
        warning: null,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "w-[min(92vw,356px)] rounded-base border-2 border-border shadow-shadow p-4",
          title: "font-heading text-sm",
          description: "font-base text-xs leading-5 opacity-80",
          actionButton:
            "font-base border-2 text-[12px] h-6 px-2 bg-secondary-background text-foreground border-border rounded-base shrink-0",
          cancelButton:
            "font-base border-2 text-[12px] h-6 px-2 bg-secondary-background text-foreground border-border rounded-base shrink-0",
          success: "bg-success text-success-foreground",
          error: "bg-error text-error-foreground",
          warning: "bg-chart-3 text-main-foreground",
          info: "bg-main text-main-foreground",
          loading: "bg-main text-main-foreground",
          icon: "hidden",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
