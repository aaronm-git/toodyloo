import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const FAQ_ITEMS = [
  {
    id: 'faq-1',
    question: 'Is this a real product or a portfolio project?',
    answer:
      'Both. Toodyloo is a fully working task management app you can use for free, and it is also my portfolio project. I built it to demonstrate modern full-stack development using TanStack Start, React 19, Drizzle ORM, and OpenAI. The code is production-grade and the app is deployed on Netlify.',
  },
  {
    id: 'faq-2',
    question: 'Why did you build this?',
    answer:
      'I was a huge fan of Wunderlist and never found anything that matched it after Microsoft shut it down in 2020. Building my own app felt like the natural move. It gave me the chance to use tools I was excited about and ship something I actually wanted to use.',
  },
  {
    id: 'faq-3',
    question: 'How does the AI work?',
    answer:
      'The AI features connect to OpenAI in the backend. When you use AI to generate a list or create tasks, your prompt goes to the OpenAI API, the response is parsed and validated, and the results are saved to your account automatically. You can describe a goal in plain English and the app turns it into a structured list of tasks.',
  },
  {
    id: 'faq-4',
    question: 'Is it really free?',
    answer:
      'Yes. There is no paid plan, no trial, and no credit card required. Sign up and use the full app including AI features at no cost.',
  },
  {
    id: 'faq-5',
    question: 'What tech stack does it run on?',
    answer:
      'The app is built with TanStack Start (full-stack React framework), React 19, Drizzle ORM, Neon PostgreSQL, Better Auth for authentication, Tailwind CSS v4, and shadcn/ui for components. Server functions use Sentry for observability and the AI layer runs on OpenAI.',
  },
  {
    id: 'faq-6',
    question: 'How is this different from other to-do apps?',
    answer:
      'Most task apps bolt AI on as an afterthought. In Toodyloo, AI is built into the creation flow from the start. You can generate entire lists and tasks from a single sentence. The app also has a fast, optimistic UI that updates instantly before the server responds, which makes everything feel snappy.',
  },
]

export function FaqSection() {
  return (
    <section className="w-full py-16 md:py-24 bg-muted/30">
      <div className="container px-4 md:px-6 mx-auto max-w-3xl">
        <div className="mb-10 text-center space-y-3">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="text-muted-foreground text-lg">
            Answers to the things people actually ask about Toodyloo.
          </p>
        </div>
        <Accordion type="single" collapsible className="space-y-1">
          {FAQ_ITEMS.map((item) => (
            <AccordionItem key={item.id} value={item.id} className="border rounded-lg px-4">
              <AccordionTrigger className="font-semibold hover:no-underline text-left py-4">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
