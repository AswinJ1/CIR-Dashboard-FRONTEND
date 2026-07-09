"use client"

import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@/components/providers/auth-context"
import { api } from "@/lib/api"
import { WorkSubmission, Assignment, Employee, Responsibility, SubDepartment } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    BarChart3,
    TrendingUp,
    FileCheck,
    Clock,
    CalendarIcon,
    CheckCircle,
    XCircle,
    Users,
    Target,
    Activity,
    ChevronRight,
    Briefcase,
} from "lucide-react"
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns"
import ReactECharts from 'echarts-for-react'
import { ECHARTS_COMMON_OPTS, ECHARTS_PALETTE } from '@/lib/echarts-theme'

type DateRange = {
    from: Date
    to: Date
}

export default function ManagerAnalyticsPage() {
    const { user } = useAuth()
    const [isLoading, setIsLoading] = useState(true)
    const [submissions, setSubmissions] = useState<WorkSubmission[]>([])
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [staffList, setStaffList] = useState<Employee[]>([])
    const [responsibilities, setResponsibilities] = useState<Responsibility[]>([])
    const [subDepartment, setSubDepartment] = useState<SubDepartment | null>(null)
    const [selectedStaffId, setSelectedStaffId] = useState<string>("all")
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 30),
        to: new Date(),
    })

    useEffect(() => {
        fetchData()
    }, [user])

    async function fetchData() {
        if (!user?.subDepartmentId) return

        try {
            const [allSubmissions, allAssignments, allEmployees, allResponsibilities, allSubDepts] = await Promise.all([
                api.workSubmissions.getAll(),
                api.assignments.getAll(),
                api.employees.getAll(),
                api.responsibilities.getAll(),
                api.subDepartments.getAll(),
            ])

            // Get manager's sub-department
            const managerSubDept = allSubDepts.find(sd => String(sd.id) === String(user.subDepartmentId))
            setSubDepartment(managerSubDept || null)

            // Filter staff in manager's sub-department
            const deptStaff = allEmployees.filter(e =>
                String(e.subDepartmentId) === String(user.subDepartmentId) && e.role === 'STAFF'
            )
            setStaffList(deptStaff)

            // Get staff IDs
            const staffIds = deptStaff.map(s => String(s.id))

            // Filter submissions and assignments for staff in this sub-department
            setSubmissions(allSubmissions.filter(s => staffIds.includes(String(s.staffId))))
            setAssignments(allAssignments.filter(a => staffIds.includes(String(a.staffId))))

            // Filter responsibilities for this sub-department
            setResponsibilities(allResponsibilities.filter(r =>
                String(r.subDepartmentId) === String(user.subDepartmentId)
            ))
        } catch (error) {
            console.error("Failed to fetch analytics data:", error)
        } finally {
            setIsLoading(false)
        }
    }

    // Filter by date and optionally by selected staff
    const filteredSubmissions = useMemo(() => {
        return submissions.filter(s => {
            const date = new Date(s.workDate || s.submittedAt)
            const inDateRange = date >= dateRange.from && date <= dateRange.to
            const matchesStaff = selectedStaffId === "all" || String(s.staffId) === selectedStaffId
            return inDateRange && matchesStaff
        })
    }, [submissions, dateRange, selectedStaffId])

    // Overall stats
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

    // Per-staff stats
    const staffStats = useMemo(() => {
        return staffList.map(staff => {
            const staffSubmissions = filteredSubmissions.filter(s => String(s.staffId) === String(staff.id))
            const verified = staffSubmissions.filter(s => s.status === 'VERIFIED').length
            const pending = staffSubmissions.filter(s => s.status === 'SUBMITTED' || s.status === 'PENDING').length
            const rejected = staffSubmissions.filter(s => s.status === 'REJECTED').length
            const hours = staffSubmissions
                .filter(s => s.status === 'VERIFIED')
                .reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)
            const approvalRate = staffSubmissions.length > 0 ? Math.round((verified / staffSubmissions.length) * 100) : 0

            return {
                ...staff,
                total: staffSubmissions.length,
                verified,
                pending,
                rejected,
                hours: Math.round(hours * 10) / 10,
                approvalRate,
            }
        }).sort((a, b) => b.total - a.total)
    }, [staffList, filteredSubmissions])

    // Daily data for charts
    const dailyData = useMemo(() => {
        const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to })

        return days.map(day => {
            const daySubmissions = filteredSubmissions.filter(s =>
                isSameDay(new Date(s.workDate || s.submittedAt), day)
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

    // Responsibility stats
    const responsibilityStats = useMemo(() => {
        return responsibilities.map(resp => {
            const respAssignments = assignments.filter(a => String(a.responsibilityId) === String(resp.id))
            const assignedStaff = new Set(respAssignments.map(a => String(a.staffId))).size
            const respSubmissions = filteredSubmissions.filter(s =>
                respAssignments.some(a => String(a.id) === String(s.assignmentId))
            )
            const verified = respSubmissions.filter(s => s.status === 'VERIFIED').length

            return {
                ...resp,
                assignedStaff,
                totalSubmissions: respSubmissions.length,
                verified,
                completionRate: respSubmissions.length > 0 ? Math.round((verified / respSubmissions.length) * 100) : 0,
            }
        }).sort((a, b) => b.totalSubmissions - a.totalSubmissions)
    }, [responsibilities, assignments, filteredSubmissions])

    // ECharts Configurations
    const statusDonutOption = {
        color: ['#85C170', '#F5C242', '#F2846B'], // Verified, Pending, Rejected
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: 0, left: 'center', itemStyle: { borderWidth: 0 } },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        series: [{
            name: 'Status',
            type: 'pie',
            radius: '75%',
            center: ['50%', '45%'],
            itemStyle: { borderColor: '#fff', borderWidth: 2 },
            label: { show: true, position: 'inside', formatter: '{d}%', color: '#fff', fontSize: 12, fontWeight: 'bold' },
            labelLine: { show: false },
            data: [
                { value: stats.verified, name: 'Verified' },
                { value: stats.pending, name: 'Pending' },
                { value: stats.rejected, name: 'Rejected' }
            ]
        }]
    };

    const dailySubmissionsOption = {
        color: ['#4A90D9', '#85C170'],
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { top: 0 },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        xAxis: { type: 'category', boundaryGap: false, data: dailyData.map(d => d.date) },
        yAxis: { type: 'value' },
        dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            { type: 'slider', start: 0, end: 100, height: 16, bottom: 0 }
        ],
        series: [
            { name: 'Total Submissions', type: 'line', smooth: false, showSymbol: false, lineStyle: { width: 1.5 }, areaStyle: { opacity: 0.1 }, data: dailyData.map(d => d.submissions) },
            { name: 'Verified', type: 'line', smooth: false, showSymbol: false, lineStyle: { width: 1.5 }, data: dailyData.map(d => d.verified) }
        ]
    };

    const staffComparisonOption = {
        color: ['#85C170', '#F5C242', '#F2846B'],
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { top: 0 },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        xAxis: { type: 'category', data: staffStats.slice(0, 10).map(s => s.name.split(' ')[0]) },
        yAxis: { type: 'value' },
        series: [
            { name: 'Verified', type: 'bar', stack: 'total', data: staffStats.slice(0, 10).map(s => s.verified) },
            { name: 'Pending', type: 'bar', stack: 'total', data: staffStats.slice(0, 10).map(s => s.pending) },
            { name: 'Rejected', type: 'bar', stack: 'total', data: staffStats.slice(0, 10).map(s => s.rejected) }
        ]
    };

    const hoursChartOption = {
        color: ['#9B7ED9'],
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { top: 0 },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        xAxis: { type: 'category', boundaryGap: false, data: dailyData.map(d => d.date) },
        yAxis: { type: 'value' },
        dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            { type: 'slider', start: 0, end: 100, height: 16, bottom: 0 }
        ],
        series: [
            { name: 'Hours Worked', type: 'line', smooth: false, showSymbol: false, lineStyle: { width: 1.5 }, areaStyle: { opacity: 0.1 }, data: dailyData.map(d => d.hours) }
        ]
    };

    if (isLoading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
                </div>
                <Skeleton className="h-[400px]" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl  tracking-tight">Team Analytics</h1>
                    <p className="text-muted-foreground">
                        {subDepartment?.name || 'Sub-Department'} performance metrics and insights
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Staff Filter */}
                    <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                        <SelectTrigger className="w-[180px]">
                            <Users className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Select staff" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Staff</SelectItem>
                            {staffList.map(staff => (
                                <SelectItem key={staff.id} value={String(staff.id)}>
                                    {staff.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Date Range Picker */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <div className="flex gap-2 p-3 border-b">
                                <Button size="sm" variant="outline" onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}>
                                    7 days
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}>
                                    30 days
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}>
                                    This Month
                                </Button>
                            </div>
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={dateRange.from}
                                selected={dateRange}
                                onSelect={(range) => range?.from && range?.to && setDateRange({ from: range.from, to: range.to })}
                                numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
                        <Users className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl  text-blue-600">{staffList.length}</div>
                        <p className="text-xs text-muted-foreground">Active in sub-department</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                        <BarChart3 className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl  text-indigo-600">{stats.total}</div>
                        <p className="text-xs text-muted-foreground">{stats.totalHours.toFixed(1)} hours logged</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl  text-green-600">{stats.approvalRate}%</div>
                        <p className="text-xs text-muted-foreground">{stats.verified} verified of {stats.total}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl  text-amber-600">{stats.pending}</div>
                        <p className="text-xs text-muted-foreground">Awaiting verification</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Verified Hours</CardTitle>
                        <FileCheck className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl  text-purple-600">{stats.verifiedHours.toFixed(1)}h</div>
                        <p className="text-xs text-muted-foreground">Approved work hours</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview" className="gap-2">
                        <Activity className="h-4 w-4" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="staff" className="gap-2">
                        <Users className="h-4 w-4" />
                        Staff Performance
                    </TabsTrigger>
                    <TabsTrigger value="responsibilities" className="gap-2">
                        <Briefcase className="h-4 w-4" />
                        Responsibilities
                    </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    Daily Submissions
                                </CardTitle>
                                <CardDescription>Submissions trend over time</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    <ReactECharts option={dailySubmissionsOption} style={{ height: '100%', width: '100%' }} />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    Status Distribution
                                </CardTitle>
                                <CardDescription>Breakdown by submission status</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    {stats.total > 0 ? (
                                        <ReactECharts option={statusDonutOption} style={{ height: '100%', width: '100%' }} />
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground">
                                            No submissions in selected period
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Hours Trend
                            </CardTitle>
                            <CardDescription>Daily hours worked</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[250px]">
                                <ReactECharts option={hoursChartOption} style={{ height: '100%', width: '100%' }} />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Staff Performance Tab */}
                <TabsContent value="staff" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Staff Comparison
                            </CardTitle>
                            <CardDescription>Submissions breakdown by staff member</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px]">
                                <ReactECharts option={staffComparisonOption} style={{ height: '100%', width: '100%' }} />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Staff Details</CardTitle>
                            <CardDescription>Individual performance metrics</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px]">
                                <div className="space-y-3">
                                    {staffStats.map((staff) => (
                                        <div
                                            key={staff.id}
                                            className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                                                    {staff.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-medium">{staff.name}</p>
                                                    <p className="text-sm text-muted-foreground">{staff.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-center">
                                                    <p className="text-lg font-semibold">{staff.total}</p>
                                                    <p className="text-xs text-muted-foreground">Submissions</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                        <CheckCircle className="h-3 w-3 mr-1" />
                                                        {staff.verified}
                                                    </Badge>
                                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        {staff.pending}
                                                    </Badge>
                                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                                        <XCircle className="h-3 w-3 mr-1" />
                                                        {staff.rejected}
                                                    </Badge>
                                                </div>
                                                <div className="text-center min-w-[60px]">
                                                    <p className="text-lg font-semibold text-purple-600">{staff.hours}h</p>
                                                    <p className="text-xs text-muted-foreground">Hours</p>
                                                </div>
                                                <div className="text-center min-w-[60px]">
                                                    <p className={`text-lg font-semibold ${staff.approvalRate >= 80 ? 'text-green-600' : staff.approvalRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                        {staff.approvalRate}%
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">Approval</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {staffStats.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground">
                                            No staff members found in your sub-department
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Responsibilities Tab */}
                <TabsContent value="responsibilities" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Responsibilities Overview
                            </CardTitle>
                            <CardDescription>Performance by responsibility</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px]">
                                <div className="space-y-3">
                                    {responsibilityStats.map((resp) => (
                                        <div
                                            key={resp.id}
                                            className="p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Target className="h-4 w-4 text-indigo-500" />
                                                    <span className="font-medium">{resp.title}</span>
                                                </div>
                                                <Badge variant={resp.isActive ? "default" : "secondary"}>
                                                    {resp.isActive ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </div>
                                            {resp.description && (
                                                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{resp.description}</p>
                                            )}
                                            <div className="grid grid-cols-4 gap-4 text-center">
                                                <div className="p-2 rounded bg-muted">
                                                    <p className="text-lg font-semibold text-blue-600">{resp.assignedStaff}</p>
                                                    <p className="text-xs text-muted-foreground">Assigned</p>
                                                </div>
                                                <div className="p-2 rounded bg-muted">
                                                    <p className="text-lg font-semibold text-indigo-600">{resp.totalSubmissions}</p>
                                                    <p className="text-xs text-muted-foreground">Submissions</p>
                                                </div>
                                                <div className="p-2 rounded bg-muted">
                                                    <p className="text-lg font-semibold text-green-600">{resp.verified}</p>
                                                    <p className="text-xs text-muted-foreground">Verified</p>
                                                </div>
                                                <div className="p-2 rounded bg-muted">
                                                    <p className={`text-lg font-semibold ${resp.completionRate >= 80 ? 'text-green-600' : resp.completionRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                        {resp.completionRate}%
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">Completion</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {responsibilityStats.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground">
                                            No responsibilities found for your sub-department
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
