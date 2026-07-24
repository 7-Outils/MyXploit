import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // MyXploit Brand Colors
        primary: {
          DEFAULT: "#0F1E33",
          dark: "#0F1E33",
          50: "#f0f4f8",
          100: "#d9e2ec",
          200: "#bcccdc",
          300: "#9fb3c8",
          400: "#829ab1",
          500: "#627d98",
          600: "#486581",
          700: "#334e68",
          800: "#243b53",
          900: "#0F1E33",
        },
        accent: {
          DEFAULT: "#2563EB",
          light: "#60A5FA",
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60A5FA",
          500: "#3b82f6",
          600: "#2563EB",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        background: {
          DEFAULT: "#FFFFFF",
          secondary: "#F8FAFB",
        },
        text: {
          DEFAULT: "#0F1E33",
          primary: "#0F1E33",
          secondary: "#4A5568",
          muted: "#718096",
        },
        paper: "#FFFFFF",
        ink: "#0F1E33",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        "soft": "0 2px 8px -2px rgba(18, 22, 31, 0.08)",
        "medium": "0 4px 16px -4px rgba(18, 22, 31, 0.12)",
        "large": "0 8px 32px -8px rgba(18, 22, 31, 0.16)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        draw: "draw 2.2s cubic-bezier(0.4, 0, 0.2, 1) 0.4s forwards",
      },
      keyframes: {
        draw: {
          to: { strokeDashoffset: "0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(-10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
