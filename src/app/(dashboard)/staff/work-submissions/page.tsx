"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { WorkSubmission, DayStatus } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SubmissionStatusBadge, DayStatusBadge } from "@/components/ui/status-badge"
import { 
    FileCheck, 
    Clock, 
    CheckCircle, 
    XCircle, 
    AlertTriangle, 
    Calendar,
    ArrowLeft,
    ChevronRight
} from "lucide-react"
import DashboardHeader from "@/components/dashboard-header"

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
            const dateStr = new Date(workDate).toISOString().split('T')[0]
            
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
            
            const status = submission.assignment?.status || submission.status
            if (status === 'VERIFIED') {
                day.verifiedHours += (submission as any).hoursWorked || 0
            }
        })
        
        // Calculate day status
        dayMap.forEach((day) => {
            const hasVerified = day.submissions.some(s => (s.assignment?.status || s.status) === 'VERIFIED')
            const hasSubmitted = day.submissions.some(s => (s.assignment?.status || s.status) === 'SUBMITTED')
            const hasRejected = day.submissions.some(s => (s.assignment?.status || s.status) === 'REJECTED')
            
            if (hasVerified && !hasSubmitted && !hasRejected) {
                day.status = 'VERIFIED'
            } else if (hasRejected && !hasVerified && !hasSubmitted) {
                day.status = 'REJECTED'
            } else if (hasSubmitted || hasVerified) {
                day.status = hasRejected ? 'PARTIAL' : 'SUBMITTED'
            }
        })
        
        // Sort by date descending
        return Array.from(dayMap.values()).sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
        )
    }, [submissions])

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
        const pending = submissions.filter(s => s.status === 'PENDING' || s.assignment?.status === 'PENDING')
        const submitted = submissions.filter(s => s.status === 'SUBMITTED' || s.assignment?.status === 'SUBMITTED')
        const verified = submissions.filter(s => s.status === 'VERIFIED' || s.assignment?.status === 'VERIFIED')
        const rejected = submissions.filter(s => s.status === 'REJECTED' || s.assignment?.status === 'REJECTED')
        
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
            <DashboardHeader/>
            
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/staff')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Work History</h1>
                    <p className="text-muted-foreground">
                        View all your daily work submissions
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Days</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalDays}</div>
                        <p className="text-xs text-muted-foreground">Days with submissions</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Verified Days</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.verifiedDays}</div>
                        <p className="text-xs text-muted-foreground">Fully approved</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                        <Clock className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.submitted}</div>
                        <p className="text-xs text-muted-foreground">Awaiting verification</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                        <XCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
                        <p className="text-xs text-muted-foreground">Need attention</p>
                    </CardContent>
                </Card>
            </div>

            {/* Rejected Alert */}
            {stats.rejected > 0 && (
                <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                            <AlertTriangle className="h-5 w-5" />
                            {stats.rejected} Rejected Submission{stats.rejected > 1 ? 's' : ''} Need Attention
                        </CardTitle>
                        <CardDescription className="text-red-600 dark:text-red-400">
                            Please review rejected items and contact your manager for queries.
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            {/* Daily Groups */}
            <Card>
                <CardHeader>
                    <CardTitle>Submission History by Day</CardTitle>
                    <CardDescription>
                        {groupedByDay.length} day{groupedByDay.length !== 1 ? 's' : ''} with work submissions
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {groupedByDay.length === 0 ? (
                        <div className="text-center py-12">
                            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">
                                No submissions yet. Go to your dashboard to submit today's work.
                            </p>
                            <Button className="mt-4" onClick={() => router.push('/staff')}>
                                Go to Dashboard
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {groupedByDay.map((day) => (
                                <div key={day.date} className="border rounded-lg overflow-hidden">
                                    {/* Day Header */}
                                    <button
                                        onClick={() => toggleDayExpanded(day.date)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <DayStatusBadge status={day.status} />
                                            <div className="text-left">
                                                <p className="font-medium">{day.displayDate}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {day.submissions.length} submission{day.submissions.length !== 1 ? 's' : ''} • {day.totalHours} total hours
                                                    {day.verifiedHours > 0 && ` • ${day.verifiedHours} verified`}
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight className={`h-5 w-5 transition-transform ${expandedDays.has(day.date) ? 'rotate-90' : ''}`} />
                                    </button>
                                    
                                    {/* Expanded Submissions */}
                                    {expandedDays.has(day.date) && (
                                        <div className="border-t bg-muted/30 p-4 space-y-3">
                                            {day.submissions.map((submission) => {
                                                const status = submission.assignment?.status || submission.status
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
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
