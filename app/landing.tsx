"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  LayoutDashboard,
  Menu,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
  Zap,
} from "lucide-react";

import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import HeaderDropdownWrapper from "@/components/shared/header/Dropdown/Wrapper/Wrapper";
import ButtonUI from "@/components/ui/shadcn/button";

import HomeHeroBackground from "@/components/app/(home)/sections/hero/Background/Background";
import { BackgroundOuterPiece } from "@/components/app/(home)/sections/hero/Background/BackgroundOuterPiece";
import HomeHeroBadge from "@/components/app/(home)/sections/hero/Badge/Badge";
import HomeHeroPixi from "@/components/app/(home)/sections/hero/Pixi/Pixi";
import HomeHeroTitle from "@/components/app/(home)/sections/hero/Title/Title";
import HeroInput from "@/components/app/(home)/sections/hero-input/HeroInput";
import { Connector } from "@/components/shared/layout/curvy-rect";
import HeroFlame from "@/components/shared/effects/flame/hero-flame";
import FirecrawlIcon from "@/components/FirecrawlIcon";
import FirecrawlLogo from "@/components/FirecrawlLogo";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Workflow", href: "#workflow" },
  { label: "Showcase", href: "#showcase" },
];

const heroHighlights = [
  {
    title: "AI-native builder",
    description: "Prompt, remix, and deploy multi-chain components in minutes.",
    icon: Sparkles,
  },
  {
    title: "Pixel-perfect previews",
    description: "Watch the hero animate with the same spacing as the rest of the page.",
    icon: PlayCircle,
  },
  {
    title: "Secure rails",
    description: "Audited templates and guardrails for production launches.",
    icon: ShieldCheck,
  },
];

const featureCards = [
  {
    title: "Composable sections",
    description: "Drop in hero, stats, forms, and dashboards that stay aligned across breakpoints.",
    icon: LayoutDashboard,
  },
  {
    title: "Realtime co-pilot",
    description: "Inline AI tweaks with animated previews so changes never feel static.",
    icon: Wand2,
  },
  {
    title: "Velocity & safety",
    description: "Pre-baked auth, wallets, and analytics so you ship faster without losing control.",
    icon: Zap,
  },
  {
    title: "Collaboration ready",
    description: "Share links, collect feedback, and branch designs inside the same canvas.",
    icon: ShieldCheck,
  },
];

const workflowSteps = [
  {
    title: "Describe & align",
    description: "Use the hero prompt box or paste a URL. Everything snaps to the shared grid automatically.",
    icon: Sparkles,
  },
  {
    title: "Animate & preview",
    description: "Play with effects, badges, and icons; see them animate side-by-side with the rest of the layout.",
    icon: PlayCircle,
  },
  {
    title: "Launch anywhere",
    description: "Export code or push live with one click. Responsive spacing and sidebar behavior stay intact.",
    icon: ShieldCheck,
  },
];

