import { Instrument_Serif, IBM_Plex_Mono } from "next/font/google";

export const editorialDisplay = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-editorial-display",
});

export const editorialMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-editorial-mono",
});
