"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "default" | "white";
}

const iconSizes = {
  sm: 28,
  md: 32,
  lg: 40,
  xl: 48,
};

const fontSizes = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
};

export function Logo({ className, size = "md", showText = true, variant = "default" }: LogoProps) {
  const px = iconSizes[size];
  const textColor = variant === "white" ? "text-white" : "text-gray-900";

  if (!showText) {
    return (
      <Image
        src="/logo.svg"
        alt="MyXploit"
        width={px}
        height={px}
        className={cn("rounded-lg", className)}
      />
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/logo.svg"
        alt="MyXploit"
        width={px}
        height={px}
        className="rounded-lg"
      />
      <span className={cn("font-bold tracking-tight", fontSizes[size], textColor)}>
        My<span className="text-accent">X</span>ploit
      </span>
    </div>
  );
}
