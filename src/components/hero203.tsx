import { ArrowRight, CheckCircle2, Heart } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { useSession } from '@/lib/auth-client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const HERO_VIDEO_SRC = 'https://wwdgqcc94q.ufs.sh/f/ivcA5za78HmCHPblHlTAScCm6XQhFftODxPk574jzag2uyKR'

const Hero203 = () => {
  const { data: session } = useSession()

  return (
    <section className="relative overflow-hidden bg-background py-12 md:py-20 lg:py-28">
      <div className="container mx-auto grid gap-10 px-4 md:px-6 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <Badge variant="secondary" className="w-fit px-4 py-1.5 text-sm font-medium gap-2">
              <Heart className="h-3.5 w-3.5 text-red-500" />
              A love letter to Wunderlist
            </Badge>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Miss Wunderlist?
              <br />
              <span className="text-primary">Me too. So I built this.</span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Toodyloo is a fast, focused task app built because the best to-do app ever made is
              gone. It is my portfolio project, crafted with AI, powered by OpenAI, and built on a
              modern full-stack setup.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {session?.user ? (
              <Button asChild size="lg" className="gap-2">
                <Link to="/dashboard">
                  Open Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="gap-2">
                <Link to="/login">
                  Try It Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}

            {!session?.user && (
              <p className="text-sm text-muted-foreground">No credit card. Setup in 30 seconds.</p>
            )}
          </div>

          {!session?.user && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Free forever</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>AI included</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Privacy-first</span>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <div className="absolute -inset-8 -z-10 bg-radial from-primary/20 via-transparent to-transparent blur-2xl" />

          <div className="relative overflow-hidden rounded-3xl border bg-muted/30 shadow-sm">
            <div className="absolute inset-0 bg-linear-to-t from-background/70 via-background/10 to-transparent" />
            <video
              className="w-full object-cover aspect-square"
              src={HERO_VIDEO_SRC}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-sm text-foreground backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Built with modern tools
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export { Hero203 }
