"use client"

import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@/components/providers/auth-context"
import { api } from "@/lib/api"
import { Assignment, WorkSubmission, DayStatus, Responsibility } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
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
    BarChart3,
    TrendingUp,
    FileCheck,
    CalendarIcon,
    XCircle,
    Target,
    Activity,
    Download,
} from "lucide-react"
import DashboardHeader from "@/components/dashboard-header"
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns"
import {
    getSubmissionsForDate,
    getDayStatus,
    getActiveUnsubmittedAssignments,
    getSubmittedAssignmentsForDate,
    getToday,
    getAssignmentStatusForDate,
} from "@/lib/responsibility-status"
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler } from 'chart.js'
import { Pie, Bar, Line, Doughnut } from 'react-chartjs-2'
import { StaffExportDialog } from "@/components/export-dialog"

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler)

// CSV Export utility function
const exportToCSV = (data: Record<string, any>[], filename: string) => {
    if (data.length === 0) {
        alert('No data to export')
        return
    }
    const headers = Object.keys(data[0])
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const value = row[header]
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`
                }
                return value ?? ''
            }).join(',')
        )
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

interface DailyMetrics {
    todayStatus: DayStatus
    todayHours: number
    todayVerifiedHours: number
    verifiedDaysCount: number
    missedDaysCount: number
    totalSubmittedDays: number
    totalRejectedCount: number
}

type DateRange = {
    from: Date
    to: Date
}

export default function StaffDashboardPage() {
    const { user } = useAuth()
    const [isLoading, setIsLoading] = useState(true)

    // Data states
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [todaySubmissions, setTodaySubmissions] = useState<WorkSubmission[]>([])
    const [allSubmissions, setAllSubmissions] = useState<WorkSubmission[]>([])
    const [staffCreatedAt, setStaffCreatedAt] = useState<string | null>(null)
    const [employeeName, setEmployeeName] = useState<string | null>(null)

    // Analytics date range
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 30),
        to: new Date(),
    })

    const today = useMemo(() => getToday(), [])

    // Fetch all data
    useEffect(() => {
        fetchDashboardData()
    }, [])

    async function fetchDashboardData() {
        setIsLoading(true)
        try {
            // Fetch employee details to get createdAt (joined date)
            const employeePromise = user?.id ? api.employees.getById(String(user.id)) : Promise.resolve(null)
            
            const [assignmentsData, submissionsData, employeeData] = await Promise.all([
                api.assignments.getAll(),
                api.workSubmissions.getAll(),
                employeePromise,
            ])

            setAssignments(assignmentsData)
            setAllSubmissions(submissionsData)
            if (employeeData?.createdAt) {
                setStaffCreatedAt(employeeData.createdAt)
            }
            if (employeeData?.name) {
                setEmployeeName(employeeData.name)
            }
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
        

        // Calculate missed days (days without submission from staff joined date to today)
        let missedDaysCount = 0
        
        // Get staff joined date - fallback to 30 days ago if not available
        let startDate: Date
        if (staffCreatedAt && staffCreatedAt !== '') {
            startDate = new Date(staffCreatedAt)
        } else {
            // Fallback: use 30 days ago if createdAt is not available
            startDate = new Date(today)
            startDate.setDate(startDate.getDate() - 30)
        }
        startDate.setHours(0, 0, 0, 0)

        // Create a copy of today for comparison to avoid mutation issues
        const todayStart = new Date(today)
        todayStart.setHours(0, 0, 0, 0)

        // Loop through each day from start date to yesterday (not including today)
        const currentDate = new Date(startDate)
        while (currentDate < todayStart) {
            const dateStr = format(currentDate, 'yyyy-MM-dd')
            if (!submissionDates.has(dateStr)) {
                missedDaysCount++
            }
            currentDate.setDate(currentDate.getDate() + 1)
        }

        // Count ALL rejected submissions (not just today)
        const allRejectedCount = allSubmissions.filter(s =>
            (s.status === 'REJECTED') || (s.assignment?.status === 'REJECTED')
        ).length

        return {
            todayStatus,
            todayHours: todayTotalHours,
            todayVerifiedHours,
            verifiedDaysCount,
            missedDaysCount,
            totalSubmittedDays: submissionDates.size,
            totalRejectedCount: allRejectedCount,
        }
    }, [allSubmissions, today, staffCreatedAt])

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

    // ============ ANALYTICS CALCULATIONS ============
    const filteredSubmissions = useMemo(() => {
        const userId = String(user?.id || '')
        return allSubmissions
            .filter(s => String(s.staffId) === userId)
            .filter(s => {
                const date = new Date(s.workDate || s.submittedAt)
                return date >= dateRange.from && date <= dateRange.to
            })
    }, [allSubmissions, dateRange, user?.id])

    const analyticsStats = useMemo(() => {
        const total = filteredSubmissions.length
        const verified = filteredSubmissions.filter(s => s.status === 'VERIFIED').length
        const pending = filteredSubmissions.filter(s => s.status === 'SUBMITTED' || s.status === 'PENDING').length
        const rejected = filteredSubmissions.filter(s => s.status === 'REJECTED').length
        const totalHours = filteredSubmissions.reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)
        const verifiedHours = filteredSubmissions
            .filter(s => s.status === 'VERIFIED')
            .reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)
        const approvalRate = total > 0 ? Math.round((verified / total) * 100) : 0

        return { total, verified, pending, rejected, totalHours, verifiedHours, approvalRate }
    }, [filteredSubmissions])

    const dailyData = useMemo(() => {
        const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to })

        return days.map(day => {
            const daySubmissions = filteredSubmissions.filter(s =>
                isSameDay(new Date(s.submittedAt), day)
            )
            const verified = daySubmissions.filter(s => s.status === 'VERIFIED').length
            const pending = daySubmissions.filter(s => s.status === 'SUBMITTED' || s.status === 'PENDING').length
            const rejected = daySubmissions.filter(s => s.status === 'REJECTED').length
            const hours = daySubmissions.reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)

            return {
                date: format(day, 'MMM d'),
                fullDate: format(day, 'yyyy-MM-dd'),
                submissions: daySubmissions.length,
                verified,
                pending,
                rejected,
                hours: Math.round(hours * 10) / 10,
            }
        })
    }, [filteredSubmissions, dateRange])

    const weeklyData = useMemo(() => {
        const weeks: { week: string; submissions: number; hours: number }[] = []
        let currentWeekStart = dateRange.from
        let weekNum = 1

        while (currentWeekStart <= dateRange.to) {
            const weekEnd = new Date(Math.min(
                currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000,
                dateRange.to.getTime()
            ))

            const weekSubmissions = filteredSubmissions.filter(s => {
                const date = new Date(s.submittedAt)
                return date >= currentWeekStart && date <= weekEnd
            })

            weeks.push({
                week: `Week ${weekNum}`,
                submissions: weekSubmissions.length,
                hours: Math.round(weekSubmissions.reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0) * 10) / 10,
            })

            currentWeekStart = new Date(weekEnd.getTime() + 24 * 60 * 60 * 1000)
            weekNum++
        }

        return weeks
    }, [filteredSubmissions, dateRange])

    // Chart.js Data - Status Distribution (Pie)
    const statusPieData = {
        labels: ['Verified', 'Pending', 'Rejected'],
        datasets: [
            {
                label: 'Submissions',
                data: [analyticsStats.verified, analyticsStats.pending, analyticsStats.rejected],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',   // Green
                    'rgba(251, 191, 36, 0.8)',  // Yellow/Amber
                    'rgba(239, 68, 68, 0.8)',   // Red
                ],
                borderColor: [
                    'rgba(34, 197, 94, 1)',
                    'rgba(251, 191, 36, 1)',
                    'rgba(239, 68, 68, 1)',
                ],
                borderWidth: 2,
            },
        ],
    }

    // Responsibility Hours (Bar Chart) - grouped by responsibility, filtered by date range
    const responsibilityHoursData = useMemo(() => {
        const respMap = new Map<string, number>()
        filteredSubmissions.forEach(s => {
            const title = s.assignment?.responsibility?.title || 'Unknown'
            const hours = (s as any).hoursWorked || 0
            respMap.set(title, (respMap.get(title) || 0) + hours)
        })
        const entries = Array.from(respMap.entries()).sort((a, b) => b[1] - a[1])
        const colors = [
            'rgba(139, 92, 246, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(99, 102, 241, 0.8)',
            'rgba(168, 85, 247, 0.8)', 'rgba(236, 72, 153, 0.8)', 'rgba(34, 197, 94, 0.8)',
            'rgba(251, 146, 60, 0.8)', 'rgba(244, 63, 94, 0.8)',
        ]
        return {
            labels: entries.map(([title]) => title.length > 20 ? title.substring(0, 18) + '...' : title),
            datasets: [{
                label: 'Hours Worked',
                data: entries.map(([, hours]) => Math.round(hours * 10) / 10),
                backgroundColor: entries.map((_, i) => colors[i % colors.length]),
                borderColor: entries.map((_, i) => colors[i % colors.length].replace('0.8', '1')),
                borderWidth: 2,
                borderRadius: 6,
            }],
            _fullTitles: entries.map(([title]) => title),
        }
    }, [filteredSubmissions])

    const respBarChartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: { size: 14 },
                bodyFont: { size: 13 },
                callbacks: {
                    title: function (context: any) {
                        const index = context[0]?.dataIndex
                        return (responsibilityHoursData as any)._fullTitles?.[index] || context[0]?.label
                    },
                    label: function (context: any) {
                        return `Hours: ${context.raw}h`
                    }
                }
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.05)' }, title: { display: true, text: 'Hours' } },
        },
    }

    // Weekly Comparison (Bar Chart)
    const weeklyBarData = {
        labels: weeklyData.map(d => d.week),
        datasets: [
            {
                label: 'Responsibilities',
                data: weeklyData.map(d => d.submissions),
                backgroundColor: 'rgba(99, 102, 241, 0.8)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 2,
                borderRadius: 6,
            },
            {
                label: 'Hours',
                data: weeklyData.map(d => d.hours),
                backgroundColor: 'rgba(34, 197, 94, 0.8)',
                borderColor: 'rgba(34, 197, 94, 1)',
                borderWidth: 2,
                borderRadius: 6,
            },
        ],
    }

    // Hours Trend (Line Chart)
    const hoursTrendData = {
        labels: dailyData.map(d => d.date),
        datasets: [
            {
                label: 'Hours Worked',
                data: dailyData.map(d => d.hours),
                borderColor: 'rgba(34, 197, 94, 1)',
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 0,
            },
        ],
    }

    // Daily Status Breakdown (Stacked Bar Chart)
    const dailyStatusData = {
        labels: dailyData.map(d => d.date),
        datasets: [
            {
                label: 'Verified',
                data: dailyData.map(d => d.verified),
                backgroundColor: 'rgba(34, 197, 94, 0.8)',
                borderColor: 'rgba(34, 197, 94, 1)',
                borderWidth: 1,
            },
            {
                label: 'Pending',
                data: dailyData.map(d => d.pending),
                backgroundColor: 'rgba(251, 191, 36, 0.8)',
                borderColor: 'rgba(251, 191, 36, 1)',
                borderWidth: 1,
            },
            {
                label: 'Rejected',
                data: dailyData.map(d => d.rejected),
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 1,
            },
        ],
    }

    // Chart Options
    const pieChartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    padding: 15,
                    font: { size: 12 },
                    boxWidth: 12,
                    boxHeight: 12,
                },
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: { size: 14 },
                bodyFont: { size: 13 },
                callbacks: {
                    label: function (context: any) {
                        const label = context.label || '';
                        const value = context.parsed || 0;
                        const total = context.dataset.data.reduce((acc: number, val: number) => acc + val, 0);
                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                        return `${label}: ${value} (${percentage}%)`;
                    }
                }
            },
        },
    }

    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    padding: 15,
                    font: { size: 12 },
                },
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: { size: 14 },
                bodyFont: { size: 13 },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: { precision: 0 },
            },
        },
        interaction: {
            intersect: false,
            mode: 'index' as const,
        },
    }

    const barChartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    padding: 15,
                    font: { size: 12 },
                },
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: { size: 14 },
                bodyFont: { size: 13 },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: { precision: 0 },
            },
        },
    }

    const stackedBarOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    padding: 15,
                    font: { size: 12 },
                },
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: { size: 14 },
                bodyFont: { size: 13 },
            },
        },
        scales: {
            x: { stacked: true },
            y: {
                stacked: true,
                beginAtZero: true,
                ticks: { precision: 0 },
            },
        },
    }

    if (isLoading) {
        return (
            <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                    <Skeleton className="h-10 w-24" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} className="p-6">
                            <Skeleton className="h-4 w-24 mb-3" />
                            <Skeleton className="h-8 w-16" />
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                   <div>
                    <h1 className="text-2xl  tracking-tight"> Welcome back{employeeName ? `, ${employeeName}` : ''} 👋</h1>
                    <p className="text-muted-foreground">
                        Here's a summary of your work activity and metrics.
                    </p>
                </div>
                <div className="flex gap-2">
                    <StaffExportDialog
                        submissions={allSubmissions}
                        responsibilities={assignments.map(a => a.responsibility).filter((r): r is Responsibility => r !== undefined)}
                        assignments={assignments}
                        userName={employeeName || user?.name || 'Staff'}
                    />
                    <Button variant="outline" size="sm" onClick={fetchDashboardData}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
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
                                Submit Work
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
                            Some of your work requires revision. Check the Work submissions for details.
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            {/* Today's Assignments Overview */}
            {/* <Card>
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
                                {pendingCount} Not Verified
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
                                                Not Verified
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
            </Card> */}

            {/* ============ ANALYTICS SECTION ============ */}
            <div className="space-y-6">
                {/* Analytics Header with Date Range */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl  tracking-tight">My Analytics</h2>
                        <p className="text-muted-foreground">Your personal performance metrics and insights</p>
                    </div>

                    {/* Date Range Picker */}
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-muted-foreground">Date Range</span>
                        <div className="flex items-center gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {format(dateRange.from, "MMM d, yyyy")}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <CalendarComponent
                                        mode="single"
                                        selected={dateRange.from}
                                        onSelect={(date) => {
                                            if (date) {
                                                setDateRange(prev => ({ ...prev, from: date }))
                                            }
                                        }}
                                    />
                                </PopoverContent>
                            </Popover>
                            <span className="text-sm text-muted-foreground">to</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {format(dateRange.to, "MMM d, yyyy")}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                    <CalendarComponent
                                        mode="single"
                                        selected={dateRange.to}
                                        onSelect={(date) => {
                                            if (date) {
                                                setDateRange(prev => ({ ...prev, to: date }))
                                            }
                                        }}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>

                {/* Analytics Stats Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                            <BarChart3 className="h-4 w-4 text-blue-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl  text-blue-600">{analyticsStats.total}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {analyticsStats.totalHours.toFixed(1)} hours logged
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
                            <TrendingUp className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl  text-green-600">{analyticsStats.approvalRate}%</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {analyticsStats.verified} verified of {analyticsStats.total}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                            <Clock className="h-4 w-4 text-amber-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl  text-amber-600">{analyticsStats.pending}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Awaiting manager verification
                            </p>
                        </CardContent>
                    </Card>
                    
                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                            <FileCheck className="h-4 w-4 text-purple-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl  text-purple-600">{analyticsStats.totalHours.toFixed(1)}h</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                total work hours
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Verified Hours</CardTitle>
                            <FileCheck className="h-4 w-4 text-purple-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl  text-purple-600">{analyticsStats.verifiedHours.toFixed(1)}h</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Approved work hours
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts Section */}
                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="hours">Hours Tracking</TabsTrigger>
                        <TabsTrigger value="status">Status Breakdown</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                        <div className="grid gap-6 lg:grid-cols-3">
                            {/* Status Distribution Pie */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                <Activity className="h-5 w-5 text-blue-600" />
                                                Status Distribution
                                            </CardTitle>
                                            <CardDescription>Breakdown by submission status</CardDescription>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => exportToCSV([{ Status: 'Verified', Count: analyticsStats.verified }, { Status: 'Pending', Count: analyticsStats.pending }, { Status: 'Rejected', Count: analyticsStats.rejected }], 'status_distribution')}>
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex justify-center">
                                    <div className="w-full max-w-[280px]">
                                        {analyticsStats.total > 0 ? (
                                            <Doughnut data={statusPieData} options={pieChartOptions} />
                                        ) : (
                                            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                                                No submissions in selected period
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Hours by Responsibility Bar Chart */}
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                <TrendingUp className="h-5 w-5 text-indigo-600" />
                                                Hours by Responsibility
                                            </CardTitle>
                                            <CardDescription>Total hours worked per responsibility</CardDescription>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => exportToCSV((responsibilityHoursData as any)._fullTitles?.map((title: string, i: number) => ({ Responsibility: title, Hours: responsibilityHoursData.datasets[0].data[i] })) || [], 'hours_by_responsibility')}>
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {(responsibilityHoursData as any)._fullTitles?.length > 0 ? (
                                        <Bar data={responsibilityHoursData} options={respBarChartOptions} />
                                    ) : (
                                        <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                                            No submission data in selected period
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Weekly Comparison */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <BarChart3 className="h-5 w-5 text-purple-600" />
                                            Weekly Comparison
                                        </CardTitle>
                                        <CardDescription>Responsibilities and hours by week</CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => exportToCSV(weeklyData.map(w => ({ Week: w.week, Submissions: w.submissions, Hours: w.hours })), 'weekly_comparison')}>
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Bar data={weeklyBarData} options={barChartOptions} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="hours" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Clock className="h-5 w-5 text-green-600" />
                                            Hours Logged Over Time
                                        </CardTitle>
                                        <CardDescription>Daily hours worked trend</CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => exportToCSV(dailyData.map(d => ({ Date: d.date, Hours: d.hours })), 'hours_trend')}>
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[400px]">
                                    <Line data={hoursTrendData} options={{ ...lineChartOptions, maintainAspectRatio: false }} />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid gap-4 md:grid-cols-3">
                            <Card className="hover:shadow-lg transition-shadow">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">Average Daily Hours</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl ">
                                        {dailyData.filter(d => d.hours > 0).length > 0
                                            ? (analyticsStats.totalHours / dailyData.filter(d => d.hours > 0).length).toFixed(1)
                                            : '0'}h
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="hover:shadow-lg transition-shadow">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">Most Productive Day</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl ">
                                        {(() => {
                                            if (dailyData.length === 0) return 'N/A'
                                            const max = dailyData.reduce((prev, current) => (prev.hours > current.hours) ? prev : current)
                                            return max.hours > 0 ? max.date : 'N/A'
                                        })()}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {(() => {
                                            if (dailyData.length === 0) return 'No data'
                                            const max = dailyData.reduce((prev, current) => (prev.hours > current.hours) ? prev : current)
                                            return max.hours > 0 ? `${max.hours} hours` : 'No hours logged'
                                        })()}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="hover:shadow-lg transition-shadow">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">Days with Submissions</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl ">
                                        {dailyData.filter(d => d.submissions > 0).length}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="status" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <BarChart3 className="h-5 w-5 text-indigo-600" />
                                            Daily Status Breakdown
                                        </CardTitle>
                                        <CardDescription>Verified, pending, and rejected by day</CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => exportToCSV(dailyData.map(d => ({ Date: d.date, Verified: d.verified, Pending: d.pending, Rejected: d.rejected })), 'daily_status_breakdown')}>
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[400px]">
                                    <Bar data={dailyStatusData} options={{ ...stackedBarOptions, maintainAspectRatio: false }} />
                                </div>
                            </CardContent>
                        </Card>

                        {/* <div className="grid gap-4 md:grid-cols-3">
                            <Card className="border-green-500/50 hover:shadow-lg transition-shadow">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                        Verified
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl  text-green-600">{analyticsStats.verified}</div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {analyticsStats.total > 0 ? Math.round((analyticsStats.verified / analyticsStats.total) * 100) : 0}% of total
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="border-amber-500/50 hover:shadow-lg transition-shadow">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-amber-500" />
                                        Pending
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl  text-amber-600">{analyticsStats.pending}</div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {analyticsStats.total > 0 ? Math.round((analyticsStats.pending / analyticsStats.total) * 100) : 0}% of total
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="border-red-500/50 hover:shadow-lg transition-shadow">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                        <XCircle className="h-4 w-4 text-red-500" />
                                        Rejected
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl  text-red-600">{analyticsStats.rejected}</div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {analyticsStats.total > 0 ? Math.round((analyticsStats.rejected / analyticsStats.total) * 100) : 0}% of total
                                    </p>
                                </CardContent>
                            </Card>
                        </div> */}
                    </TabsContent>
                </Tabs>

                {/* Assignments Overview */}
                {/* <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                        
                            Active Assignments
                        </CardTitle>
                        <CardDescription>Your current responsibility assignments</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl  text-blue-600">{assignments.length}</div>
                        <p className="text-sm text-muted-foreground mt-1">
                            {assignments.filter(a => a.status === 'PENDING').length} pending, {' '}
                            {assignments.filter(a => a.status === 'IN_PROGRESS').length} in progress
                        </p>
                    </CardContent>
                </Card> */}
            </div>

            {/* Quick Links */}
            {/* <div className="grid gap-4 md:grid-cols-3">
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
            </div> */}
        </div>
    )
}