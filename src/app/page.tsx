import { Closing } from "@/components/landing/Closing";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { LogoStrip } from "@/components/landing/LogoStrip";
import { Navbar } from "@/components/landing/Navbar";
import { Pricing } from "@/components/landing/Pricing";
import { Security } from "@/components/landing/Security";
import { Testimonials } from "@/components/landing/Testimonials";
import { Together } from "@/components/landing/Together";

// Marketing landing — mirrors Ui/file_000000004318820e859d1821dd8294cf.png.
// Light theme; the authenticated workspace lives under (workspace)/.
export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 antialiased">
      <Navbar />
      <main>
        <Hero />
        <LogoStrip />
        <Features />
        <Together />
        <Security />
        <Testimonials />
        <Pricing />
      </main>
      <Closing />
    </div>
  );
}
