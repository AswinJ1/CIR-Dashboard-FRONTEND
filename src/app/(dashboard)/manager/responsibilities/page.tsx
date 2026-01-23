"use client"

import { useEffect, useState, useMemo } from "react"
import { api } from "@/lib/api"
import { Responsibility } from "@/types/cir"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreateResponsibilityDialog } from "@/components/manager/create-responsibility-dialog"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    startOfWeek,
    endOfWeek,
    isWithinInterval,
    parseISO
} from "date-fns"
import { cn } from "@/lib/utils"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

// Color palette for responsibilities
const COLORS = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-cyan-500",
    "bg-indigo-500",
    "bg-teal-500",
]

export default function ManagerResponsibilitiesPage() {
    const [responsibilities, setResponsibilities] = useState<Responsibility[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedResponsibility, setSelectedResponsibility] = useState<Responsibility | null>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)

    // Day modal state - shows all responsibilities for a specific day
    const [selectedDayResponsibilities, setSelectedDayResponsibilities] = useState<{ resp: Responsibility; color: string }[]>([])
    const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null)
    const [dayModalOpen, setDayModalOpen] = useState(false)

    async function fetchResponsibilities() {
        try {
            const data = await api.responsibilities.getAll()
            setResponsibilities(data)
        } catch (error) {
            console.error("Failed to fetch responsibilities:", error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchResponsibilities()
    }, [])

    // Generate calendar days for current month (including padding days)
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth)
        const monthEnd = endOfMonth(currentMonth)
        const calendarStart = startOfWeek(monthStart)
        const calendarEnd = endOfWeek(monthEnd)

        return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    }, [currentMonth])

    // Get weeks (array of 7-day arrays)
    const weeks = useMemo(() => {
        const result: Date[][] = []
        for (let i = 0; i < calendarDays.length; i += 7) {
            result.push(calendarDays.slice(i, i + 7))
        }
        return result
    }, [calendarDays])

    // Map responsibilities to days with colors
    const responsibilityMap = useMemo(() => {
        const map = new Map<string, { resp: Responsibility; color: string; isStart: boolean; isEnd: boolean }[]>()

        responsibilities.forEach((resp, index) => {
            if (!resp.startDate || !resp.endDate) return

            const color = COLORS[index % COLORS.length]
            const start = parseISO(resp.startDate)
            const end = parseISO(resp.endDate)

            calendarDays.forEach(day => {
                if (isWithinInterval(day, { start, end })) {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const existing = map.get(dateStr) || []
                    existing.push({
                        resp,
                        color,
                        isStart: isSameDay(day, start),
                        isEnd: isSameDay(day, end)
                    })
                    map.set(dateStr, existing)
                }
            })
        })

        return map
    }, [responsibilities, calendarDays])

    function navigateMonth(direction: 'prev' | 'next') {
        const newMonth = new Date(currentMonth)
        if (direction === 'prev') {
            newMonth.setMonth(newMonth.getMonth() - 1)
        } else {
            newMonth.setMonth(newMonth.getMonth() + 1)
        }
        setCurrentMonth(newMonth)
    }

    function openDetails(resp: Responsibility) {
        setSelectedResponsibility(resp)
        setDetailsOpen(true)
    }

    function openDayModal(date: Date, dayResps: { resp: Responsibility; color: string }[]) {
        setSelectedDayDate(date)
        setSelectedDayResponsibilities(dayResps)
        setDayModalOpen(true)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
                    <p className="text-muted-foreground">
                        View and manage responsibilities on a calendar
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Dashboard / Calendar</span>
                </div>
            </div>

            {/* Calendar Card */}
            <Card>
                <CardContent className="p-0">
                    {/* Calendar Header */}
                    <div className="flex items-center justify-between p-4 border-b">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => navigateMonth('prev')}>
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <h2 className="text-xl font-semibold min-w-[180px] text-center">
                                {format(currentMonth, 'MMMM yyyy')}
                            </h2>
                            <Button variant="ghost" size="icon" onClick={() => navigateMonth('next')}>
                                <ChevronRight className="h-5 w-5" />
                            </Button>
                        </div>
                        <CreateResponsibilityDialog onSuccess={fetchResponsibilities} />
                    </div>

                    {/* Days of Week Header */}
                    <div className="grid grid-cols-7 bg-primary text-primary-foreground">
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                            <div key={day} className="p-3 text-center font-medium text-sm">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="divide-y">
                        {weeks.map((week, weekIndex) => (
                            <div key={weekIndex} className="grid grid-cols-7 divide-x min-h-[120px]">
                                {week.map(day => {
                                    const dateStr = format(day, 'yyyy-MM-dd')
                                    const dayResponsibilities = responsibilityMap.get(dateStr) || []
                                    const isCurrentMonth = isSameMonth(day, currentMonth)

                                    return (
                                        <div
                                            key={dateStr}
                                            className={cn(
                                                "p-2 relative",
                                                !isCurrentMonth && "bg-muted/50"
                                            )}
                                        >
                                            {/* Day Number */}
                                            <span className={cn(
                                                "text-sm font-medium",
                                                !isCurrentMonth && "text-muted-foreground"
                                            )}>
                                                {day.getDate()}
                                            </span>

                                            {/* Responsibilities */}
                                            <div className="mt-1 space-y-1">
                                                {dayResponsibilities.slice(0, 3).map(({ resp, color, isStart, isEnd }, idx) => (
                                                    <button
                                                        key={`${resp.id}-${idx}`}
                                                        onClick={() => openDetails(resp)}
                                                        className={cn(
                                                            "w-full text-left text-xs text-white px-2 py-1 truncate hover:opacity-80 transition-opacity",
                                                            color,
                                                            isStart && "rounded-l-md",
                                                            isEnd && "rounded-r-md",
                                                            !isStart && !isEnd && "rounded-none",
                                                            isStart && isEnd && "rounded-md"
                                                        )}
                                                        title={resp.title}
                                                    >
                                                        {resp.title}
                                                    </button>
                                                ))}
                                                {dayResponsibilities.length > 3 && (
                                                    <button
                                                        className="text-xs text-primary hover:underline font-medium"
                                                        onClick={() => openDayModal(day, dayResponsibilities.map(d => ({ resp: d.resp, color: d.color })))}
                                                    >
                                                        +{dayResponsibilities.length - 3} more
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Responsibility Details Dialog */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedResponsibility?.title}</DialogTitle>
                        <DialogDescription>
                            Responsibility Details
                        </DialogDescription>
                    </DialogHeader>

                    {selectedResponsibility && (
                        <div className="space-y-4">
                            {selectedResponsibility.description && (
                                <div>
                                    <p className="text-sm font-medium mb-1">Description</p>
                                    <p className="text-sm text-muted-foreground">
                                        {selectedResponsibility.description}
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-4">
                                {selectedResponsibility.cycle && (
                                    <div>
                                        <p className="text-sm font-medium mb-1">Cycle</p>
                                        <Badge variant="outline">{selectedResponsibility.cycle}</Badge>
                                    </div>
                                )}

                                {selectedResponsibility.startDate && selectedResponsibility.endDate && (
                                    <div>
                                        <p className="text-sm font-medium mb-1">Date Range</p>
                                        <p className="text-sm text-muted-foreground">
                                            {format(parseISO(selectedResponsibility.startDate), "MMM d")} - {format(parseISO(selectedResponsibility.endDate), "MMM d, yyyy")}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Day Responsibilities Modal - Shows all for a specific day */}
            <Dialog open={dayModalOpen} onOpenChange={setDayModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedDayDate && format(selectedDayDate, "MMMM d, yyyy")}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedDayResponsibilities.length} responsibilities on this day
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {selectedDayResponsibilities.map(({ resp, color }, idx) => (
                            <button
                                key={`${resp.id}-${idx}`}
                                onClick={() => {
                                    setDayModalOpen(false)
                                    openDetails(resp)
                                }}
                                className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors text-left"
                            >
                                <div className={cn("w-3 h-3 rounded-full flex-shrink-0", color)} />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{resp.title}</p>
                                    {resp.startDate && resp.endDate && (
                                        <p className="text-xs text-muted-foreground">
                                            {format(parseISO(resp.startDate), "MMM d")} - {format(parseISO(resp.endDate), "MMM d")}
                                        </p>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
