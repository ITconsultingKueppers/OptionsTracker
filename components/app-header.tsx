'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LayoutDashboard, List, TrendingUp, RefreshCw, Plus, LogOut } from 'lucide-react'

interface AppHeaderProps {
  onNewPosition?: () => void
}

const navItems = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'Positions',
    href: '/positions',
    icon: List,
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: TrendingUp,
  },
  {
    label: 'Cycles',
    href: '/cycles',
    icon: RefreshCw,
  },
]

export function AppHeader({ onNewPosition }: AppHeaderProps) {
  const pathname = usePathname()

  const handleNewPositionClick = () => {
    if (onNewPosition) {
      onNewPosition()
    } else {
      // Default: scroll to form on dashboard
      document.getElementById('new-position-form')?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-2 mr-8">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">WT</span>
            </div>
            <h1 className="text-xl font-semibold text-foreground hidden sm:block">WheelTracker</h1>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-4">
            <Button
              onClick={handleNewPositionClick}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">New Position</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <LogOut className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
