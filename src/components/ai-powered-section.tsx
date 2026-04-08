import { Sparkles, ListPlus, BrainCircuit, Wand2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const AI_FEATURES = [
  {
    icon: ListPlus,
    title: 'Generate entire lists in seconds',
    description:
      'Tell the AI what you want to accomplish and it builds a complete, structured list for you. Planning a trip? Launching a project? Just describe it.',
  },
  {
    icon: BrainCircuit,
    title: 'Create tasks from a single prompt',
    description:
      'Type a goal in plain English and Toodyloo generates individual tasks with priorities, due dates, and subtasks already filled in.',
  },
  {
    icon: Wand2,
    title: 'Break big goals into steps',
    description:
      'The AI reads your task and suggests logical subtasks automatically. Go from "launch a website" to a 12-step action plan in one click.',
  },
]

export function AiPoweredSection() {
  return (
    <section className="w-full py-16 md:py-24">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="text-center mb-12 space-y-4">
          <Badge
            variant="secondary"
            className="px-4 py-1.5 text-sm font-medium gap-2"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Powered by OpenAI
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Your to-do list thinks for you
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Toodyloo connects to OpenAI in the backend so you can stop staring at a blank list.
            Describe what you need and the AI takes it from there.
          </p>
        </div>

        {/* Three feature cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-12">
          {AI_FEATURES.map((feature) => (
            <Card
              key={feature.title}
              className="border-2 hover:border-primary/50 transition-colors group"
            >
              <CardHeader>
                <div className="mb-3 w-fit rounded-xl bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Inline code-style callout */}
        <div className="rounded-2xl border bg-muted/40 p-6 md:p-8 max-w-3xl mx-auto text-center">
          <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium mb-3">
            How it works under the hood
          </p>
          <p className="text-base md:text-lg text-foreground leading-relaxed">
            When you use the AI features, your prompt is sent to{' '}
            <span className="font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded text-sm">
              gpt-4o-mini
            </span>{' '}
            via the OpenAI API. The response is parsed, validated with Zod, and saved directly to
            your account. Fast, structured, and type-safe from end to end.
          </p>
        </div>
      </div>
    </section>
  )
}
