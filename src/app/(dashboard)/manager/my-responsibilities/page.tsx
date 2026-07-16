"use client"

import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@/components/providers/auth-context"
import { api } from "@/lib/api"
import { Responsibility, WorkSubmission, Assignment } from "@/types/cir"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, RefreshCw, Clock, Calendar } from "lucide-react"
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
    parseISO,
    isToday as isDateToday,
    isBefore,
    startOfToday
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
import { getSubmissionsForDate } from "@/lib/responsibility-status"

const COLORS = [
    "bg-primary text-primary-foreground",
    "bg-secondary text-secondary-foreground",
    "bg-accent text-accent-foreground border",
]

interface DayData {
    date: Date
    submissions: WorkSubmission[]
    totalHours: number
    hasVerified: boolean
    hasSubmitted: boolean
    hasRejected: boolean
    hasPending: boolean
    isMissed: boolean  // Past day with no submissions
}

export default function ManagerMyResponsibilitiesPage() {
    const { user } = useAuth()
    const [responsibilities, setResponsibilities] = useState<Responsibility[]>([])
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [allSubmissions, setAllSubmissions] = useState<WorkSubmission[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [staffCreatedAt, setStaffCreatedAt] = useState<Date | null>(null)

    // Separate month states for each calendar
    const [submissionsMonth, setSubmissionsMonth] = useState(new Date())
    const [responsibilitiesMonth, setResponsibilitiesMonth] = useState(new Date())

    const [selectedResponsibility, setSelectedResponsibility] = useState<Responsibility | null>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)

    // Day modal state - shows all responsibilities for a specific day
    const [selectedDayResponsibilities, setSelectedDayResponsibilities] = useState<{ resp: Responsibility; color: string }[]>([])
    const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null)
    const [dayModalOpen, setDayModalOpen] = useState(false)

    // Submissions modal state - shows all submissions for a specific day
    const [submissionsModalOpen, setSubmissionsModalOpen] = useState(false)
    const [selectedDateSubmissions, setSelectedDateSubmissions] = useState<WorkSubmission[]>([])
    const [selectedSubmissionDate, setSelectedSubmissionDate] = useState<Date | null>(null)

    const today = useMemo(() => startOfToday(), [])
    useEffect(() => {
        if (user?.id) {
            fetchData()
        }
    }, [user?.id])

    async function fetchData() {
        if (!user?.id) return
        setIsLoading(true)
        try {
            // Fetch employee details to get createdAt (joined date)
            const employeePromise = api.employees.getById(String(user.id))
            
            const [assignmentsData, submissionsData, employeeData] = await Promise.all([
                api.assignments.getAll({ staffId: String(user.id) }),
                api.workSubmissions.getAll({ staffId: String(user.id) }),
                employeePromise,
            ])
            setAssignments(assignmentsData)
            setAllSubmissions(submissionsData)
            if (employeeData?.createdAt) {
                setStaffCreatedAt(new Date(employeeData.createdAt))
            }
        } catch (error) {
            console.error("Failed to fetch data:", error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    // Generate calendar days for responsibilities month (including padding days)
    const responsibilitiesCalendarDays = useMemo(() => {
        const monthStart = startOfMonth(responsibilitiesMonth)
        const monthEnd = endOfMonth(responsibilitiesMonth)
        const calendarStart = startOfWeek(monthStart)
        const calendarEnd = endOfWeek(monthEnd)

        return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    }, [responsibilitiesMonth])

    // Get weeks for responsibilities calendar (array of 7-day arrays)
    const responsibilitiesWeeks = useMemo(() => {
        const result: Date[][] = []
        for (let i = 0; i < responsibilitiesCalendarDays.length; i += 7) {
            result.push(responsibilitiesCalendarDays.slice(i, i + 7))
        }
        return result
    }, [responsibilitiesCalendarDays])

    // Map ASSIGNMENTS (not responsibilities) to days with colors
    // This shows the actual assigned responsibilities to the user
    const assignmentMap = useMemo(() => {
        const map = new Map<string, { assignment: Assignment; resp: Responsibility; color: string; isStart: boolean; isEnd: boolean }[]>()

        assignments.forEach((assignment, index) => {
            const resp = assignment.responsibility
            if (!resp || !resp.startDate || !resp.endDate) return

            const color = COLORS[index % COLORS.length]
            const start = parseISO(resp.startDate)
            const end = parseISO(resp.endDate)

            responsibilitiesCalendarDays.forEach(day => {
                if (isWithinInterval(day, { start, end })) {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const existing = map.get(dateStr) || []
                    existing.push({
                        assignment,
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
    }, [assignments, responsibilitiesCalendarDays])

    // Map submissions by date for submissions calendar
    const submissionDayDataMap = useMemo(() => {
        const map = new Map<string, DayData>()

        // Get just the days in the submissions month view
        const monthStart = startOfMonth(submissionsMonth)
        const monthEnd = endOfMonth(submissionsMonth)
        const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

        monthDays.forEach(date => {
            const dateStr = format(date, 'yyyy-MM-dd')
            const daySubmissions = getSubmissionsForDate(allSubmissions, date)

            const totalHours = daySubmissions.reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)

            const hasVerified = daySubmissions.some(s => s.status === 'VERIFIED')
            const hasSubmitted = daySubmissions.some(s => s.status === 'SUBMITTED')
            const hasRejected = daySubmissions.some(s => s.status === 'REJECTED')
            const hasPending = daySubmissions.some(s => s.status === 'PENDING')

            // A day is "missed" if it's in the past, after staff joined, and has no submissions
            const isPastDay = isBefore(date, today) && !isSameDay(date, today)
            // Only count as missed if the day is on or after the staff's join date
            const isAfterJoinDate = staffCreatedAt ? (isSameDay(date, staffCreatedAt) || isBefore(staffCreatedAt, date)) : true
            const isMissed = isPastDay && isAfterJoinDate && daySubmissions.length === 0

            map.set(dateStr, {
                date,
                submissions: daySubmissions,
                totalHours,
                hasVerified,
                hasSubmitted,
                hasRejected,
                hasPending,
                isMissed,
            })
        })

        return map
    }, [submissionsMonth, allSubmissions, today, staffCreatedAt])

    // Get submission calendar days (just for submissions month)
    const submissionCalendarDays = useMemo(() => {
        const monthStart = startOfMonth(submissionsMonth)
        const monthEnd = endOfMonth(submissionsMonth)
        return eachDayOfInterval({ start: monthStart, end: monthEnd })
    }, [submissionsMonth])

    function navigateSubmissionsMonth(direction: 'prev' | 'next') {
        const newMonth = new Date(submissionsMonth)
        if (direction === 'prev') {
            newMonth.setMonth(newMonth.getMonth() - 1)
        } else {
            newMonth.setMonth(newMonth.getMonth() + 1)
        }
        setSubmissionsMonth(newMonth)
    }

    function navigateResponsibilitiesMonth(direction: 'prev' | 'next') {
        const newMonth = new Date(responsibilitiesMonth)
        if (direction === 'prev') {
            newMonth.setMonth(newMonth.getMonth() - 1)
        } else {
            newMonth.setMonth(newMonth.getMonth() + 1)
        }
        setResponsibilitiesMonth(newMonth)
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

    function openSubmissionsModal(date: Date, submissions: WorkSubmission[]) {
        setSelectedSubmissionDate(date)
        setSelectedDateSubmissions(submissions)
        setSubmissionsModalOpen(true)
    }

    function getSubmissionStatusColor(status: string) {
        switch (status) {
            case 'VERIFIED':
                return 'bg-primary text-primary-foreground'
            case 'SUBMITTED':
                return 'bg-secondary text-secondary-foreground border'
            case 'REJECTED':
                return 'bg-muted text-muted-foreground border'
            default:
                return 'bg-accent text-accent-foreground'
        }
    }

    function getDayBackgroundColor(dayData: DayData | undefined, isCurrentMonth: boolean): string {
        if (!isCurrentMonth) return 'bg-muted/50'
        if (!dayData) return ''

        // Missed day
        if (dayData.isMissed) {
            return 'bg-secondary/40'
        }

        // Has submissions
        if (dayData.submissions.length > 0) {
            return 'bg-primary/5'
        }

        return ''
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
            {/* <DashboardHeader /> */}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl  tracking-tight">My Responsibilities</h1>
                    <p className="text-muted-foreground">
                        View your assigned responsibilities and work submissions
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Two Calendars Grid */}
            <div className="grid gap-6 lg:grid-cols-2">

                {/* ============ SUBMISSIONS CALENDAR ============ */}
                <Card className="border border-foreground/10 overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Work Submissions
                        </CardTitle>
                        <CardDescription>Click on a date to view submissions</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" onClick={() => navigateSubmissionsMonth("prev")}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <h2 className="text-lg font-semibold">
                                    {format(submissionsMonth, "MMMM yyyy")}
                                </h2>
                                <Button variant="ghost" size="icon" onClick={() => navigateSubmissionsMonth("next")}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex items-center gap-3 text-xs">
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded bg-primary" />
                                    <span>Verified</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded bg-secondary border" />
                                    <span>Submitted</span>
                                </div>
                            </div>
                        </div>

                        {/* Day Headers */}
                        <div className="grid grid-cols-7 bg-muted text-muted-foreground text-sm font-medium">
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                                <div key={day} className="py-2 text-center">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 border-t border-foreground/10">
                            {/* Empty cells for alignment */}
                            {Array.from({ length: submissionCalendarDays[0]?.getDay() || 0 }).map((_, i) => (
                                <div
                                    key={`empty-${i}`}
                                    className="min-h-[100px] border border-foreground/10 bg-muted/30"
                                />
                            ))}

                            {submissionCalendarDays.map(date => {
                                const dateStr = format(date, "yyyy-MM-dd")
                                const isTodayDate = isDateToday(date)
                                const dayData = submissionDayDataMap.get(dateStr)
                                const bgColor = getDayBackgroundColor(dayData, true)

                                return (
                                    <div
                                        key={dateStr}
                                        onClick={() => dayData && openSubmissionsModal(date, dayData.submissions)}
                                        className={cn(
                                            "border border-foreground/10 p-2 cursor-pointer transition hover:bg-foreground/[0.04]",
                                            "min-h-[100px]",
                                            bgColor,
                                            isTodayDate && "ring-2 ring-foreground/40 ring-inset"
                                        )}
                                    >
                                        {/* Date and Hours */}
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={cn(
                                                "text-sm font-medium",
                                                isTodayDate && "text-foreground font-bold"
                                            )}>
                                                {format(date, "d")}
                                            </span>
                                            {(dayData?.totalHours ?? 0) > 0 && (
                                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                                    <Clock className="h-2.5 w-2.5" />
                                                    {(dayData?.totalHours ?? 0).toFixed(1)}h
                                                </span>
                                            )}
                                        </div>

                                        {/* Submission Items */}
                                        <div className="space-y-1">
                                            {dayData?.submissions.slice(0, 3).map(submission => (
                                                <div
                                                    key={submission.id}
                                                    className={cn(
                                                        "text-[10px] px-2 py-0.5 rounded truncate",
                                                        getSubmissionStatusColor(submission.status || 'SUBMITTED')
                                                    )}
                                                    title={submission.assignment?.responsibility?.title}
                                                >
                                                    {submission.assignment?.responsibility?.title || "Work"}
                                                </div>
                                            ))}

                                            {dayData && dayData.submissions.length > 3 && (
                                                <div className="text-[10px] text-muted-foreground">
                                                    +{dayData.submissions.length - 3} more
                                                </div>
                                            )}

                                            {/* Show missed indicator */}
                                            {dayData?.isMissed && (
                                                <div className="text-[10px] text-muted-foreground font-medium">
                                                    No submission
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* ============ RESPONSIBILITIES CALENDAR ============ */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Assigned Responsibilities
                        </CardTitle>
                        <CardDescription>{assignments.length} responsibilities assigned to you</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* Calendar Header */}
                        <div className="flex items-center justify-between p-4 border-b">
                            <div className="flex items-center gap-4">
                                <Button variant="ghost" size="icon" onClick={() => navigateResponsibilitiesMonth('prev')}>
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <h2 className="text-lg font-semibold min-w-[140px] text-center">
                                    {format(responsibilitiesMonth, 'MMMM yyyy')}
                                </h2>
                                <Button variant="ghost" size="icon" onClick={() => navigateResponsibilitiesMonth('next')}>
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        {/* Days of Week Header */}
                        <div className="grid grid-cols-7 bg-muted text-muted-foreground">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="p-2 text-center font-medium text-xs">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="divide-y">
                            {responsibilitiesWeeks.map((week, weekIndex) => (
                                <div key={weekIndex} className="grid grid-cols-7 divide-x min-h-[90px]">
                                    {week.map(day => {
                                        const dateStr = format(day, 'yyyy-MM-dd')
                                        const dayAssignments = assignmentMap.get(dateStr) || []
                                        const isCurrentMonth = isSameMonth(day, responsibilitiesMonth)
                                        const isToday = isSameDay(day, new Date())

                                        return (
                                            <div
                                                key={dateStr}
                                                className={cn(
                                                    "p-1.5 relative",
                                                    !isCurrentMonth && "bg-muted/50",
                                                    isToday && "bg-foreground/[0.04] dark:bg-foreground/[0.08]"
                                                )}
                                            >
                                                {/* Day Number */}
                                                <span className={cn(
                                                    "text-xs font-medium",
                                                    !isCurrentMonth && "text-muted-foreground",
                                                    isToday && "text-foreground font-bold"
                                                )}>
                                                    {day.getDate()}
                                                </span>

                                                {/* Assigned Responsibilities */}
                                                <div className="mt-1 space-y-0.5">
                                                    {dayAssignments.slice(0, 2).map(({ assignment, resp, color, isStart, isEnd }, idx) => (
                                                        <button
                                                            key={`${assignment.id}-${idx}`}
                                                            onClick={() => openDetails(resp)}
                                                            className={cn(
                                                                "w-full text-left text-[9px] px-1 py-0.5 truncate hover:opacity-80 transition-opacity",
                                                                color,
                                                                isStart && "rounded-l",
                                                                isEnd && "rounded-r",
                                                                !isStart && !isEnd && "rounded-none",
                                                                isStart && isEnd && "rounded"
                                                            )}
                                                            title={resp.title}
                                                        >
                                                            {resp.title}
                                                        </button>
                                                    ))}
                                                    {dayAssignments.length > 2 && (
                                                        <button
                                                            className="text-[9px] text-primary hover:underline font-medium"
                                                            onClick={() => openDayModal(day, dayAssignments.map(d => ({ resp: d.resp, color: d.color })))}
                                                        >
                                                            +{dayAssignments.length - 2} more
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
            </div>

            {/* Status Legend */}
            <Card className="border-border">
                <CardContent className="py-4">
                    <div className="flex flex-wrap items-center gap-6 justify-center">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-primary" />
                            <span className="text-sm">Verified</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-secondary border" />
                            <span className="text-sm">Submitted</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-muted border" />
                            <span className="text-sm">Rejected</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-primary/5 border" />
                            <span className="text-sm">Day with Submissions</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-secondary/40 border" />
                            <span className="text-sm">Missed Day</span>
                        </div>
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

                            {selectedResponsibility.isStaffCreated && (
                                <Badge variant="secondary">Staff Created</Badge>
                            )}
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

            {/* Submissions Modal - Shows all submissions for a specific day */}
            <Dialog open={submissionsModalOpen} onOpenChange={setSubmissionsModalOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedSubmissionDate && format(selectedSubmissionDate, "MMMM d, yyyy")}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedDateSubmissions.length > 0
                                ? `${selectedDateSubmissions.length} submission${selectedDateSubmissions.length > 1 ? 's' : ''} on this day`
                                : 'No submissions on this day'
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {selectedDateSubmissions.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No work was submitted on this date.</p>
                            </div>
                        ) : (
                            selectedDateSubmissions.map(submission => (
                                <div
                                    key={submission.id}
                                    className="p-4 border rounded-lg space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="font-medium">
                                            {submission.assignment?.responsibility?.title || 'Work Submission'}
                                        </p>
                                        <Badge
                                            className={cn(
                                                "text-white",
                                                getSubmissionStatusColor(submission.status || 'SUBMITTED')
                                            )}
                                        >
                                            {submission.status || 'SUBMITTED'}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-4 w-4" />
                                            <span>{(submission as any).hoursWorked || 0} hours</span>
                                        </div>
                                        <span>
                                            Submitted: {format(new Date(submission.submittedAt), "h:mm a")}
                                        </span>
                                    </div>

                                    {submission.staffComment && (
                                        <div className="text-sm">
                                            <span className="font-medium">Comment: </span>
                                            <span className="text-muted-foreground">{submission.staffComment}</span>
                                        </div>
                                    )}

                                    {submission.managerComment && (
                                        <div className="text-sm">
                                            <span className="font-medium">
                                                {submission.verifiedBy
                                                    ? `${submission.verifiedBy.name}'s Feedback (${(submission.verifiedBy as any).role === 'ADMIN' ? 'Admin' : 'Manager'}): `
                                                    : "Reviewer Feedback: "}
                                            </span>
                                            <span className="text-muted-foreground">{submission.managerComment}</span>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
