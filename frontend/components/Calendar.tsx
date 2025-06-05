'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { Calendar as BigCalendar, momentLocalizer, View, Views } from 'react-big-calendar'
import moment from 'moment'
import { useQuery } from '@tanstack/react-query'
import { Vote } from 'lucide-react'
import { eventsApi } from '@/lib/api'
import { Event } from '@/types'
import ContextMenu from './ContextMenu'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const localizer = momentLocalizer(moment)

interface CalendarEvent {
  id: number
  title: string
  start: Date
  end: Date
  resource: Event
}

interface CalendarProps {
  onSelectEvent?: (event: Event) => void
  onSelectSlot?: (slotInfo: { start: Date; end: Date }) => void
  onCreateVotingEvent?: (slotInfo: { start: Date; end: Date }) => void
  onDeleteEvent?: (event: Event) => void
  onEditEvent?: (event: Event) => void
}

export default function Calendar({ 
  onSelectEvent, 
  onSelectSlot, 
  onCreateVotingEvent, 
  onDeleteEvent, 
  onEditEvent 
}: CalendarProps) {
  const [view, setView] = useState<View>(Views.MONTH)
  const [date, setDate] = useState(new Date())
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    isVisible: boolean
    event?: Event | null
    slotInfo?: { start: Date; end: Date } | null
  }>({
    x: 0,
    y: 0,
    isVisible: false,
    event: null,
    slotInfo: null,
  })

  const { data: events, isLoading, error } = useQuery({
    queryKey: ['events', date, view],
    queryFn: () => {
      const start = moment(date).startOf(view as moment.unitOfTime.StartOf).toISOString()
      const end = moment(date).endOf(view as moment.unitOfTime.StartOf).toISOString()
      return eventsApi.getEvents({ start, end })
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })

  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return (events?.data || [])
      .filter((event: Event) => event.startTime && event.endTime)
      .map((event: Event) => ({
        id: event.id,
        title: event.title,
        start: new Date(event.startTime!),
        end: new Date(event.endTime!),
        resource: event,
      }))
  }, [events?.data])

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    onSelectEvent?.(event.resource)
  }, [onSelectEvent])

  const handleSelectSlot = useCallback((slotInfo: { start: Date; end: Date }) => {
    onSelectSlot?.(slotInfo)
  }, [onSelectSlot])

  const handleRightClick = useCallback((e: React.MouseEvent, slotInfo?: { start: Date; end: Date }, event?: Event) => {
    e.preventDefault()
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      isVisible: true,
      event: event || null,
      slotInfo: slotInfo || null,
    })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isVisible: false }))
  }, [])

  const handleContextAction = useCallback((action: string, data?: any) => {
    switch (action) {
      case 'create':
        onSelectSlot?.(data)
        break
      case 'createVoting':
        onCreateVotingEvent?.(data)
        break
      case 'view':
        onSelectEvent?.(data)
        break
      case 'edit':
        onEditEvent?.(data)
        break
      case 'delete':
        onDeleteEvent?.(data)
        break
    }
  }, [onSelectSlot, onCreateVotingEvent, onSelectEvent, onEditEvent, onDeleteEvent])

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const isVotingEvent = event.resource.eventType === 'voting'
    
    return {
      style: {
        backgroundColor: isVotingEvent ? '#f59e0b' : '#3b82f6',
        borderRadius: '12px',
        opacity: 0.9,
        color: 'white',
        border: 'none',
        display: 'block',
        fontWeight: '600',
        fontSize: '13px',
        padding: '4px 8px',
        boxShadow: isVotingEvent 
          ? '0 4px 12px rgba(245, 158, 11, 0.3)' 
          : '0 4px 12px rgba(59, 130, 246, 0.3)',
        backdropFilter: 'blur(8px)',
        transition: 'all 0.2s ease',
      },
    }
  }, [])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 rounded-2xl">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-primary-200 dark:border-primary-800 rounded-full animate-spin border-t-primary-600 dark:border-t-primary-400"></div>
            <div className="absolute inset-0 w-12 h-12 border-4 border-transparent rounded-full animate-ping border-t-primary-400 opacity-20"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading your calendar...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 rounded-2xl">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-error-500 text-5xl">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Failed to load calendar</h3>
          <p className="text-gray-600 dark:text-gray-400">
            There was an error loading your events. Please try refreshing the page.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn btn-primary"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="h-full"
      onContextMenu={(e) => {
        e.preventDefault()
        
        // Check if right-click is on an event
        const eventElement = (e.target as HTMLElement).closest('[data-event-id]')
        if (eventElement) {
          const eventId = eventElement.getAttribute('data-event-id')
          const event = (events?.data || []).find((evt: Event) => evt.id.toString() === eventId)
          if (event) {
            handleRightClick(e, undefined, event)
            return
          }
        }
        
        // For empty slots, create a reasonable default time
        const now = new Date()
        const nextHour = new Date(now.getTime())
        nextHour.setHours(now.getHours() + 1, 0, 0, 0)
        
        const slotInfo = {
          start: nextHour,
          end: new Date(nextHour.getTime() + 60 * 60 * 1000)
        }
        
        handleRightClick(e, slotInfo)
      }}
    >
      <BigCalendar
        localizer={localizer}
        events={calendarEvents}
        startAccessor="start"
        endAccessor="end"
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        selectable
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        eventPropGetter={eventStyleGetter}
        className="h-full"
        popup
        tooltipAccessor={(event) => 
          `${event.title}${event.resource.eventType === 'voting' ? ' (Voting Event)' : ''}`
        }
        components={{
          event: ({ event }) => (
            <div
              data-event-id={event.resource.id}
              onContextMenu={(e) => {
                e.preventDefault()
                handleRightClick(e, undefined, event.resource)
              }}
              className="cursor-pointer h-full w-full group relative overflow-hidden"
            >
              <div className="flex items-center h-full space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  event.resource.eventType === 'voting' 
                    ? 'bg-yellow-200' 
                    : 'bg-blue-200'
                } opacity-80`} />
                <span className="font-semibold text-white truncate flex-1">
                  {event.title}
                </span>
              </div>
              
              {/* Hover effect overlay */}
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg" />
              
              {/* Voting indicator */}
              {event.resource.eventType === 'voting' && (
                <div className="absolute top-1 right-1">
                  <Vote className="w-3 h-3 text-yellow-200" />
                </div>
              )}
            </div>
          ),
        }}
        onDrillDown={() => {}} // Disable drill down to prevent conflicts
      />
      
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        isVisible={contextMenu.isVisible}
        onClose={closeContextMenu}
        event={contextMenu.event}
        slotInfo={contextMenu.slotInfo}
        onCreateEvent={(slotInfo) => handleContextAction('create', slotInfo)}
        onCreateVotingEvent={(slotInfo) => handleContextAction('createVoting', slotInfo)}
        onViewEvent={(event) => handleContextAction('view', event)}
        onEditEvent={(event) => handleContextAction('edit', event)}
        onDeleteEvent={(event) => handleContextAction('delete', event)}
      />
    </div>
  )
}