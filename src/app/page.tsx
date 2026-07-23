import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import {
  Hero,
  Features,
  Modules,
  Stats,
  Pricing,
  CTA,
} from "@/components/landing";
import { fraunces, plexMono } from "@/components/landing/fonts";

export default function Home() {
  return (
    <div className={`${fraunces.variable} ${plexMono.variable} bg-paper`}>
      <Header />
      <main>
        <Hero />
        <Features />
        <Modules />
        <Stats />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
