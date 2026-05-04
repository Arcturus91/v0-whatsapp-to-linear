import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

const CLOUDFORGE_URL = 'https://www.cloud-forge-ai.com/'

export function LandingFooter() {
  return (
    <footer className="animate-in fade-in delay-300 duration-700">
      <div className="border-t border-zinc-800/60 pt-6">
        <div className="flex flex-col items-center justify-center gap-1.5 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Built by
          </p>
          <Link
            href={CLOUDFORGE_URL}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-1.5 text-base font-semibold text-zinc-100 transition-colors hover:text-emerald-400 focus-visible:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 rounded-sm"
            aria-label="Cloudforge — abrir cloud-forge-ai.com en una nueva pestaña"
          >
            Cloudforge
            <ArrowUpRight
              className="size-4 text-zinc-400 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-emerald-400"
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </footer>
  )
}
