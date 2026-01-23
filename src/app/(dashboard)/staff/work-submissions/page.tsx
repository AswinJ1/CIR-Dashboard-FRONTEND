"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { WorkSubmission, DayStatus } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SubmissionStatusBadge, DayStatusBadge } from "@/components/ui/status-badge"
import { format } from "date-fns"
import { 
    FileCheck, 
    Clock, 
    CheckCircle, 
    XCircle, 
    AlertTriangle, 
    Calendar,
    ArrowLeft,
    ChevronRight,
    ChevronLeft
} from "lucide-react"
import DashboardHeader from "@/components/dashboard-header"
import { getDayStatus } from "@/lib/responsibility-status"

const ITEMS_PER_PAGE = 10

interface DayGroup {
    date: string
    displayDate: string
    status: DayStatus
    totalHours: number
    verifiedHours: number
    submissions: WorkSubmission[]
}

export default function StaffWorkSubmissionsPage() {
    const router = useRouter()
    const [submissions, setSubmissions] = useState<WorkSubmission[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)

    useEffect(() => {
        async function fetchSubmissions() {
            try {
                const data = await api.workSubmissions.getAll()
                setSubmissions(data)
            } catch (error) {
                console.error("Failed to fetch submissions:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchSubmissions()
    }, [])

    // Group submissions by date
    const groupedByDay = useMemo((): DayGroup[] => {
        const dayMap = new Map<string, DayGroup>()

        submissions.forEach(submission => {
            const workDate = (submission as any).workDate || submission.submittedAt
            const dateStr = format(new Date(workDate), 'yyyy-MM-dd')

            if (!dayMap.has(dateStr)) {
                dayMap.set(dateStr, {
                    date: dateStr,
                    displayDate: new Date(dateStr).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    }),
                    status: 'NOT_SUBMITTED',
                    totalHours: 0,
                    verifiedHours: 0,
                    submissions: []
                })
            }

            const day = dayMap.get(dateStr)!
            day.submissions.push(submission)
            day.totalHours += (submission as any).hoursWorked || 0

            const status = submission.status || submission.assignment?.status
            if (status === 'VERIFIED') {
                day.verifiedHours += (submission as any).hoursWorked || 0
            }
        })

        // Calculate day status using shared utility
        dayMap.forEach((day) => {
            day.status = getDayStatus(day.submissions)
        })

        // Sort by date descending
        return Array.from(dayMap.values()).sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        )
    }, [submissions])

    // Pagination
    const totalPages = Math.ceil(groupedByDay.length / ITEMS_PER_PAGE)
    const paginatedDays = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return groupedByDay.slice(start, start + ITEMS_PER_PAGE)
    }, [groupedByDay, currentPage])

    const toggleDayExpanded = (date: string) => {
        setExpandedDays(prev => {
            const next = new Set(prev)
            if (next.has(date)) {
                next.delete(date)
            } else {
                next.add(date)
            }
            return next
        })
    }

    // Stats
    const stats = useMemo(() => {
        const pending = submissions.filter(s => (s.status || s.assignment?.status) === 'PENDING')
        const submitted = submissions.filter(s => (s.status || s.assignment?.status) === 'SUBMITTED')
        const verified = submissions.filter(s => (s.status || s.assignment?.status) === 'VERIFIED')
        const rejected = submissions.filter(s => (s.status || s.assignment?.status) === 'REJECTED')

        return {
            pending: pending.length,
            submitted: submitted.length,
            verified: verified.length,
            rejected: rejected.length,
            totalDays: groupedByDay.length,
            verifiedDays: groupedByDay.filter(d => d.status === 'VERIFIED').length,
        }
    }, [submissions, groupedByDay])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            <DashboardHeader />

            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Work Submissions</h1>
                    <p className="text-muted-foreground">View your submitted work by date</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.pending}</p>
                                <p className="text-sm text-muted-foreground">Pending</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                <FileCheck className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.submitted}</p>
                                <p className="text-sm text-muted-foreground">Submitted</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.verified}</p>
                                <p className="text-sm text-muted-foreground">Verified</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center">
                                <XCircle className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.rejected}</p>
                                <p className="text-sm text-muted-foreground">Rejected</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Submissions by Day */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Submissions by Date
                    </CardTitle>
                    <CardDescription>
                        Showing {paginatedDays.length} of {groupedByDay.length} days
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {groupedByDay.length === 0 ? (
                        <div className="text-center py-12">
                            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-medium mb-2">No submissions yet</h3>
                            <p className="text-muted-foreground mb-4">
                                You haven't submitted any work yet.
                            </p>
                            <Button onClick={() => router.push('/staff/work-calendar')}>
                                Go to Work Calendar
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3">
                                {paginatedDays.map((day) => (
                                    <div key={day.date} className="border rounded-lg overflow-hidden">
                                        {/* Day Header */}
                                        <button
                                            onClick={() => toggleDayExpanded(day.date)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <DayStatusBadge status={day.status} />
                                                <div className="text-left">
                                                    <p className="font-medium">{day.displayDate}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {day.submissions.length} submission{day.submissions.length !== 1 ? 's' : ''} • total {day.totalHours}  hours  work staff submitted
                                                        {day.verifiedHours > 0 && ` • Final: ${day.verifiedHours} hrs verified`}
                                                    </p>
                                                </div>
                                            </div>
                                            <ChevronRight className={`h-5 w-5 transition-transform ${expandedDays.has(day.date) ? 'rotate-90' : ''}`} />
                                        </button>
                                        
                                        {/* Expanded Submissions */}
                                        {expandedDays.has(day.date) && (
                                            <div className="border-t bg-muted/30 p-4 space-y-3">
                                                {day.submissions.map((submission) => {
                                                    const status = submission.status || submission.assignment?.status || 'SUBMITTED'
                                                    return (
                                                        <div
                                                            key={submission.id}
                                                            className="flex items-center justify-between p-3 bg-background rounded-lg border"
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                                                                    status === 'VERIFIED' ? 'bg-green-100 dark:bg-green-900' :
                                                                    status === 'REJECTED' ? 'bg-red-100 dark:bg-red-900' :
                                                                    status === 'SUBMITTED' ? 'bg-blue-100 dark:bg-blue-900' :
                                                                    'bg-amber-100 dark:bg-amber-900'
                                                                }`}>
                                                                    {status === 'VERIFIED' && <CheckCircle className="h-4 w-4 text-green-600" />}
                                                                    {status === 'REJECTED' && <XCircle className="h-4 w-4 text-red-600" />}
                                                                    {status === 'SUBMITTED' && <FileCheck className="h-4 w-4 text-blue-600" />}
                                                                    {status === 'PENDING' && <Clock className="h-4 w-4 text-amber-600" />}
                                                                </div>
                                                                <div>
                                                                    <p className="font-medium text-sm">
                                                                        {submission.assignment?.responsibility?.title || 'Work Submission'}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {(submission as any).hoursWorked || 0} hours
                                                                        {submission.verifiedAt && ` • Verified ${new Date(submission.verifiedAt).toLocaleDateString()}`}
                                                                    </p>
                                                                    {status === 'REJECTED' && submission.rejectionReason && (
                                                                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                                                            Reason: {submission.rejectionReason}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <SubmissionStatusBadge status={status as any} />
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                                    <p className="text-sm text-muted-foreground">
                                        Page {currentPage} of {totalPages}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4 mr-1" />
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            Next
                                            <ChevronRight className="h-4 w-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
