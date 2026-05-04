import { LandingFeatures } from '@/components/landing/landing-features'
import { LandingHero } from '@/components/landing/landing-hero'
import { LandingQrCard } from '@/components/landing/landing-qr-card'

export const metadata = {
  title: 'LinearVoice',
  description: 'WhatsApp to Linear AI agent with voice support',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_45%)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-14 sm:py-20">
        <LandingHero />
        <LandingQrCard />
        <LandingFeatures />
      </div>
    </main>
  )
}