export default function LandingPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <HeaderProvider>
      <div className="min-h-screen bg-background-base text-accent-black">
        <HeaderDropdownWrapper />

        <div className="sticky top-0 left-0 w-full z-[101] bg-background-base header border-b border-border-faint">
          <div className="absolute top-0 cmw-container border-x border-border-faint h-full pointer-events-none" />
          <div className="h-1 bg-border-faint w-full left-0 -bottom-1 absolute" />

          <div className="cmw-container absolute h-full pointer-events-none top-0">
            <Connector className="absolute -left-[10.5px] -bottom-11" />
            <Connector className="absolute -right-[10.5px] -bottom-11" />
          </div>

          <HeaderWrapper>
            <div className="max-w-[1200px] mx-auto w-full flex items-center justify-between gap-6">
              <Link href="/" className="flex items-center gap-2">
                <FirecrawlIcon className="w-7 h-7 text-accent-black" />
                <FirecrawlLogo />
              </Link>

              <nav className="hidden lg:flex items-center gap-10 text-body-large">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="hover:text-heat-100 transition-colors">
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="flex items-center gap-4">
                <Link
                  href="https://github.com/mendableai/open-lovable"
                  target="_blank"
                  rel="noreferrer"
                  className="hidden lg:block"
                >
                  <ButtonUI variant="primary" size="default">
                    Launch builder
                  </ButtonUI>
                </Link>

                <button
                  type="button"
                  onClick={() => setIsSidebarOpen((prev) => !prev)}
                  aria-expanded={isSidebarOpen}
                  aria-label="Toggle navigation menu"
                  className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-full border border-border-faint hover:bg-black-alpha-4 transition-colors"
                >
                  {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </HeaderWrapper>
        </div>

        <div
          className={`fixed inset-0 z-[1200] lg:hidden transition-opacity duration-300 ${
            isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          aria-hidden={!isSidebarOpen}
        >
          <div className="absolute inset-0 bg-black/45" onClick={() => setIsSidebarOpen(false)} />
          <div
            className={`absolute right-0 top-0 h-full w-[min(80vw,340px)] bg-background-base border-l border-border-faint shadow-2xl transition-transform duration-300 ${
              isSidebarOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-border-faint">
              <Link href="/" className="flex items-center gap-2" onClick={() => setIsSidebarOpen(false)}>
                <FirecrawlIcon className="w-6 h-6 text-accent-black" />
                <FirecrawlLogo />
              </Link>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="w-10 h-10 grid place-items-center rounded-full hover:bg-black-alpha-4 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-4 px-6 py-6 text-body-large">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className="py-3 border-b border-border-faint last:border-b-0"
                >
                  {link.label}
                </Link>
              ))}
                <Link
                  href="https://github.com/mendableai/open-lovable"
                  target="_blank"
                  className="mt-4"
                  rel="noreferrer"
                  onClick={() => setIsSidebarOpen(false)}
                >
                <ButtonUI variant="primary" className="w-full">
                  Launch builder
                </ButtonUI>
              </Link>
            </nav>
          </div>
        </div>

        <section className="overflow-x-clip" id="home-hero">
          <div className="pt-32 lg:pt-44 pb-120 relative" id="hero-content">
            <HomeHeroPixi />
            <HeroFlame />
            <BackgroundOuterPiece />
            <HomeHeroBackground />

            <div className="relative cmw-container px-4 sm:px-10">
              <div className="max-w-[920px] mx-auto text-center flex flex-col gap-10">
                <HomeHeroBadge />
                <HomeHeroTitle />

                <div className="mt-12">
                  <HeroInput />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                  {heroHighlights.map(({ title, description, icon: Icon }) => (
                    <div
                      key={title}
                      className="relative border border-border-faint bg-accent-white shadow-[0_20px_40px_rgba(0,0,0,0.04)] rounded-14 px-6 py-6 text-left overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-heat-8 via-transparent to-black-alpha-3 animate-pulse-subtle" />
                      <div className="relative flex items-start gap-4">
                        <span className="w-11 h-11 rounded-full bg-heat-12 flex items-center justify-center text-heat-100">
                          <Icon className="w-5 h-5" />
                        </span>
                        <div className="space-y-1">
                          <p className="text-label-large">{title}</p>
                          <p className="text-body-large text-black-alpha-72">{description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-28 border-t border-border-faint bg-accent-white">
          <div className="cmw-container px-4 sm:px-10">
            <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
              <div className="lg:w-1/3 space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black-alpha-4 text-label-medium">
                  <div className="w-2 h-2 rounded-full bg-heat-100 animate-ping" />
                  Built for production launches
                </div>
                <h2 className="text-title-h3 leading-tight">
                  Sections, icons, and animations that stay aligned across the whole landing page.
                </h2>
                <p className="text-body-large text-black-alpha-72">
                  Layer hero, feature, and gallery blocks with the same container grid so everything feels cohesive on desktop and mobile.
                </p>
                <div className="flex items-center gap-4">
                  <ButtonUI variant="primary">Start crafting</ButtonUI>
                  <Link href="#workflow" className="text-label-medium hover:text-heat-100 transition-colors">
                    See the flow
                  </Link>
                </div>
              </div>

              <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {featureCards.map(({ title, description, icon: Icon }) => (
                  <div
                    key={title}
                    className="relative h-full border border-border-faint bg-background-base rounded-14 p-6 flex flex-col gap-4 overflow-hidden"
                  >
                    <div className="absolute -right-8 -top-8 w-28 h-28 bg-gradient-to-br from-heat-12 to-black-alpha-2 blur-2xl animate-pulse-subtle" />
                    <div className="relative flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-black-alpha-4 flex items-center justify-center text-heat-100">
                        <Icon className="w-5 h-5" />
                      </div>
                      <p className="text-label-large">{title}</p>
                    </div>
                    <p className="relative text-body-large text-black-alpha-72 leading-relaxed">
                      {description}
                    </p>
                    <div className="relative flex items-center gap-2 text-label-medium text-heat-100">
                      <span className="h-2 w-2 rounded-full bg-heat-100 animate-pulse" />
                      Responsive by default
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-black-alpha-2 via-transparent to-black-alpha-4" />
          <div className="cmw-container px-4 sm:px-10 relative space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-label-medium text-black-alpha-60">Workflow</p>
                <h3 className="text-title-h4 leading-tight">Align hero, sidebar, and every section.</h3>
              </div>
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-border-faint bg-accent-white shadow-sm">
                <div className="w-2 h-2 rounded-full bg-heat-90 animate-ping" />
                <span className="text-label-medium">Real-time preview</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {workflowSteps.map(({ title, description, icon: Icon }, index) => (
                <div
                  key={title}
                  className="relative border border-border-faint rounded-14 bg-accent-white p-6 flex flex-col gap-3"
                >
                  <div className="absolute left-6 -top-6 w-12 h-12 rounded-full bg-heat-16 blur-xl animate-pulse-subtle" />
                  <div className="flex items-center gap-3 relative">
                    <div className="w-10 h-10 rounded-full bg-black-alpha-4 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-heat-100" />
                    </div>
                    <span className="text-label-medium text-black-alpha-72">Step {index + 1}</span>
                  </div>
                  <p className="text-label-large">{title}</p>
                  <p className="text-body-large text-black-alpha-72">{description}</p>
                  <div className="flex items-center gap-2 pt-2">
                    <span className="h-1 w-full rounded-full bg-gradient-to-r from-heat-40 via-heat-90 to-heat-16 animate-pulse-subtle" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="showcase" className="py-28 border-t border-border-faint bg-accent-white">
          <div className="cmw-container px-4 sm:px-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black-alpha-4 text-label-medium">
                  <Sparkles className="w-4 h-4" />
                  Animated gallery
                </div>
                <h3 className="text-title-h3 leading-tight">
                  A hero clone that lines up with every new section, plus a visual showcase.
                </h3>
                <p className="text-body-large text-black-alpha-72">
                  Pair your headline with motion, icons, and imagery. The preview keeps the same container as the feature grid,
                  so layouts feel intentional on any device. The responsive sidebar keeps navigation within thumb reach.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-heat-100" />
                    <span className="text-label-medium">Aligned grid system</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <PlayCircle className="w-5 h-5 text-heat-100" />
                    <span className="text-label-medium">Motion-ready blocks</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-heat-100" />
                    <span className="text-label-medium">Responsive sidebar</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <LayoutDashboard className="w-5 h-5 text-heat-100" />
                    <span className="text-label-medium">Icon-rich sections</span>
                  </div>
                </div>
              </div>

              <div className="relative border border-border-faint rounded-18 bg-gradient-to-br from-heat-8 via-accent-white to-black-alpha-3 overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.12)]">
                <div className="absolute inset-0 bg-gradient-to-tr from-heat-12 via-transparent to-black-alpha-4 animate-pulse-subtle" />
                <div className="absolute -left-14 top-10 w-36 h-36 rounded-full bg-heat-20 blur-3xl animate-pulse" />
                <div className="absolute -right-10 -bottom-16 w-48 h-48 rounded-full bg-black-alpha-8 blur-3xl" />
                <div className="relative p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-heat-90 animate-ping" />
                      <p className="text-label-medium text-black-alpha-72">Live preview</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-black-alpha-24" />
                      <span className="w-2 h-2 rounded-full bg-black-alpha-24" />
                      <span className="w-2 h-2 rounded-full bg-black-alpha-24" />
                    </div>
                  </div>

                  <div className="rounded-14 border border-border-faint bg-white/80 backdrop-blur-sm p-4">
                    <div className="relative rounded-12 bg-gradient-to-br from-heat-16 via-white to-black-alpha-4 p-6 overflow-hidden">
                      <div className="absolute right-6 top-6 px-3 py-2 rounded-full bg-white/80 border border-border-faint text-label-small">
                        Interactive canvas
                      </div>
                      <Image
                        src="/globe.svg"
                        alt="Animated Ender preview"
                        width={720}
                        height={520}
                        className="w-full h-auto object-contain drop-shadow-2xl"
                        priority
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </HeaderProvider>
  );
}
