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
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Modern Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-700/60 shadow-soft">
        <div className="px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-glow">
                  <span className="text-white font-bold text-lg">V</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gradient">VibeCal</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Your intelligent calendar</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={handleCreateEvent}
                className="btn btn-primary flex items-center space-x-2 shadow-primary-500/25 hover:shadow-primary-500/40"
              >
                <PlusIcon className="h-5 w-5" />
                <span className="hidden sm:inline">Create Event</span>
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user?.firstName || user?.username}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user?.email}
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <ThemeToggle />
                  <button
                    onClick={handleLogout}
                    className="btn btn-ghost btn-icon"
                    title="Sign out"
                  >
                    <ArrowRightOnRectangleIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Enhanced Main Content */}
      <main className="flex-1 p-6 lg:p-8 overflow-hidden">
        <div className="h-full card-glass p-8 shadow-soft-lg">
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