import Link from 'next/link'
import { MessageCircle, LayoutDashboard } from 'lucide-react'

import { Button } from '@/components/ui/button'

const PHONE_E164 = '12015101749'
const PHONE_DISPLAY = '+1 (201) 510-1749'
const WHATSAPP_URL = `https://wa.me/${PHONE_E164}?text=${encodeURIComponent('hola')}`
const QR_SRC = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(WHATSAPP_URL)}&bgcolor=ffffff&color=0a0a0a&margin=0&qzone=2`

export function LandingQrCard() {
  return (
    <section className="animate-in fade-in zoom-in-95 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl duration-700 sm:p-8">
      <div className="grid gap-8 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="mx-auto rounded-xl bg-white p-3 shadow-lg sm:mx-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={QR_SRC}
            alt={`QR para iniciar el chat con LinearVoice en ${PHONE_DISPLAY}`}
            width={220}
            height={220}
            className="size-[220px] rounded-md"
            loading="eager"
          />
        </div>

        <div className="text-center sm:text-left">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
            Probalo ahora
          </p>
          <p className="mt-2 text-base text-zinc-300">
            Escaneá el QR o escribí al número:
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
            {PHONE_DISPLAY}
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            Mandá <span className="font-mono text-zinc-300">hola</span> o pedí{' '}
            <span className="font-mono text-zinc-300">crea un issue</span> para arrancar.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              className="w-full bg-emerald-500 font-medium text-emerald-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 sm:flex-1"
              size="lg"
            >
              <Link href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 size-4" aria-hidden="true" />
                Abrir WhatsApp
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="w-full border-zinc-700 bg-zinc-950 text-zinc-100 hover:bg-zinc-800 sm:flex-1"
              size="lg"
            >
              <Link href="/dashboard">
                <LayoutDashboard className="mr-2 size-4" aria-hidden="true" />
                Ver dashboard
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
