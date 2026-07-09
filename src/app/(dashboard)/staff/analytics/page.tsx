"use client"

import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@/components/providers/auth-context"
import { api } from "@/lib/api"
import { WorkSubmission, Assignment } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { 
    BarChart3, 
    TrendingUp, 
    FileCheck, 
    Clock, 
    CalendarIcon, 
    CheckCircle,
    XCircle,
    Target,
    Activity,
} from "lucide-react"
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns"
import ReactECharts from 'echarts-for-react'
import { ECHARTS_COMMON_OPTS, ECHARTS_PALETTE } from '@/lib/echarts-theme'

type DateRange = {
    from: Date
    to: Date
}

export default function StaffAnalyticsPage() {
    const { user } = useAuth()
    const [isLoading, setIsLoading] = useState(true)
    const [submissions, setSubmissions] = useState<WorkSubmission[]>([])
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 30),
        to: new Date(),
    })

    useEffect(() => {
        fetchData()
    }, [user])

    async function fetchData() {
        if (!user?.id) return
        
        try {
            const [allSubmissions, allAssignments] = await Promise.all([
                api.workSubmissions.getAll(),
                api.assignments.getAll(),
            ])
            // Convert both to strings for comparison since user.id from JWT may be number or string
            const userId = String(user.id)
            setSubmissions(allSubmissions.filter(s => String(s.staffId) === userId))
            setAssignments(allAssignments.filter(a => String(a.staffId) === userId))
        } catch (error) {
            console.error("Failed to fetch analytics data:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const filteredSubmissions = useMemo(() => {
        return submissions.filter(s => {
            // Use workDate if available, otherwise fallback to submittedAt
            const date = new Date(s.workDate || s.submittedAt)
            return date >= dateRange.from && date <= dateRange.to
        })
    }, [submissions, dateRange])

    const stats = useMemo(() => {
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

    // --- ECharts Option Definitions ---

    const statusDonutOption = useMemo(() => ({
        ...ECHARTS_COMMON_OPTS,
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: 0, left: 'center', textStyle: { fontSize: 12 } },
        series: [{
            type: 'treemap',
            roam: false,
            breadcrumb: { show: false },
            radius: ['45%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
            label: { show: false },
            emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
            data: [
                { value: stats.verified, name: 'Verified', itemStyle: { color: '#22c55e' } },
                { value: stats.pending, name: 'Pending', itemStyle: { color: '#f59e0b' } },
                { value: stats.rejected, name: 'Rejected', itemStyle: { color: '#ef4444' } },
            ].filter(d => d.value > 0)
        }]
    }), [stats])

    const dailySubmissionsOption = useMemo(() => ({
        ...ECHARTS_COMMON_OPTS,
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: dailyData.map(d => d.date), axisLabel: { rotate: 45, fontSize: 10 } },
        yAxis: { type: 'value', minInterval: 1 },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        series: [{
            name: 'Submissions',
            type: 'line',
            smooth: true,
            data: dailyData.map(d => d.submissions),
            areaStyle: { opacity: 0.15 },
            itemStyle: { color: ECHARTS_PALETTE[0] },
        }]
    }), [dailyData])

    const weeklyBarOption = useMemo(() => ({
        ...ECHARTS_COMMON_OPTS,
        tooltip: { trigger: 'axis' },
        legend: { data: ['Submissions', 'Hours'], bottom: 0 },
        xAxis: { type: 'category', data: weeklyData.map(w => w.week) },
        yAxis: [
            { type: 'value', name: 'Count', minInterval: 1 },
            { type: 'value', name: 'Hours', position: 'right' },
        ],
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        series: [
            { name: 'Submissions', type: 'bar', data: weeklyData.map(w => w.submissions), itemStyle: { color: ECHARTS_PALETTE[0], borderRadius: [4, 4, 0, 0] } },
            { name: 'Hours', type: 'bar', yAxisIndex: 1, data: weeklyData.map(w => w.hours), itemStyle: { color: ECHARTS_PALETTE[1], borderRadius: [4, 4, 0, 0] } },
        ]
    }), [weeklyData])

    const hoursTrendOption = useMemo(() => ({
        ...ECHARTS_COMMON_OPTS,
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: dailyData.map(d => d.date), axisLabel: { rotate: 45, fontSize: 10 } },
        yAxis: { type: 'value', name: 'Hours' },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        series: [{
            name: 'Hours',
            type: 'bar',
            data: dailyData.map(d => d.hours),
            itemStyle: { color: ECHARTS_PALETTE[4], borderRadius: [4, 4, 0, 0] },
        }]
    }), [dailyData])

    const dailyStatusOption = useMemo(() => ({
        ...ECHARTS_COMMON_OPTS,
        tooltip: { trigger: 'axis' },
        legend: { data: ['Verified', 'Pending', 'Rejected'], bottom: 0 },
        xAxis: { type: 'category', data: dailyData.map(d => d.date), axisLabel: { rotate: 45, fontSize: 10 } },
        yAxis: { type: 'value', minInterval: 1 },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        series: [
            { name: 'Verified', type: 'bar', stack: 'status', data: dailyData.map(d => d.verified), itemStyle: { color: '#22c55e', borderRadius: [0, 0, 0, 0] } },
            { name: 'Pending', type: 'bar', stack: 'status', data: dailyData.map(d => d.pending), itemStyle: { color: '#f59e0b' } },
            { name: 'Rejected', type: 'bar', stack: 'status', data: dailyData.map(d => d.rejected), itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] } },
        ]
    }), [dailyData])

    if (isLoading) {
        return (
            <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                    <Skeleton className="h-10 w-64" />
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl  tracking-tight">My Analytics</h1>
                    <p className="text-muted-foreground">Your personal performance metrics and insights</p>
                </div>
                
                {/* Date Range Picker */}
                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <div className="p-3 space-y-3">
                                <div className="flex gap-2">
                                    <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}
                                    >
                                        Last 7 days
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}
                                    >
                                        Last 30 days
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => setDateRange({ 
                                            from: startOfMonth(new Date()), 
                                            to: endOfMonth(new Date()) 
                                        })}
                                    >
                                        This Month
                                    </Button>
                                </div>
                                <Calendar
                                    mode="range"
                                    selected={{ from: dateRange.from, to: dateRange.to }}
                                    onSelect={(range) => {
                                        if (range?.from && range?.to) {
                                            setDateRange({ from: range.from, to: range.to })
                                        }
                                    }}
                                    numberOfMonths={2}
                                />
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                        <BarChart3 className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl  text-blue-600">{stats.total}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.totalHours.toFixed(1)} hours logged
                        </p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl  text-green-600">{stats.approvalRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.verified} verified of {stats.total}
                        </p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                        <Clock className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl  text-amber-600">{stats.pending}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Awaiting manager verification
                        </p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Verified Hours</CardTitle>
                        <FileCheck className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl  text-purple-600">{stats.verifiedHours.toFixed(1)}h</div>
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
                                <CardTitle className="flex items-center gap-2">
                                    Status Distribution
                                </CardTitle>
                                <CardDescription>Breakdown by submission status</CardDescription>
                            </CardHeader>
                            <CardContent className="flex justify-center">
                                <div className="w-full max-w-[280px]">
                                    {stats.total > 0 ? (
                                        <ReactECharts option={statusDonutOption} style={{ height: '100%', width: '100%' }} />
                                    ) : (
                                        <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                                            No submissions in selected period
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Daily Submissions Line Chart */}
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    Daily Submissions
                                </CardTitle>
                                <CardDescription>Number of submissions per day</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ReactECharts option={dailySubmissionsOption} style={{ height: '100%', width: '100%' }} />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Weekly Comparison */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Weekly Comparison
                            </CardTitle>
                            <CardDescription>Submissions and hours by week</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ReactECharts option={weeklyBarOption} style={{ height: '100%', width: '100%' }} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="hours" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Hours Logged Over Time
                            </CardTitle>
                            <CardDescription>Daily hours worked trend</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[400px]">
                                <ReactECharts option={hoursTrendOption} style={{ height: '100%', width: '100%' }} />
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
                                        ? (stats.totalHours / dailyData.filter(d => d.hours > 0).length).toFixed(1)
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
                                    {dailyData.length > 0 ? Math.max(...dailyData.map(d => d.hours)).toFixed(1) : '0'}h
                                </div>
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
                            <CardTitle className="flex items-center gap-2">
                                Daily Status Breakdown
                            </CardTitle>
                            <CardDescription>Verified, pending, and rejected by day</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[400px]">
                                <ReactECharts option={dailyStatusOption} style={{ height: '100%', width: '100%' }} />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="border-green-500/50 hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    Verified
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl  text-green-600">{stats.verified}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {stats.total > 0 ? Math.round((stats.verified / stats.total) * 100) : 0}% of total
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
                                <div className="text-3xl  text-amber-600">{stats.pending}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0}% of total
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
                                <div className="text-3xl  text-red-600">{stats.rejected}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {stats.total > 0 ? Math.round((stats.rejected / stats.total) * 100) : 0}% of total
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Assignments Overview */}
            <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {/* <Target className="h-5 w-5 text-blue-600" /> */}
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
            </Card>
        </div>
    )
}
