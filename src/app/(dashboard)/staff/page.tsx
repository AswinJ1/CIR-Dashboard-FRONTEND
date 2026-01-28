"use client"

import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@/components/providers/auth-context"
import { api } from "@/lib/api"
import { Assignment, WorkSubmission, DayStatus } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DailyMetricsCards } from "@/components/staff/daily-metrics-cards"
import { toast } from "sonner"
import Link from "next/link"
import {
    Calendar,
    Clock,
    AlertCircle,
    CheckCircle,
    RefreshCw,
    ArrowRight,
    FileText,
    CalendarCheck,
} from "lucide-react"
import DashboardHeader from "@/components/dashboard-header"
import { format } from "date-fns"
import {
    getSubmissionsForDate,
    getDayStatus,
    getActiveUnsubmittedAssignments,
    getSubmittedAssignmentsForDate,
    getToday,
    getAssignmentStatusForDate,
} from "@/lib/responsibility-status"

interface DailyMetrics {
    todayStatus: DayStatus
    todayHours: number
    todayVerifiedHours: number
    verifiedDaysCount: number
    missedDaysCount: number
    totalSubmittedDays: number
    totalRejectedCount: number
}

export default function StaffDashboardPage() {
    const { user } = useAuth()
    const [isLoading, setIsLoading] = useState(true)

    // Data states
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [todaySubmissions, setTodaySubmissions] = useState<WorkSubmission[]>([])
    const [allSubmissions, setAllSubmissions] = useState<WorkSubmission[]>([])

    const today = useMemo(() => getToday(), [])

    // Fetch all data
    useEffect(() => {
        fetchDashboardData()
    }, [])

    async function fetchDashboardData() {
        setIsLoading(true)
        try {
            const [assignmentsData, submissionsData] = await Promise.all([
                api.assignments.getAll(),
                api.workSubmissions.getAll(),
            ])

            setAssignments(assignmentsData)
            setAllSubmissions(submissionsData)
            // Set today's submissions using shared utility
            const todayData = getSubmissionsForDate(submissionsData, new Date())
            setTodaySubmissions(todayData)
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error)
            toast.error("Failed to load dashboard data")
        } finally {
            setIsLoading(false)
        }
    }

    // Calculate metrics using date-specific status logic
    const metrics = useMemo((): DailyMetrics => {
        const todayDateStr = format(today, 'yyyy-MM-dd')

        // Get unique dates from submissions
        const submissionDates = new Map<string, {
            hasVerified: boolean
            hasSubmitted: boolean
            hasRejected: boolean
            totalHours: number
            verifiedHours: number
        }>()

        allSubmissions.forEach(submission => {
            const workDate = new Date((submission as any).workDate || submission.submittedAt)
            const dateStr = format(workDate, 'yyyy-MM-dd')
            const existing = submissionDates.get(dateStr) || {
                hasVerified: false,
                hasSubmitted: false,
                hasRejected: false,
                totalHours: 0,
                verifiedHours: 0,
            }

            // Use the submission's own status for THIS DATE
            const status = submission.status || submission.assignment?.status
            const hours = (submission as any).hoursWorked || 0

            existing.totalHours += hours

            if (status === 'VERIFIED') {
                existing.hasVerified = true
                existing.verifiedHours += hours
            } else if (status === 'SUBMITTED') {
                existing.hasSubmitted = true
            } else if (status === 'REJECTED') {
                existing.hasRejected = true
            }

            submissionDates.set(dateStr, existing)
        })

        // Calculate today's metrics based on TODAY's submissions only
        const todaySubmissionsData = getSubmissionsForDate(allSubmissions, today)
        const todayStatus = getDayStatus(todaySubmissionsData)
        const todayTotalHours = todaySubmissionsData.reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)
        const todayVerifiedHours = todaySubmissionsData
            .filter(s => (s.status === 'VERIFIED') || (s.assignment?.status === 'VERIFIED'))
            .reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)

        // Count verified days (based on submission status for each date)
        let verifiedDaysCount = 0
        submissionDates.forEach((data) => {
            if (data.hasVerified && !data.hasSubmitted && !data.hasRejected) {
                verifiedDaysCount++
            }
        })

        // Calculate missed days (working days without submission in the past 30 days)
        let missedDaysCount = 0
        const thirtyDaysAgo = new Date(today)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        for (let d = new Date(thirtyDaysAgo); d < today; d.setDate(d.getDate() + 1)) {
            const dateStr = format(d, 'yyyy-MM-dd')
            if (!submissionDates.has(dateStr)) {
                missedDaysCount++
            }
        }

        // Count rejected submissions (for today only)
        const todayRejectedCount = todaySubmissionsData.filter(s => 
            (s.status === 'REJECTED') || (s.assignment?.status === 'REJECTED')
        ).length

        return {
            todayStatus,
            todayHours: todayTotalHours,
            todayVerifiedHours,
            verifiedDaysCount,
            missedDaysCount,
            totalSubmittedDays: submissionDates.size,
            totalRejectedCount: todayRejectedCount,
        }
    }, [allSubmissions, today])

    // Get today's assignments with their date-specific submission status
    const todayAssignments = useMemo(() => {
        // Get unsubmitted assignments for today
        const unsubmitted = getActiveUnsubmittedAssignments(assignments, today, allSubmissions)
        // Get submitted assignments for today
        const submitted = getSubmittedAssignmentsForDate(assignments, today, allSubmissions)

        // Combine: mark unsubmitted with todaySubmission = null, submitted with their submission
        const all = [
            ...unsubmitted.map(a => ({ ...a, todaySubmission: null })),
            ...submitted.map(a => ({ ...a, todaySubmission: a.submissionForDate })),
        ]
        return all
    }, [assignments, today, allSubmissions])

    const pendingCount = todayAssignments.filter(a => !a.todaySubmission).length
    const submittedCount = todayAssignments.filter(a => a.todaySubmission).length

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
                    <h1 className="text-3xl font-bold tracking-tight">My Dashboard</h1>
                    <p className="text-muted-foreground">
                        Welcome back, {user?.name || 'Staff'}. Here's your work overview.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchDashboardData}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Daily Metrics */}
            <DailyMetricsCards metrics={metrics} />

            {/* CTA Card - Go to Work Calendar */}
            <Card className="border-primary bg-primary/5">
                <CardContent className="py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <CalendarCheck className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Submit Today's Work</h3>
                                <p className="text-muted-foreground">
                                    {pendingCount > 0
                                        ? `You have ${pendingCount} responsibilit${pendingCount > 1 ? 'ies' : 'y'} pending submission`
                                        : submittedCount > 0
                                            ? `All ${submittedCount} responsibilit${submittedCount > 1 ? 'ies' : 'y'} submitted for today`
                                            : "No responsibilities for today"
                                    }
                                </p>
                            </div>
                        </div>
                        <Button asChild size="lg">
                            <Link href="/staff/work-calendar">
                                Go to Work Calendar
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Rejected Alert */}
            {metrics.totalRejectedCount > 0 && (
                <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                            <AlertCircle className="h-5 w-5" />
                            {metrics.totalRejectedCount} Rejected Submission{metrics.totalRejectedCount > 1 ? 's' : ''}
                        </CardTitle>
                        <CardDescription className="text-red-600 dark:text-red-400">
                            Some of your work requires revision. Check the Work Calendar for details.
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            {/* Today's Assignments Overview */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Today's Responsibilities
                        </CardTitle>
                        <CardDescription>
                            {new Date().toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </CardDescription>
                    </div>
                    {todayAssignments.length > 0 && (
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="gap-1">
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                {submittedCount} Submitted
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                                <Clock className="h-3 w-3 text-amber-500" />
                                {pendingCount} Pending
                            </Badge>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    {todayAssignments.length === 0 ? (
                        <div className="text-center py-8">
                            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">
                                No responsibilities assigned for today.
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Contact your manager to get assigned responsibilities.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {todayAssignments.slice(0, 5).map(assignment => (
                                <div
                                    key={assignment.id}
                                    className="flex items-center justify-between p-4 border rounded-lg bg-card"
                                >
                                    <div className="flex-1">
                                        <p className="font-medium">
                                            {assignment.responsibility?.title || 'Untitled Responsibility'}
                                        </p>
                                        {assignment.responsibility?.description && (
                                            <p className="text-sm text-muted-foreground line-clamp-1">
                                                {assignment.responsibility.description}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {assignment.todaySubmission ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-muted-foreground">
                                                    {(assignment.todaySubmission as any).hoursWorked || 0}h
                                                </span>
                                                <Badge
                                                    variant={assignment.todaySubmission.status === 'VERIFIED' ? 'default' : 'secondary'}
                                                    className={assignment.todaySubmission.status === 'VERIFIED' ? 'bg-green-600' : ''}
                                                >
                                                    {assignment.todaySubmission.status === 'VERIFIED'
                                                        ? 'Verified'
                                                        : assignment.todaySubmission.status === 'REJECTED'
                                                            ? 'Rejected'
                                                            : 'Submitted'
                                                    }
                                                </Badge>
                                            </div>
                                        ) : (
                                            <Badge variant="outline" className="text-amber-600">
                                                <Clock className="h-3 w-3 mr-1" />
                                                Pending
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {todayAssignments.length > 5 && (
                                <div className="text-center pt-2">
                                    <Button variant="link" asChild>
                                        <Link href="/staff/work-calendar">
                                            View all {todayAssignments.length} assignments
                                            <ArrowRight className="h-4 w-4 ml-1" />
                                        </Link>
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Quick Links */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <Link href="/staff/work-calendar">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <CalendarCheck className="h-5 w-5" />
                                Work Calendar
                            </CardTitle>
                            <CardDescription>
                                View calendar and submit daily work
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <Link href="/staff/responsibilities">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <FileText className="h-5 w-5" />
                                My Responsibilities
                            </CardTitle>
                            <CardDescription>
                                Create personal responsibilities
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <Link href="/staff/work-submissions">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <CheckCircle className="h-5 w-5" />
                                Submission History
                            </CardTitle>
                            <CardDescription>
                                View past submissions and status
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>
            </div>
        </div>
    )
}
