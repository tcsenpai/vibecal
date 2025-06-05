'use client'

import { useState, useEffect, useRef } from 'react'
import { PlusIcon, TrashIcon, EyeIcon, PencilIcon } from '@heroicons/react/24/outline'
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
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isVisible, onClose])

  if (!isVisible) return null

  const handleAction = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 min-w-48"
      style={{
        left: x,
        top: y,
        transform: 'translateX(-50%)',
      }}
    >
      {event ? (
        // Context menu for existing events
        <>
          <button
            onClick={() => handleAction(() => onViewEvent?.(event))}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
          >
            <EyeIcon className="h-4 w-4 mr-3" />
            View Event
          </button>
          
          {/* Only show edit/delete for events the user can modify */}
          <button
            onClick={() => handleAction(() => onEditEvent?.(event))}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
          >
            <PencilIcon className="h-4 w-4 mr-3" />
            Edit Event
          </button>
          
          <hr className="my-1 border-gray-200" />
          
          <button
            onClick={() => handleAction(() => onDeleteEvent?.(event))}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
          >
            <TrashIcon className="h-4 w-4 mr-3" />
            Delete Event
          </button>
        </>
      ) : slotInfo ? (
        // Context menu for empty time slots
        <>
          <button
            onClick={() => handleAction(() => onCreateEvent?.(slotInfo))}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
          >
            <PlusIcon className="h-4 w-4 mr-3" />
            Create Event
          </button>
          
          <button
            onClick={() => handleAction(() => onCreateVotingEvent?.(slotInfo))}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
          >
            🗳️
            <span className="ml-2">Create Voting Event</span>
          </button>
        </>
      ) : null}
    </div>
  )
}