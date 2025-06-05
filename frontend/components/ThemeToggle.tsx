'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme, themes } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // useEffect only runs on the client, so now we can safely show the UI
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button className={cn('p-2 rounded-md', className)}>
        <div className="h-5 w-5" />
      </button>
    )
  }

  const cycleTheme = () => {
    const currentIndex = themes.indexOf(theme || 'system')
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <SunIcon className="h-5 w-5" />
      case 'dark':
        return <MoonIcon className="h-5 w-5" />
      default:
        return <ComputerDesktopIcon className="h-5 w-5" />
    }
  }

  const getTitle = () => {
    switch (theme) {
      case 'light':
        return 'Switch to dark mode'
      case 'dark':
        return 'Switch to system theme'
      default:
        return 'Switch to light mode'
    }
  }

  return (
    <button
      onClick={cycleTheme}
      title={getTitle()}
      className={cn(
        'p-2 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100',
        className
      )}
    >
      {getIcon()}
    </button>
  )
}

// Dropdown version for more control
export function ThemeDropdown({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={cn('relative', className)}>
        <button className="p-2 rounded-md">
          <div className="h-5 w-5" />
        </button>
      </div>
    )
  }

  const themes = [
    { value: 'light', label: 'Light', icon: SunIcon },
    { value: 'dark', label: 'Dark', icon: MoonIcon },
    { value: 'system', label: 'System', icon: ComputerDesktopIcon },
  ]

  const currentTheme = themes.find(t => t.value === theme) || themes[2]

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        title="Change theme"
      >
        <currentTheme.icon className="h-5 w-5" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-20">
            <div className="py-1">
              {themes.map((themeOption) => (
                <button
                  key={themeOption.value}
                  onClick={() => {
                    setTheme(themeOption.value)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
                    theme === themeOption.value && 'bg-gray-100 dark:bg-gray-700'
                  )}
                >
                  <themeOption.icon className="h-4 w-4 mr-3" />
                  {themeOption.label}
                  {theme === themeOption.value && (
                    <span className="ml-auto text-blue-600 dark:text-blue-400">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}