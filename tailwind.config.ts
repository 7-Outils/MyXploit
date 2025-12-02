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
        // MyExploit Brand Colors
        primary: {
          DEFAULT: "#12161F",
          dark: "#12161F",
          50: "#f0f4f8",
          100: "#d9e2ec",
          200: "#bcccdc",
          300: "#9fb3c8",
          400: "#829ab1",
          500: "#627d98",
          600: "#486581",
          700: "#334e68",
          800: "#243b53",
          900: "#12161F",
        },
        accent: {
          DEFAULT: "#3A7E85",
          light: "#65C2C9",
          50: "#e6f7f8",
          100: "#cceff1",
          200: "#99dfe3",
          300: "#65C2C9",
          400: "#4fa3aa",
          500: "#3A7E85",
          600: "#2e656b",
          700: "#234c50",
          800: "#173336",
          900: "#0c1a1b",
        },
        background: {
          DEFAULT: "#FFFFFF",
          secondary: "#F8FAFB",
        },
        text: {
          DEFAULT: "#12161F",
          primary: "#12161F",
          secondary: "#4A5568",
          muted: "#718096",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
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
      },
      keyframes: {
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
