"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
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
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, addDays } from "date-fns"
import {
    getSubmissionsForDate,
    getDayStatus,
    getActiveUnsubmittedAssignments,
    getSubmittedAssignmentsForDate,
    getToday,
    getAssignmentStatusForDate,
} from "@/lib/responsibility-status"
import ReactECharts from 'echarts-for-react'
import { ECHARTS_COMMON_OPTS, ECHARTS_PALETTE } from '@/lib/echarts-theme'
import { StaffExportDialog } from '@/components/export-dialog'

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
    const [calendarView, setCalendarView] = useState<'month' | 'week' | 'list'>('month')

    // Data states
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [todaySubmissions, setTodaySubmissions] = useState<WorkSubmission[]>([])
    const [allSubmissions, setAllSubmissions] = useState<WorkSubmission[]>([])
    const [staffCreatedAt, setStaffCreatedAt] = useState<string | null>(null)
    const [employeeName, setEmployeeName] = useState<string | null>(null)

    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 30),
        to: new Date(),
    })
    const [lookbackDays, setLookbackDays] = useState(7)

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
            
            const [assignmentsData, submissionsData, employeeData, allSettings] = await Promise.all([
                api.assignments.getAll(),
                api.workSubmissions.getAll(),
                employeePromise,
                api.settings.getAll(),
            ])

            const lookbackSetting = allSettings.find(s => s.key === 'work_submission_lookback_days')
            if (lookbackSetting && !isNaN(Number(lookbackSetting.value))) {
                setLookbackDays(Number(lookbackSetting.value))
            }

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

    // ECharts Configurations
    const statusDonutOption = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '10%', top: '5%', bottom: '5%', containLabel: true },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        xAxis: { type: 'value', show: false },
        yAxis: { 
            type: 'category', 
            data: ['Verified', 'Pending', 'Rejected'],
            axisTick: { show: false },
            axisLine: { show: false },
            axisLabel: { fontWeight: '500' }
        },
        series: [{
            name: 'Submissions',
            type: 'bar',
            barWidth: '50%',
            data: [
                { value: analyticsStats.verified, itemStyle: { color: '#85C170' } },
                { value: analyticsStats.pending, itemStyle: { color: '#F5C242' } },
                { value: analyticsStats.rejected, itemStyle: { color: '#F2846B' } }
            ],
            label: { 
                show: true, 
                position: 'right', 
                formatter: '{c}', 
                color: 'inherit', 
                fontWeight: 'bold',
                fontSize: 14
            },
            itemStyle: { borderRadius: [0, 4, 4, 0] }
        }]
    };

    const respMap = new Map<string, number>();
    filteredSubmissions.forEach(s => {
        const title = s.assignment?.responsibility?.title || 'Unknown';
        const hours = (s as any).hoursWorked || 0;
        respMap.set(title, (respMap.get(title) || 0) + hours);
    });
    const respEntries = Array.from(respMap.entries()).sort((a, b) => b[1] - a[1]);
    
    const responsibilityHoursOption = {
        color: ECHARTS_PALETTE,
        tooltip: { trigger: 'item', formatter: '{b}: {c}h' },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        series: [{
            name: 'Hours Worked',
            type: 'sunburst',
            radius: ['20%', '90%'],
            data: respEntries.map(([t, h]) => ({
                name: t.length > 20 ? t.substring(0, 18) + '...' : t,
                value: Math.round(h * 10) / 10
            })),
            label: { show: true, formatter: '{b}' }
        }]
    };

    const weeklyBarOption = {
        color: ['#4A90D9', '#85C170'],
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { bottom: 0, left: 'center' },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        xAxis: { type: 'category', boundaryGap: false, data: weeklyData.map(d => d.week) },
        yAxis: { type: 'value' },
        series: [
            { name: 'Responsibilities', type: 'line', smooth: true, lineStyle: { width: 2 }, data: weeklyData.map(d => d.submissions) },
            { name: 'Hours', type: 'line', smooth: true, lineStyle: { width: 2 }, data: weeklyData.map(d => d.hours) }
        ]
    };

    const hoursTrendOption = {
        color: ['#85C170'],
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { top: 0 },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        xAxis: { type: 'category', boundaryGap: false, data: dailyData.map(d => d.date) },
        yAxis: { type: 'value', name: 'Hours' },
        dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            { type: 'slider', start: 0, end: 100, height: 16, bottom: 0 }
        ],
        series: [
            { name: 'Hours Worked', type: 'line', smooth: false, showSymbol: false, lineStyle: { width: 1.5 }, areaStyle: { opacity: 0.1 }, data: dailyData.map(d => d.hours) }
        ]
    };

    const dailyStatusOption = {
        color: ['#85C170', '#F5C242', '#F2846B'],
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { top: 0 },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        xAxis: { type: 'category', data: dailyData.map(d => d.date) },
        yAxis: { type: 'value' },
        dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            { type: 'slider', start: 0, end: 100, height: 16, bottom: 0 }
        ],
        series: [
            { name: 'Verified', type: 'bar', stack: 'total', data: dailyData.map(d => d.verified) },
            { name: 'Pending', type: 'bar', stack: 'total', data: dailyData.map(d => d.pending) },
            { name: 'Rejected', type: 'bar', stack: 'total', data: dailyData.map(d => d.rejected) }
        ]
    };

    // Chart Options
    const pieChartOptions = {

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

    const router = useRouter()

    const { submittedDates, missingDates } = useMemo(() => {
        const submitted: Date[] = []
        const missing: Date[] = []
        
        const todayStart = new Date()
        todayStart.setHours(0,0,0,0)

        // Check past lookbackDays for indicators (today is excluded - it isn't "missed" until the day is over)
        for (let i = 1; i <= lookbackDays; i++) {
            const date = new Date(todayStart)
            date.setDate(date.getDate() - i)
            const dateSubmissions = getSubmissionsForDate(allSubmissions, date)
            if (dateSubmissions.length > 0) {
                submitted.push(date)
            } else {
                missing.push(date)
            }
        }
        return { submittedDates: submitted, missingDates: missing }
    }, [allSubmissions, lookbackDays])

    // Week & List View Logic (must be before conditional returns for React hooks rule)
    const currentWeekDays = useMemo(() => {
        const start = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
        return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
    }, [today]);

    const listDays = useMemo(() => {
        const start = subDays(today, (lookbackDays * 2) - 1); // Show double the lookback days in list view
        return eachDayOfInterval({ start, end: today }).reverse();
    }, [today, lookbackDays]);

    if (isLoading) {
        return (
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48" />
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
    const getDayStatusCategory = (day: Date) => {
        const todayStart = new Date(today)
        todayStart.setHours(0,0,0,0)
        const dayStart = new Date(day)
        dayStart.setHours(0,0,0,0)
        
        if (dayStart > todayStart) return 'future'
        
        const daySubmissions = getSubmissionsForDate(allSubmissions, dayStart)
        if (daySubmissions.length > 0) {
            const hasVerified = daySubmissions.some(s => s.status === 'VERIFIED')
            const hasPending = daySubmissions.some(s => s.status === 'SUBMITTED' || s.status === 'PENDING')
            const hasRejected = daySubmissions.some(s => s.status === 'REJECTED')
            
            if (hasVerified) return 'approved'
            if (hasPending) return 'pending'
            if (hasRejected) return 'missed' 
            return 'submitted'
        }
        
        if (dayStart < todayStart) return 'missing'
        return 'no-data'
    }

    const renderStatusBadge = (status: string) => {
        switch (status) {
            case 'approved': return <div className="px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">Approved</div>;
            case 'pending': return <div className="px-2 py-1 rounded-md text-xs font-medium bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">Pending</div>;
            case 'submitted': return <div className="px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">Submitted</div>;
            case 'missed':
            case 'missing': return <div className="px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">Missed</div>;
            case 'no-data': return <div className="px-2 py-1 rounded-md text-xs font-medium bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">No Data</div>;
            case 'future': return <div className="px-2 py-1 rounded-md text-xs font-medium text-muted-foreground">Upcoming</div>;
            default: return null;
        }
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

            <div className="my-10 bg-card rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border/50 p-6 md:p-8 flex flex-col lg:flex-row gap-8 lg:gap-12 w-full max-w-6xl mx-auto">
                {/* Left Side: Title and Description */}
                <div className="w-full lg:w-1/3 space-y-4 pt-2">
                    <div className="flex items-center gap-3">
                        {/* <CalendarCheck className="h-8 w-8 text-foreground" /> */}
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                            Submit Your Responsibilities
                        </h2>
                    </div>
                    <p className="text-muted-foreground text-base">
                        Select a date on the calendar to view or submit your responsibilities.
                    </p>
                </div>

                {/* Right Side: Wide Calendar & Legend */}
                <div className="w-full lg:w-2/3 flex flex-col gap-6">
                    <div className="w-full border rounded-xl overflow-hidden bg-background relative min-h-[450px]">
                        {/* Month / Week / List View Toggles Overlay */}
                        <div className="absolute top-[22px] right-[70px] z-20 hidden md:flex items-center bg-muted/30 p-1 rounded-lg border border-border/50">
                            <button 
                                onClick={() => setCalendarView('month')}
                                className={`px-4 py-1.5 font-semibold text-sm rounded-md transition-all ${calendarView === 'month' ? 'bg-background text-primary shadow-[0_1px_3px_rgb(0,0,0,0.1)]' : 'text-muted-foreground hover:text-foreground'}`}>Month</button>
                            <button 
                                onClick={() => setCalendarView('week')}
                                className={`px-4 py-1.5 font-semibold text-sm rounded-md transition-all ${calendarView === 'week' ? 'bg-background text-primary shadow-[0_1px_3px_rgb(0,0,0,0.1)]' : 'text-muted-foreground hover:text-foreground'}`}>Week</button>
                            <button 
                                onClick={() => setCalendarView('list')}
                                className={`px-4 py-1.5 font-semibold text-sm rounded-md transition-all ${calendarView === 'list' ? 'bg-background text-primary shadow-[0_1px_3px_rgb(0,0,0,0.1)]' : 'text-muted-foreground hover:text-foreground'}`}>List</button>
                        </div>

                        {calendarView === 'month' && (
                            <CalendarComponent
                                mode="single"
                                onSelect={(date) => {
                                    if (date) {
                                        router.push(`/staff/work-calendar/${format(date, 'yyyy-MM-dd')}`)
                                    }
                                }}
                                className="w-full p-6 [&_.rdp]:w-full [&_.rdp-months]:w-full [&_.rdp-month]:w-full [&_.rdp-table]:w-full [&_.rdp-head_row]:flex [&_.rdp-head_row]:w-full [&_.rdp-head_cell]:flex-1 [&_.rdp-row]:flex [&_.rdp-row]:w-full [&_.rdp-cell]:flex-1 [&_.rdp-button]:w-full [&_.rdp-button]:h-12 sm:[&_.rdp-button]:h-14 [&_.rdp-button]:rounded-md [&_.rdp-caption]:w-full [&_.rdp-caption_label]:text-lg [&_.rdp-caption_label]:font-semibold"
                                disabled={(date) => {
                                    const todayStart = new Date()
                                    todayStart.setHours(0,0,0,0)
                                    const minDate = new Date(todayStart)
                                    minDate.setDate(minDate.getDate() - lookbackDays)
                                    return date > todayStart || date < minDate
                                }}
                                modifiers={{
                                    submitted: submittedDates,
                                    missing: missingDates,
                                }}
                                modifiersClassNames={{
                                    submitted: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium border border-green-200 dark:border-green-800",
                                    missing: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium border border-amber-200 dark:border-amber-800",
                                }}
                            />
                        )}

                        {calendarView === 'week' && (
                            <div className="w-full h-full min-h-[400px] p-6 pt-16 md:pt-6">
                                <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mt-8">
                                    {currentWeekDays.map((day, i) => {
                                        const status = getDayStatusCategory(day);
                                        return (
                                            <div 
                                                key={i}
                                                onClick={() => {
                                                    if (status !== 'future') {
                                                        router.push(`/staff/work-calendar/${format(day, 'yyyy-MM-dd')}`)
                                                    }
                                                }}
                                                className={`flex flex-col items-center justify-center p-4 border transition-all ${status === 'future' ? 'opacity-50 pointer-events-none' : 'hover:border-primary/50 cursor-pointer hover:shadow-md bg-card'}`}
                                            >
                                                <span className="tracking-wider mb-2">{format(day, 'EEE')}</span>
                                                <span className={`mb-4 ${isSameDay(day, today) ? '' : ''}`}>{format(day, 'd')}</span>
                                                {renderStatusBadge(status)}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {calendarView === 'list' && (
                            <div className="w-full h-full min-h-[400px] p-6 pt-16 md:pt-6">
                                <div className="flex flex-col gap-2 overflow-y-auto max-h-[500px] pr-2 mt-8">
                                    {listDays.map((day, i) => {
                                        const status = getDayStatusCategory(day);
                                        return (
                                            <div 
                                                key={i}
                                                onClick={() => router.push(`/staff/work-calendar/${format(day, 'yyyy-MM-dd')}`)}
                                                className="flex items-center justify-between p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 flex items-center justify-center ${isSameDay(day, today) ? '' : ''}`}>
                                                        {format(day, 'd')}
                                                    </div>
                                                    <div>
                                                        <h4 className="">{format(day, 'EEEE')}</h4>
                                                        <p className="">{format(day, 'MMMM yyyy')}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {renderStatusBadge(status)}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground px-2">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-sm bg-green-50 border border-green-200 dark:bg-green-900/30 dark:border-green-800"></div> 
                            Approved
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="dark:bg-white dark:border-amber-800"></div> 
                            Pending
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="dark:bg-white"></div> 
                            Missed
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="dark:bg-white"></div> 
                            No Data
                        </div>
                    </div>
                </div>
            </div>

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
                            {/* <BarChart3 className="h-4 w-4 text-blue-600" /> */}
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl  ">{analyticsStats.total}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {analyticsStats.totalHours.toFixed(1)} hours logged
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
                            {/* <TrendingUp className="h-4 w-4 text-green-600" /> */}
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl ">{analyticsStats.approvalRate}%</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {analyticsStats.verified} verified of {analyticsStats.total}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                            {/* <Clock className="h-4 w-4 text-amber-600" /> */}
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl  ">{analyticsStats.pending}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Awaiting manager verification
                            </p>
                        </CardContent>
                    </Card>
                    
                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                            {/* <FileCheck className="h-4 w-4 text-purple-600" /> */}
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl  ">{analyticsStats.totalHours.toFixed(1)}h</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                total work hours
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Verified Hours</CardTitle>
                            {/* <FileCheck className="h-4 w-4 text-purple-600" /> */}
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl  ">{analyticsStats.verifiedHours.toFixed(1)}h</div>
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
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                {/* <Activity className="h-5 w-5 text-blue-600" /> */}
                                                Status Distribution
                                            </CardTitle>
                                            <CardDescription>Breakdown by submission status</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex justify-center">
                                    <div className="w-full min-h-[300px]">
                                        {analyticsStats.total > 0 ? (
                                            <ReactECharts option={statusDonutOption} style={{ height: '300px', width: '100%' }} />
                                        ) : (
                                            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                                                No submissions in selected period
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Hours by Responsibility Bar Chart */}
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                {/* <TrendingUp className="h-5 w-5 text-indigo-600" /> */}
                                                Hours by Responsibility
                                            </CardTitle>
                                            <CardDescription>Total hours worked per responsibility</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {respEntries.length > 0 ? (
                                        <ReactECharts option={responsibilityHoursOption} style={{ height: '300px', width: '100%' }} />
                                    ) : (
                                        <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                                            No submission data in selected period
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Weekly Comparison */}
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            {/* <BarChart3 className="h-5 w-5 text-purple-600" /> */}
                                            Weekly Comparison
                                        </CardTitle>
                                        <CardDescription>Responsibilities and hours by week</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ReactECharts option={weeklyBarOption} style={{ height: '300px', width: '100%' }} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="hours" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            {/* <Clock className="h-5 w-5 text-green-600" /> */}
                                            Hours Logged Over Time
                                        </CardTitle>
                                        <CardDescription>Daily hours worked trend</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="w-full min-h-[400px]">
                                    <ReactECharts option={hoursTrendOption} style={{ height: '400px', width: '100%' }} />
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
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            {/* <BarChart3 className="h-5 w-5 text-indigo-600" /> */}
                                            Daily Status Breakdown
                                        </CardTitle>
                                        <CardDescription>Verified, pending, and rejected by day</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="w-full min-h-[400px]">
                                    <ReactECharts option={dailyStatusOption} style={{ height: '400px', width: '100%' }} />
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