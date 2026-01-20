"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "default" | "white";
}

export function Logo({ className, size = "md", showText = true, variant = "default" }: LogoProps) {
  const sizes = {
    sm: { width: 100, height: 75 },
    md: { width: 130, height: 98 },
    lg: { width: 160, height: 120 },
    xl: { width: 200, height: 150 },
  };

  const { width, height } = sizes[size];
  const logoSrc = variant === "white" ? "/logo-white.svg" : "/logo.svg";

  // Si on ne veut pas le texte, on montre juste l'icône (version carrée)
  if (!showText) {
    const iconSizes = {
      sm: 32,
      md: 40,
      lg: 56,
      xl: 72,
    };
    const iconSize = iconSizes[size];

    return (
      <div className={cn("relative", className)} style={{ width: iconSize, height: iconSize }}>
        <Image
          src={logoSrc}
          alt="MyXploit"
          fill
          className="object-contain"
          priority
        />
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} style={{ width, height }}>
      <Image
        src={logoSrc}
        alt="MyXploit"
        fill
        className="object-contain"
        priority
      />
    </div>
  );
}
