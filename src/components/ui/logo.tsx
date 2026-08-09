"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "default" | "white";
}

export function Logo({ className, size = "md", showText = true, variant = "default" }: LogoProps) {
  const fontSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
    xl: "text-3xl",
  };

  const textColor = variant === "white" ? "text-white" : "text-ink";
  const accentColor = "text-accent";

  if (!showText) {
    const iconSizes = {
      sm: "text-lg",
      md: "text-xl",
      lg: "text-2xl",
      xl: "text-3xl",
    };

    return (
      <span className={cn("font-bold", iconSizes[size], textColor, className)}>
        M<span className={accentColor}>X</span>
      </span>
    );
  }

  return (
    <span className={cn("font-bold tracking-tight", fontSizes[size], textColor, className)}>
      My<span className={accentColor}>X</span>ploit
    </span>
  );
}
