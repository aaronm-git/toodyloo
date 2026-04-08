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
                AI Driven To-Do App
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

      {/* Video Hero Section */}
      <Hero203 />

      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-40 bg-linear-to-b from-background via-background to-muted/50">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center space-y-8 text-center">
            <div className="space-y-6">
              <Badge
                variant="secondary"
                className="mb-4 px-4 py-1.5 text-sm font-medium"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Powered by AI • The Future of Task Management
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl/none">
                Your AI Assistant
                <br />
                <span className="text-primary">for Getting Things Done.</span>
              </h1>
              <p className="mx-auto max-w-[800px] text-lg text-muted-foreground md:text-xl lg:text-2xl leading-relaxed">
                <strong className="text-foreground">Toodyloo</strong> uses
                advanced AI to understand your goals, suggest tasks, prioritize
                what matters, and help you accomplish more. Just tell it what
                you need—in plain English—and watch it work.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
              {session?.user ? (
                <>
                  <Button asChild size="lg" className="gap-2 text-base px-8">
                    <Link to="/dashboard">
                      Open Dashboard
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <p className="text-sm text-muted-foreground sm:ml-4">
                    Welcome back, {session.user.name || session.user.email}! 👋
                  </p>
                </>
              ) : (
                <>
                  <Button
                    asChild
                    size="lg"
                    className="gap-2 text-base px-8 h-12"
                  >
                    <Link to="/login">
                      Start Free Today
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <p className="text-sm text-muted-foreground sm:ml-4">
                    No credit card required • Setup in 30 seconds
                  </p>
                </>
              )}
            </div>

            {/* Trust Indicators */}
            {!session?.user && (
              <div className="flex flex-wrap items-center justify-center gap-6 pt-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Free Forever</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>No Credit Card</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Privacy First</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-16 md:py-20">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-3">
              Everything You Need to Succeed
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Powerful features designed to help you accomplish more, stress
              less, and stay organized effortlessly.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="mb-3 text-primary">
                  <Target className="h-10 w-10" />
                </div>
                <CardTitle className="text-xl mb-2">
                  Focus on What Matters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Smart priority management helps you tackle critical tasks
                  first. Never waste time on low-value work again.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="mb-3 text-primary">
                  <FolderKanban className="h-10 w-10" />
                </div>
                <CardTitle className="text-xl mb-2">
                  Organize Your Life
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Custom lists and color-coded tags let you organize tasks your
                  way. Find anything instantly, no matter how complex your
                  workflow.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="mb-3 text-primary">
                  <ListTodo className="h-10 w-10" />
                </div>
                <CardTitle className="text-xl mb-2">
                  Break Down Big Goals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Turn overwhelming projects into manageable steps. Create
                  subtasks and nested hierarchies to track progress on complex
                  initiatives.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="mb-3 text-primary">
                  <Calendar className="h-10 w-10" />
                </div>
                <CardTitle className="text-xl mb-2">
                  Never Miss a Deadline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Visual reminders and smart due date tracking ensure you're
                  always on top of what's coming up. Stay ahead, never behind.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="mb-3 text-primary">
                  <TrendingUp className="h-10 w-10" />
                </div>
                <CardTitle className="text-xl mb-2">
                  See Your Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Real-time statistics and completion rates show you exactly how
                  productive you've been. Celebrate wins and stay motivated.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="mb-3 text-primary">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <CardTitle className="text-xl mb-2">Lightning Fast</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Instant updates and seamless syncing mean you spend less time
                  waiting and more time doing. Optimistic UI keeps you moving
                  forward.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!session?.user && (
        <section className="w-full py-16 md:py-20 bg-linear-to-br from-primary via-primary to-primary/90 text-primary-foreground">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center space-y-6 text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Ready to Experience AI-Powered Productivity?
              </h2>
              <p className="mx-auto text-lg md:text-xl text-primary-foreground/90 leading-relaxed">
                Join thousands who've already discovered how AI can transform
                their task management. Start your free account today—no credit
                card required, no commitment, just intelligent assistance.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="gap-2 text-base px-8 h-12 bg-background text-foreground hover:bg-background/90"
                >
                  <Link to="/login">
                    Start Free Today
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
                  <span>Cancel Anytime</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
