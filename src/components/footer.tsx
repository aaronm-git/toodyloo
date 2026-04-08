import { Github, ExternalLink, Linkedin } from 'lucide-react'
import { Link } from '@tanstack/react-router'

export function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
          <Link
            to="/privacy-policy"
            className="hover:text-foreground transition-colors"
          >
            Privacy Policy
          </Link>
          <span className="text-muted-foreground/50">•</span>
          <Link
            to="/terms-of-service"
            className="hover:text-foreground transition-colors"
          >
            Terms of Service
          </Link>
          <span className="text-muted-foreground/50">•</span>
          <a
            href="https://github.com/aaronm-git"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Github className="h-3 w-3" />
            <span>GitHub</span>
          </a>
          <span className="text-muted-foreground/50">•</span>
          <a
            href="https://aaronmolina.me"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <span>Website</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <span className="text-muted-foreground/50">•</span>
          <a
            href="https://linkedin.com/in/aaronmolinag"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Linkedin className="h-3 w-3" />
            <span>LinkedIn</span>
          </a>
        </div>
      </div>
    </footer>
  )
}
