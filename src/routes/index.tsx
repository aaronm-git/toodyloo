import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  FolderKanban,
  ListTodo,
  Monitor,
  Moon,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useSession } from '../lib/auth-client'
import { useTheme } from '../components/theme-provider'
import { Button } from '../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { Hero203 } from '../components/hero203'
import { OriginStory } from '../components/origin-story'
import { AiPoweredSection } from '../components/ai-powered-section'
import { FaqSection } from '../components/faq-section'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header with Theme Toggle */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4 md:px-6 mx-auto">
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <ListTodo className="h-6 w-6 text-primary" />
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-none">Toodyloo</span>
              <span className="text-xs text-muted-foreground leading-none hidden sm:block">
                AI-Powered Task App
              </span>
            </div>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="mr-2 h-4 w-4" />
                <span>Light</span>
                {theme === 'light' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                <span>Dark</span>
                {theme === 'dark' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="mr-2 h-4 w-4" />
                <span>System</span>
                {theme === 'system' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Video Hero */}
      <Hero203 />

      {/* Origin Story */}
      <OriginStory />

      {/* AI-Powered Features */}
      <AiPoweredSection />

      {/* Core Features Grid */}
      <section className="w-full py-16 md:py-20 bg-muted/30">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center mb-12 space-y-3">
            <Badge variant="outline" className="px-4 py-1.5 text-sm font-medium gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Core features
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              The basics, done exceptionally well
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Wunderlist fans know the value of a clean, reliable task app. Toodyloo delivers the
              same fundamentals with a modern stack underneath.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="border-2 hover:border-primary/50 transition-colors group">
              <CardHeader>
                <div className="mb-3 w-fit rounded-xl bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Priorities that make sense</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Mark tasks as high, medium, or low priority. The app keeps urgent work at the top
                  so you always know what to tackle first.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors group">
              <CardHeader>
                <div className="mb-3 w-fit rounded-xl bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                  <FolderKanban className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Lists for everything</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Create color-coded lists for work, personal projects, side hustles, or anything
                  else. Just like Wunderlist, only with AI baked in.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors group">
              <CardHeader>
                <div className="mb-3 w-fit rounded-xl bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                  <ListTodo className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Subtasks that go deep</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Break any task into subtasks. Whether you add them yourself or let the AI generate
                  them, big projects become manageable quickly.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors group">
              <CardHeader>
                <div className="mb-3 w-fit rounded-xl bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Due dates you won't miss</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Set due dates and recurring schedules. Visual indicators surface what is coming up
                  so nothing slips through.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors group">
              <CardHeader>
                <div className="mb-3 w-fit rounded-xl bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Progress you can see</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Completion rates and activity history show you how much you have shipped. Seeing
                  the streak keeps you going.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors group">
              <CardHeader>
                <div className="mb-3 w-fit rounded-xl bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Instant, optimistic UI</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Every action updates the screen before the server responds. No spinners, no lag.
                  The app feels as fast as a native application.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FaqSection />

      {/* Final CTA */}
      {!session?.user && (
        <section className="w-full py-16 md:py-20 bg-linear-to-br from-primary via-primary to-primary/90 text-primary-foreground">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center space-y-6 text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Ready to try the app I wish existed?
              </h2>
              <p className="mx-auto text-lg md:text-xl text-primary-foreground/90 leading-relaxed">
                Toodyloo is free, fast, and powered by OpenAI. Create your first AI-generated task
                list in under a minute. No credit card, no commitment.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="gap-2 text-base px-8 h-12 bg-background text-foreground hover:bg-background/90"
                >
                  <Link to="/login">
                    Create a Free Account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <p className="text-sm text-primary-foreground/80">
                  Setup takes less than 30 seconds
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-8 pt-6 text-sm text-primary-foreground/80">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>AI Features Included</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Unlimited Tasks</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Free Forever</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
