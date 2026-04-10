"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DayStatusBadge } from "@/components/ui/status-badge"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { DayStatus } from "@/types/cir"
import { format } from "date-fns"
import { getToday, isPastDate, isFutureDate, isToday as isTodayDate } from "@/lib/responsibility-status"

interface CalendarDayData {
    date: string
    status: DayStatus
    totalHours: number
    verifiedHours: number
    isLocked: boolean
    hasSubmissions: boolean
}

interface DailyWorkCalendarProps {
    calendarData: CalendarDayData[]
    selectedDate: Date
    onDateSelect: (date: Date) => void
    isLoading?: boolean
}

export function DailyWorkCalendar({
    calendarData,
    selectedDate,
    onDateSelect,
    isLoading = false,
}: DailyWorkCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date())

    const today = getToday()

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear()
        const month = date.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const daysInMonth = lastDay.getDate()
        const startingDayOfWeek = firstDay.getDay()

        const days: (Date | null)[] = []
        
        // Add empty slots for days before the first of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null)
        }

        // Add all days in the month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i))
        }

        return days
    }

    const getDataForDate = (date: Date): CalendarDayData | undefined => {
        const dateStr = format(date, 'yyyy-MM-dd')
        return calendarData.find(d => d.date === dateStr)
    }

    const getDayStatusForCalendar = (date: Date): DayStatus => {
        const data = getDataForDate(date)
        if (data) {
            // Return the status directly from the calendar data
            // The status should already be date-specific from the parent component
            return data.status
        }
        
        // If no data and date is in the past, it's a missed day
        if (isPastDate(date)) {
            return 'NOT_SUBMITTED'
        }
        
        // Future dates have no status
        return 'NOT_SUBMITTED'
    }

    const isDateDisabled = (date: Date): boolean => {
        // Future dates are disabled
        return isFutureDate(date)
    }

    const isDateLocked = (date: Date): boolean => {
        // Past dates are locked
        return isPastDate(date)
    }

    const isSameDay = (date1: Date, date2: Date): boolean => {
        return format(date1, 'yyyy-MM-dd') === format(date2, 'yyyy-MM-dd')
    }

    const days = getDaysInMonth(currentMonth)
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    const goToPreviousMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
    }

    const goToNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
    }

    const goToToday = () => {
        setCurrentMonth(new Date())
        onDateSelect(new Date())
    }

    const getStatusColor = (status: DayStatus): string => {
        switch (status) {
            case 'VERIFIED':
                return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700'
            case 'SUBMITTED':
                return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
            case 'REJECTED':
                return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700'
            case 'PARTIAL':
                return 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700'
            case 'NOT_SUBMITTED':
            default:
                return 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
        }
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <CalendarIcon className="h-5 w-5" />
                            Work Calendar
                        </CardTitle>
                        <CardDescription>
                            View your daily work submission history
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={goToToday}>
                        Today
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-semibold">
                        {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <Button variant="ghost" size="icon" onClick={goToNextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map(day => (
                        <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                    {days.map((date, index) => {
                        if (!date) {
                            return <div key={`empty-${index}`} className="p-2" />
                        }

                        const status = getDayStatusForCalendar(date)
                        const isSelected = isSameDay(date, selectedDate)
                        const isTodayCalendar = isTodayDate(date)
                        const disabled = isDateDisabled(date)
                        const locked = isDateLocked(date)
                        const data = getDataForDate(date)

                        return (
                            <button
                                key={date.toISOString()}
                                onClick={() => !disabled && onDateSelect(date)}
                                disabled={disabled}
                                className={cn(
                                    "p-2 rounded-lg border transition-all text-center min-h-[60px] flex flex-col items-center justify-center gap-1",
                                    getStatusColor(status),
                                    isSelected && "ring-2 ring-primary ring-offset-2",
                                    isTodayCalendar && "",
                                    disabled && "opacity-50 cursor-not-allowed",
                                    !disabled && "hover:opacity-80 cursor-pointer"
                                )}
                            >
                                <span className={cn("text-sm", isTodayCalendar && "underline")}>
                                    {date.getDate()}
                                </span>
                                {data && data.totalHours > 0 && (
                                    <span className="text-xs flex items-center gap-0.5">
                                        <Clock className="h-3 w-3" />
                                        {data.totalHours}h
                                    </span>
                                )}
                                {locked && !data?.hasSubmissions && isPastDate(date) && (
                                    <AlertCircle className="h-3 w-3 text-red-500" />
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700" />
                        <span>Verified</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-4 h-4 rounded bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700" />
                        <span>Submitted</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700" />
                        <span>Rejected</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-4 h-4 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700" />
                        <span>Not Submitted</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
