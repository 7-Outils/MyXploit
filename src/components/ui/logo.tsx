"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ className, size = "md", showText = true }: LogoProps) {
  const sizes = {
    sm: { icon: 32, text: "text-lg" },
    md: { icon: 40, text: "text-xl" },
    lg: { icon: 56, text: "text-2xl" },
  };

  const { icon, text } = sizes[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Logo M avec flux énergétique */}
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Fond avec dégradé */}
        <defs>
          <linearGradient id="fluxGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3A7E85" />
            <stop offset="100%" stopColor="#65C2C9" />
          </linearGradient>
          <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#65C2C9" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#65C2C9" stopOpacity="1" />
            <stop offset="100%" stopColor="#65C2C9" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Cercle de fond */}
        <circle cx="24" cy="24" r="22" fill="#12161F" />

        {/* M stylisé */}
        <path
          d="M12 34V16L18.5 28L24 18L29.5 28L36 16V34"
          stroke="url(#fluxGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Flux énergétique - lignes courbes */}
        <path
          d="M14 22C17 20 21 24 24 22C27 20 31 24 34 22"
          stroke="url(#flowGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          className="animate-pulse-slow"
        />
        <path
          d="M14 28C17 26 21 30 24 28C27 26 31 30 34 28"
          stroke="url(#flowGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          className="animate-pulse-slow"
          style={{ animationDelay: "0.5s" }}
        />
      </svg>

      {showText && (
        <span className={cn("font-bold text-primary-dark", text)}>
          My<span className="text-accent">Xploit</span>
        </span>
      )}
    </div>
  );
}
