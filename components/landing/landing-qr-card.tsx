import Link from 'next/link'

import { Button } from '@/components/ui/button'

const PLACEHOLDER_PHONE = '0000000000'
const WHATSAPP_LINK = `https://wa.me/${PLACEHOLDER_PHONE}`

export function LandingQrCard() {
  return (
    <section className="animate-in fade-in zoom-in-95 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl duration-700">
      <div className="mx-auto mb-5 grid w-full max-w-56 place-items-center rounded-xl border border-zinc-700 bg-zinc-950 p-4">
        <div className="grid grid-cols-9 gap-1 rounded-md bg-white p-3">
          {Array.from({ length: 81 }).map((_, index) => {
            const filled =
              index % 2 === 0 ||
              index < 9 ||
              index > 71 ||
              index % 9 === 0 ||
              index % 9 === 8 ||
              (index >= 20 && index <= 24) ||
              (index >= 56 && index <= 60)

            return (
              <span
                key={index}
                className={filled ? 'size-1.5 bg-zinc-900' : 'size-1.5 bg-white'}
                aria-hidden="true"
              />
            )
          })}
        </div>
      </div>

      <p className="text-center text-sm text-zinc-300">
        Escanea para iniciar el demo o escribe al numero placeholder:
      </p>
      <p className="mt-1 text-center text-base font-semibold tracking-wide text-zinc-100">
        +{PLACEHOLDER_PHONE}
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          asChild
          className="w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400 sm:flex-1"
          size="lg"
        >
          <Link href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
            Manda un mensaje al numero
          </Link>
        </Button>

        <Button asChild variant="outline" className="w-full border-zinc-700 bg-zinc-950 text-zinc-100 hover:bg-zinc-800 sm:flex-1">
          <Link href="/dashboard">Ver dashboard</Link>
        </Button>
      </div>
    </section>
  )
}
