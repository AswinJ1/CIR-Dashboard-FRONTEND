"use client"

import { useEffect, useState, useMemo } from "react"
import { api } from "@/lib/api"
import { Responsibility, ResponsibilityGroup } from "@/types/cir"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreateResponsibilityDialog } from "@/components/manager/create-responsibility-dialog"
import { ChevronLeft, ChevronRight, FolderOpen } from "lucide-react"
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
import DashboardHeader from "@/components/dashboard-header"

// Color palette for groups and ungrouped responsibilities
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

// A calendar display item - can be a group or an ungrouped responsibility
interface CalendarDisplayItem {
    id: string
    name: string
    color: string
    isGroup: boolean
    responsibilities: Responsibility[]
    isStart: boolean
    isEnd: boolean
}

export default function ManagerResponsibilitiesPage() {
    const [responsibilities, setResponsibilities] = useState<Responsibility[]>([])
    const [responsibilityGroups, setResponsibilityGroups] = useState<ResponsibilityGroup[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedResponsibility, setSelectedResponsibility] = useState<Responsibility | null>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)

    // Group/item modal state - shows all responsibilities for a group or day
    const [selectedGroup, setSelectedGroup] = useState<CalendarDisplayItem | null>(null)
    const [groupModalOpen, setGroupModalOpen] = useState(false)

    // Day modal state - shows all groups/items for a specific day
    const [selectedDayItems, setSelectedDayItems] = useState<CalendarDisplayItem[]>([])
    const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null)
    const [dayModalOpen, setDayModalOpen] = useState(false)

    async function fetchData() {
        try {
            // Helper to handle 404 gracefully for groups API
            const fetchGroupsSafe = async () => {
                try {
                    return await api.responsibilityGroups.getAll()
                } catch (error: any) {
                    // Only return empty array for 404 (endpoint not found)
                    if (error?.status === 404 || error?.response?.status === 404) {
                        return []
                    }
                    // Log and rethrow other errors (auth, network, etc.)
                    console.error("Failed to fetch responsibility groups:", error)
                    throw error
                }
            }

            const [respData, groupsData] = await Promise.all([
                api.responsibilities.getAll(),
                fetchGroupsSafe(),
            ])
            setResponsibilities(respData)
            setResponsibilityGroups(groupsData)
        } catch (error) {
            console.error("Failed to fetch data:", error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
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

    // Build a map of responsibility ID to group info
    const responsibilityToGroup = useMemo(() => {
        const map = new Map<string, { groupId: string; groupName: string }>()
        for (const group of responsibilityGroups) {
            if (!group.items) continue
            for (const item of group.items) {
                map.set(String(item.responsibilityId), {
                    groupId: group.id,
                    groupName: group.name,
                })
            }
        }
        return map
    }, [responsibilityGroups])

    // Map calendar display items (groups and ungrouped responsibilities) to days
    const calendarDisplayMap = useMemo(() => {
        const map = new Map<string, CalendarDisplayItem[]>()
        const processedGroups = new Set<string>()
        let colorIndex = 0

        // First pass: Process groups
        for (const group of responsibilityGroups) {
            if (!group.items || group.items.length === 0) continue

            const groupResps = group.items
                .map(item => responsibilities.find(r => String(r.id) === String(item.responsibilityId)))
                .filter((r): r is Responsibility => r !== undefined)

            if (groupResps.length === 0) continue

            // Find earliest start and latest end date among group responsibilities
            let groupStart: Date | null = null
            let groupEnd: Date | null = null

            for (const resp of groupResps) {
                if (resp.startDate) {
                    const start = parseISO(resp.startDate)
                    if (!groupStart || start < groupStart) groupStart = start
                }
                if (resp.endDate) {
                    const end = parseISO(resp.endDate)
                    if (!groupEnd || end > groupEnd) groupEnd = end
                }
            }

            if (!groupStart || !groupEnd) continue

            const color = COLORS[colorIndex % COLORS.length]
            colorIndex++

            calendarDays.forEach(day => {
                if (isWithinInterval(day, { start: groupStart!, end: groupEnd! })) {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const existing = map.get(dateStr) || []
                    
                    // Only add group once per day
                    if (!existing.some(item => item.id === group.id)) {
                        existing.push({
                            id: group.id,
                            name: group.name,
                            color,
                            isGroup: true,
                            responsibilities: groupResps,
                            isStart: isSameDay(day, groupStart!),
                            isEnd: isSameDay(day, groupEnd!),
                        })
                        map.set(dateStr, existing)
                    }
                }
            })

            // Mark these responsibilities as processed
            for (const resp of groupResps) {
                processedGroups.add(String(resp.id))
            }
        }

        // Second pass: Add ungrouped responsibilities
        responsibilities.forEach(resp => {
            if (processedGroups.has(String(resp.id))) return
            if (!resp.startDate || !resp.endDate) return

            const color = COLORS[colorIndex % COLORS.length]
            colorIndex++
            const start = parseISO(resp.startDate)
            const end = parseISO(resp.endDate)

            calendarDays.forEach(day => {
                if (isWithinInterval(day, { start, end })) {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const existing = map.get(dateStr) || []
                    existing.push({
                        id: `resp-${resp.id}`,
                        name: resp.title,
                        color,
                        isGroup: false,
                        responsibilities: [resp],
                        isStart: isSameDay(day, start),
                        isEnd: isSameDay(day, end),
                    })
                    map.set(dateStr, existing)
                }
            })
        })

        return map
    }, [responsibilities, responsibilityGroups, calendarDays])

    function navigateMonth(direction: 'prev' | 'next') {
        const newMonth = new Date(currentMonth)
        if (direction === 'prev') {
            newMonth.setMonth(newMonth.getMonth() - 1)
        } else {
            newMonth.setMonth(newMonth.getMonth() + 1)
        }
        setCurrentMonth(newMonth)
    }

    function openGroupDetails(item: CalendarDisplayItem) {
        setSelectedGroup(item)
        setGroupModalOpen(true)
    }

    function openDetails(resp: Responsibility) {
        setSelectedResponsibility(resp)
        setDetailsOpen(true)
    }

    function openDayModal(date: Date, items: CalendarDisplayItem[]) {
        setSelectedDayDate(date)
        setSelectedDayItems(items)
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
            {/* <DashboardHeader/> */}
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
                        <CreateResponsibilityDialog onSuccess={fetchData} />
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
                                    const dayItems = calendarDisplayMap.get(dateStr) || []
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

                                            {/* Groups and Responsibilities */}
                                            <div className="mt-1 space-y-1">
                                                {dayItems.slice(0, 3).map((item, idx) => (
                                                    <button
                                                        key={`${item.id}-${idx}`}
                                                        onClick={() => openGroupDetails(item)}
                                                        className={cn(
                                                            "w-full text-left text-xs text-white px-2 py-1 truncate hover:opacity-80 transition-opacity flex items-center gap-1",
                                                            item.color,
                                                            item.isStart && "rounded-l-md",
                                                            item.isEnd && "rounded-r-md",
                                                            !item.isStart && !item.isEnd && "rounded-none",
                                                            item.isStart && item.isEnd && "rounded-md"
                                                        )}
                                                        title={item.isGroup ? `${item.name} (${item.responsibilities.length} items)` : item.name}
                                                    >
                                                        {item.isGroup && <FolderOpen className="h-3 w-3 flex-shrink-0" />}
                                                        <span className="truncate">{item.name}</span>
                                                    </button>
                                                ))}
                                                {dayItems.length > 3 && (
                                                    <button
                                                        className="text-xs text-primary hover:underline font-medium"
                                                        onClick={() => openDayModal(day, dayItems)}
                                                    >
                                                        +{dayItems.length - 3} more
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

            {/* Group/Item Details Modal - Shows responsibilities in a group */}
            <Dialog open={groupModalOpen} onOpenChange={setGroupModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {selectedGroup?.isGroup && <FolderOpen className="h-5 w-5" />}
                            {selectedGroup?.name}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedGroup?.isGroup 
                                ? `${selectedGroup.responsibilities.length} responsibilities in this group`
                                : "Responsibility Details"
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {selectedGroup?.responsibilities.map((resp, idx) => (
                            <button
                                key={`${resp.id}-${idx}`}
                                onClick={() => {
                                    setGroupModalOpen(false)
                                    openDetails(resp)
                                }}
                                className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors text-left"
                            >
                                <div className={cn("w-3 h-3 rounded-full flex-shrink-0", selectedGroup.color)} />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{resp.title}</p>
                                    {resp.startDate && resp.endDate && (
                                        <p className="text-xs text-muted-foreground">
                                            {format(parseISO(resp.startDate), "MMM d")} - {format(parseISO(resp.endDate), "MMM d")}
                                        </p>
                                    )}
                                    {resp.description && (
                                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                            {resp.description}
                                        </p>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

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

            {/* Day Modal - Shows all groups/items for a specific day */}
            <Dialog open={dayModalOpen} onOpenChange={setDayModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedDayDate && format(selectedDayDate, "MMMM d, yyyy")}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedDayItems.length} item{selectedDayItems.length !== 1 ? 's' : ''} on this day
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {selectedDayItems.map((item, idx) => (
                            <button
                                key={`${item.id}-${idx}`}
                                onClick={() => {
                                    setDayModalOpen(false)
                                    openGroupDetails(item)
                                }}
                                className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors text-left"
                            >
                                <div className={cn("w-3 h-3 rounded-full flex-shrink-0", item.color)} />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate flex items-center gap-1">
                                        {item.isGroup && <FolderOpen className="h-3 w-3" />}
                                        {item.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {item.isGroup 
                                            ? `${item.responsibilities.length} responsibilities`
                                            : item.responsibilities[0]?.startDate && item.responsibilities[0]?.endDate
                                                ? `${format(parseISO(item.responsibilities[0].startDate), "MMM d")} - ${format(parseISO(item.responsibilities[0].endDate), "MMM d")}`
                                                : ''
                                        }
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
