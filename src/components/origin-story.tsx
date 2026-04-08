import { Badge } from '@/components/ui/badge'
import { Heart, Layers, Cpu, Database } from 'lucide-react'

const TECH_STACK = [
  { label: 'TanStack Start', sublabel: 'Full-stack framework' },
  { label: 'React 19', sublabel: 'UI layer' },
  { label: 'OpenAI', sublabel: 'AI backend' },
  { label: 'Drizzle ORM', sublabel: 'Type-safe queries' },
  { label: 'Neon PostgreSQL', sublabel: 'Serverless database' },
  { label: 'Better Auth', sublabel: 'Authentication' },
]

export function OriginStory() {
  return (
    <section className="w-full py-16 md:py-24 bg-muted/30">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* Text column */}
          <div className="flex flex-col gap-6">
            <Badge variant="outline" className="w-fit px-4 py-1.5 text-sm font-medium gap-2">
              <Heart className="h-3.5 w-3.5 text-red-500" />
              Built with purpose
            </Badge>

            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              I missed Wunderlist.
              <br />
              <span className="text-primary">So I built something.</span>
            </h2>

            <div className="space-y-4 text-muted-foreground text-base leading-relaxed md:text-lg">
              <p>
                Wunderlist was the best task app ever made. Clean, fast, reliable. Then Microsoft
                acquired it, shut it down in 2020, and pushed everyone to Microsoft To Do. Nothing
                quite filled that gap.
              </p>
              <p>
                So I built Toodyloo as a portfolio project, using modern tools I wanted to master:
                TanStack Start, React 19, Drizzle ORM, and Neon PostgreSQL. The entire app was
                developed with AI assistance, and it shows in every layer of the stack.
              </p>
              <p>
                The result is a task app that feels familiar to Wunderlist fans but runs on a
                cutting-edge tech stack with real AI features baked in from day one.
              </p>
            </div>
          </div>

          {/* Tech stack visual */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border bg-background p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <Layers className="h-5 w-5 text-primary" />
                <span className="font-semibold text-sm">Built with modern tools</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {TECH_STACK.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border bg-muted/40 px-4 py-3 hover:bg-muted/70 transition-colors"
                  >
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.sublabel}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border bg-background p-5 shadow-sm flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-2.5 shrink-0">
                <Cpu className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">Developed with AI</p>
                <p className="text-sm text-muted-foreground">
                  This portfolio app was built alongside AI tools from planning to production. Every
                  component, schema, and server function was crafted with AI assistance.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-background p-5 shadow-sm flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-2.5 shrink-0">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">Open source spirit</p>
                <p className="text-sm text-muted-foreground">
                  The code is real, the stack is production-grade, and the app works. This is not a
                  toy project.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
