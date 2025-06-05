'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Eye, Edit3, Vote } from 'lucide-react'
import { Event } from '@/types'

interface ContextMenuProps {
  x: number
  y: number
  isVisible: boolean
  onClose: () => void
  event?: Event | null
  onCreateEvent?: (slotInfo: { start: Date; end: Date }) => void
  onCreateVotingEvent?: (slotInfo: { start: Date; end: Date }) => void
  onDeleteEvent?: (event: Event) => void
  onEditEvent?: (event: Event) => void
  onViewEvent?: (event: Event) => void
  slotInfo?: { start: Date; end: Date } | null
}

export default function ContextMenu({
  x,
  y,
  isVisible,
  onClose,
  event,
  onCreateEvent,
  onCreateVotingEvent,
  onDeleteEvent,
  onEditEvent,
  onViewEvent,
  slotInfo,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (isVisible) {
      // Set position immediately - no requestAnimationFrame delay
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      // Estimated menu dimensions (will adjust after render if needed)
      const estimatedWidth = 200
      const estimatedHeight = 120
      
      let newX = x + 4 // Small offset from cursor
      let newY = y + 4
      
      // Adjust if menu would go off right edge
      if (newX + estimatedWidth > viewportWidth - 10) {
        newX = x - estimatedWidth - 4
      }
      
      // Adjust if menu would go off bottom edge
      if (newY + estimatedHeight > viewportHeight - 10) {
        newY = y - estimatedHeight - 4
      }
      
      // Ensure menu stays within viewport
      newX = Math.max(10, Math.min(newX, viewportWidth - estimatedWidth - 10))
      newY = Math.max(10, Math.min(newY, viewportHeight - estimatedHeight - 10))
      
      setPosition({ x: newX, y: newY })
    }
  }, [x, y, isVisible])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
      // Prevent scrolling when menu is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isVisible, onClose])

  if (!isVisible) return null

  const handleAction = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      
      {/* Context Menu */}
      <div
        ref={menuRef}
        className="fixed z-50 min-w-48 animate-context-menu-in"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:bg-gray-900/95 dark:border-gray-700/50 p-2 min-w-[200px]">
          {event ? (
            // Context menu for existing events
            <div className="space-y-1">
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                  {event.title}
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {event.eventType === 'voting' ? 'Voting Event' : 'Regular Event'}
                </span>
              </div>
              
              <button
                onClick={() => handleAction(() => onViewEvent?.(event))}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-xl flex items-center transition-all duration-200 group"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/50 mr-3 group-hover:bg-primary-200 dark:group-hover:bg-primary-800/50 transition-colors">
                  <Eye className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                </div>
                <span>View Details</span>
              </button>
              
              <button
                onClick={() => handleAction(() => onEditEvent?.(event))}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-secondary-50 dark:hover:bg-secondary-900/30 rounded-xl flex items-center transition-all duration-200 group"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary-100 dark:bg-secondary-900/50 mr-3 group-hover:bg-secondary-200 dark:group-hover:bg-secondary-800/50 transition-colors">
                  <Edit3 className="h-4 w-4 text-secondary-600 dark:text-secondary-400" />
                </div>
                <span>Edit Event</span>
              </button>
              
              <div className="my-2 border-t border-gray-100 dark:border-gray-800" />
              
              <button
                onClick={() => handleAction(() => onDeleteEvent?.(event))}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-error-700 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/30 rounded-xl flex items-center transition-all duration-200 group"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-error-100 dark:bg-error-900/50 mr-3 group-hover:bg-error-200 dark:group-hover:bg-error-800/50 transition-colors">
                  <Trash2 className="h-4 w-4 text-error-600 dark:text-error-400" />
                </div>
                <span>Delete Event</span>
              </button>
            </div>
          ) : slotInfo ? (
            // Context menu for empty time slots
            <div className="space-y-1">
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  Create New Event
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(slotInfo.start).toLocaleDateString()} at {new Date(slotInfo.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              <button
                onClick={() => handleAction(() => onCreateEvent?.(slotInfo))}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-xl flex items-center transition-all duration-200 group"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/50 mr-3 group-hover:bg-primary-200 dark:group-hover:bg-primary-800/50 transition-colors">
                  <Plus className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                </div>
                <span>Regular Event</span>
              </button>
              
              <button
                onClick={() => handleAction(() => onCreateVotingEvent?.(slotInfo))}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-accent-50 dark:hover:bg-accent-900/30 rounded-xl flex items-center transition-all duration-200 group"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent-100 dark:bg-accent-900/50 mr-3 group-hover:bg-accent-200 dark:group-hover:bg-accent-800/50 transition-colors">
                  <Vote className="h-4 w-4 text-accent-600 dark:text-accent-400" />
                </div>
                <span>Voting Event</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}