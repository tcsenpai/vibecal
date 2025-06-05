'use client'

import { useState, useCallback, useRef } from 'react'
import { Calendar as BigCalendar, momentLocalizer, View, Views } from 'react-big-calendar'
import moment from 'moment'
import { useQuery } from '@tanstack/react-query'
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

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', date, view],
    queryFn: () => {
      const start = moment(date).startOf(view as moment.unitOfTime.StartOf).toISOString()
      const end = moment(date).endOf(view as moment.unitOfTime.StartOf).toISOString()
      return eventsApi.getEvents({ start, end })
    },
  })

  const calendarEvents: CalendarEvent[] = (events?.data || [])
    .filter((event: Event) => event.startTime && event.endTime)
    .map((event: Event) => ({
      id: event.id,
      title: event.title,
      start: new Date(event.startTime!),
      end: new Date(event.endTime!),
      resource: event,
    }))

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

  const eventStyleGetter = (event: CalendarEvent) => {
    const isVotingEvent = event.resource.eventType === 'voting'
    
    return {
      style: {
        backgroundColor: isVotingEvent ? '#f59e0b' : '#3b82f6',
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
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
        
        // Handle right-click on empty calendar areas
        const now = new Date()
        const slotInfo = {
          start: new Date(now.getTime() + 60 * 60 * 1000), // Next hour
          end: new Date(now.getTime() + 2 * 60 * 60 * 1000) // +2 hours
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
              className="cursor-pointer h-full w-full"
            >
              {event.title}
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