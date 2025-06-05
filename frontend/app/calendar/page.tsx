'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Calendar from '@/components/Calendar'
import CreateEventModal from '@/components/CreateEventModal'
import EventDetailsModal from '@/components/EventDetailsModal'
import EditEventModal from '@/components/EditEventModal'
import ThemeToggle from '@/components/ThemeToggle'
import { useAuthStore } from '@/lib/auth'
import { eventsApi } from '@/lib/api'
import { Event } from '@/types'

export default function CalendarPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, logout } = useAuthStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [newEventSlot, setNewEventSlot] = useState<{ start: Date; end: Date } | null>(null)
  const [isVotingEvent, setIsVotingEvent] = useState(false)

  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) => eventsApi.deleteEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
    onError: (error: any) => {
      console.error('Delete error:', error)
      alert(error.response?.data?.error || 'Failed to delete event')
    },
  })

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    setNewEventSlot(slotInfo)
    setIsVotingEvent(false)
    setShowCreateModal(true)
  }

  const handleCreateVotingEvent = (slotInfo: { start: Date; end: Date }) => {
    setNewEventSlot(slotInfo)
    setIsVotingEvent(true)
    setShowCreateModal(true)
  }

  const handleCreateEvent = () => {
    setNewEventSlot(null)
    setIsVotingEvent(false)
    setShowCreateModal(true)
  }

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    setNewEventSlot(null)
    setIsVotingEvent(false)
  }

  const handleDeleteEvent = (event: Event) => {
    if (confirm(`Are you sure you want to delete "${event.title}"?`)) {
      deleteEventMutation.mutate(event.id.toString())
    }
  }

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event)
    setSelectedEvent(null) // Close details modal if open
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">VibeCal</h1>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Calendar</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={handleCreateEvent}
                className="btn btn-primary flex items-center"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                New Event
              </button>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {user?.firstName || user?.username}
                </span>
                <ThemeToggle />
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  title="Sign out"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="h-full card p-6">
          <Calendar
            onSelectEvent={setSelectedEvent}
            onSelectSlot={handleSelectSlot}
            onCreateVotingEvent={handleCreateVotingEvent}
            onDeleteEvent={handleDeleteEvent}
            onEditEvent={handleEditEvent}
          />
        </div>
      </main>

      {/* Modals */}
      {showCreateModal && (
        <CreateEventModal
          isOpen={showCreateModal}
          onClose={handleCloseCreateModal}
          defaultSlot={newEventSlot}
          forceVotingEvent={isVotingEvent}
        />
      )}

      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          isOpen={!!editingEvent}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  )
}