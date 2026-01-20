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
    sm: { width: 28, height: 28 },
    md: { width: 36, height: 36 },
    lg: { width: 48, height: 48 },
    xl: { width: 64, height: 64 },
  };

  const { width, height } = sizes[size];
  const logoSrc = variant === "white" ? "/logo-white.svg" : "/logo.svg";

  // Si on ne veut pas le texte, on montre juste l'icône (version carrée)
  if (!showText) {
    const iconSizes = {
      sm: 24,
      md: 32,
      lg: 40,
      xl: 56,
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
