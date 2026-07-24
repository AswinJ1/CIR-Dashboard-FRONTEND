"use client"

import { useEffect, useState, useCallback, Suspense, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import { Department, SubDepartment, Employee, Assignment, WorkSubmission, Responsibility } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { SubmissionStatusBadge } from "@/components/ui/status-badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import {
    ArrowLeft,
    Mail,
    Building2,
    Users,
    Calendar as CalendarIcon,
    ClipboardList,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    TrendingUp,
    FileText,
    Activity,
    BarChart3,
    Eye,
    Target,
    ChevronLeft,
    ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns"
import { ColumnFilter } from "@/components/ui/column-filter"
import ReactECharts from 'echarts-for-react'
import { ECHARTS_COMMON_OPTS, ECHARTS_PALETTE } from '@/lib/echarts-theme'

type DateRange = { from: Date; to: Date }

function StaffDetailsContent({ staffId }: { staffId: string }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const departmentId = searchParams.get('departmentId')
    const subDepartmentId = searchParams.get('subDepartmentId')

    const [department, setDepartment] = useState<Department | null>(null)
    const [subDepartment, setSubDepartment] = useState<SubDepartment | null>(null)
    const [staff, setStaff] = useState<Employee | null>(null)
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [submissions, setSubmissions] = useState<WorkSubmission[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [hasFetched, setHasFetched] = useState(false)
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 30),
        to: new Date()
    })

    // View responsibility dialog state
    const [viewResponsibilityDialogOpen, setViewResponsibilityDialogOpen] = useState(false)
    const [selectedResponsibility, setSelectedResponsibility] = useState<Responsibility | null>(null)
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)

    // Pagination state
    const ITEMS_PER_PAGE = 10
    const [assignmentsPage, setAssignmentsPage] = useState(1)
    const [submissionsPage, setSubmissionsPage] = useState(1)

    // Activity card date filter
    const [activityFilterDate, setActivityFilterDate] = useState<Date | null>(null)

    // Column filter state for Assignments tab
    const [colAssignRespFilter, setColAssignRespFilter] = useState<string[]>([])
    const [colAssignCycleFilter, setColAssignCycleFilter] = useState<string[]>([])
    const [colAssignStatusFilter, setColAssignStatusFilter] = useState<string[]>([])

    // Column filter state for Submissions tab
    const [colSubRespFilter, setColSubRespFilter] = useState<string[]>([])
    const [colSubStatusFilter, setColSubStatusFilter] = useState<string[]>([])

    // Column filter options for Assignments
    const assignRespOptions = useMemo(() => {
        const set = new Set<string>()
        assignments.forEach(a => { if (a.responsibility?.title) set.add(a.responsibility.title) })
        return Array.from(set).sort()
    }, [assignments])

    const assignCycleOptions = useMemo(() => {
        const set = new Set<string>()
        assignments.forEach(a => set.add(a.responsibility?.cycle || 'N/A'))
        return Array.from(set).sort()
    }, [assignments])

    const assignStatusOptions = useMemo(() => {
        const set = new Set<string>()
        assignments.forEach(a => { if (a.status) set.add(a.status) })
        return Array.from(set).sort()
    }, [assignments])

    // Column filter options for Submissions
    const subRespOptions = useMemo(() => {
        const set = new Set<string>()
        submissions.forEach(s => set.add(s.assignment?.responsibility?.title || 'N/A'))
        return Array.from(set).sort()
    }, [submissions])

    const subStatusOptions = useMemo(() => {
        const set = new Set<string>()
        submissions.forEach(s => { if (s.status) set.add(s.status) })
        return Array.from(set).sort()
    }, [submissions])

    // Paginated data
    const activityAssignments = useMemo(() => {
        let filtered = assignments
        if (activityFilterDate) {
            filtered = filtered.filter(a => isSameDay(new Date(a.assignedAt), activityFilterDate))
        }
        if (colAssignRespFilter.length > 0) {
            filtered = filtered.filter(a => colAssignRespFilter.includes(a.responsibility?.title || ''))
        }
        if (colAssignCycleFilter.length > 0) {
            filtered = filtered.filter(a => colAssignCycleFilter.includes(a.responsibility?.cycle || 'N/A'))
        }
        if (colAssignStatusFilter.length > 0) {
            filtered = filtered.filter(a => colAssignStatusFilter.includes(a.status || ''))
        }
        return filtered
    }, [assignments, activityFilterDate, colAssignRespFilter, colAssignCycleFilter, colAssignStatusFilter])

    const activitySubmissions = useMemo(() => {
        let filtered = submissions
        if (activityFilterDate) {
            filtered = filtered.filter(s => isSameDay(new Date(s.workDate || s.submittedAt), activityFilterDate))
        }
        if (colSubRespFilter.length > 0) {
            filtered = filtered.filter(s => colSubRespFilter.includes(s.assignment?.responsibility?.title || 'N/A'))
        }
        if (colSubStatusFilter.length > 0) {
            filtered = filtered.filter(s => colSubStatusFilter.includes(s.status || ''))
        }
        return filtered
    }, [submissions, activityFilterDate, colSubRespFilter, colSubStatusFilter])

    const assignmentsTotalPages = Math.ceil(activityAssignments.length / ITEMS_PER_PAGE)
    const paginatedAssignments = useMemo(() => {
        const start = (assignmentsPage - 1) * ITEMS_PER_PAGE
        return activityAssignments.slice(start, start + ITEMS_PER_PAGE)
    }, [activityAssignments, assignmentsPage])

    const submissionsTotalPages = Math.ceil(activitySubmissions.length / ITEMS_PER_PAGE)
    const paginatedSubmissions = useMemo(() => {
        const start = (submissionsPage - 1) * ITEMS_PER_PAGE
        return activitySubmissions.slice(start, start + ITEMS_PER_PAGE)
    }, [activitySubmissions, submissionsPage])

    function openViewResponsibilityDialog(assignment: Assignment) {
        setSelectedAssignment(assignment)
        setSelectedResponsibility(assignment.responsibility || null)
        setViewResponsibilityDialogOpen(true)
    }

    const fetchData = useCallback(async () => {
        if (hasFetched) return

        try {
            setHasFetched(true)
            const [depts, allSubDepts, allEmployees, allAssignments, allSubmissions] = await Promise.all([
                api.departments.getAll(),
                api.subDepartments.getAll(),
                api.employees.getAll(),
                api.assignments.getAll(),
                api.workSubmissions.getAll(),
            ])

            const currentStaff = allEmployees.find(e => String(e.id) === staffId)
            if (!currentStaff) {
                toast.error("Staff member not found")
                router.push('/admin/departments')
                return
            }

            const currentDept = depts.find(d => String(d.id) === (departmentId || String(currentStaff.departmentId)))
            const currentSubDept = allSubDepts.find(sd => String(sd.id) === (subDepartmentId || String(currentStaff.subDepartmentId)))

            setDepartment(currentDept || null)
            setSubDepartment(currentSubDept || null)
            setStaff(currentStaff)
            setAssignments(allAssignments.filter(a => String(a.staffId) === staffId))
            setSubmissions(allSubmissions.filter(s => String(s.staffId) === staffId))
        } catch (error) {
            console.error("Failed to fetch data:", error)
            toast.error("Failed to load staff details")
            setHasFetched(false)
        } finally {
            setIsLoading(false)
        }
    }, [staffId, departmentId, subDepartmentId, hasFetched, router])

    useEffect(() => {
        if (staffId && !hasFetched) {
            fetchData()
        }
    }, [staffId, hasFetched, fetchData])

    function getInitials(name: string): string {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
    }

    function getSubmissionStats() {
        const pending = submissions.filter(s => s.status === 'PENDING' || s.status === 'SUBMITTED').length
        const verified = submissions.filter(s => s.status === 'VERIFIED').length
        const rejected = submissions.filter(s => s.status === 'REJECTED').length
        return { pending, verified, rejected, total: submissions.length }
    }

    const stats = getSubmissionStats()

    // Filter submissions by date range
    const filteredSubmissions = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return submissions
        return submissions.filter(s => {
            const submitDate = new Date(s.submittedAt)
            return submitDate >= dateRange.from && submitDate <= dateRange.to
        })
    }, [submissions, dateRange])

    // Analytics stats
    const analyticsStats = useMemo(() => {
        const total = filteredSubmissions.length
        const verified = filteredSubmissions.filter(s => s.status === 'VERIFIED').length
        const pending = filteredSubmissions.filter(s => s.status === 'PENDING' || s.status === 'SUBMITTED').length
        const rejected = filteredSubmissions.filter(s => s.status === 'REJECTED').length
        const hours = filteredSubmissions
            .filter(s => s.status === 'VERIFIED')
            .reduce((acc, s) => acc + (s.hoursWorked || 0), 0)
        const approvalRate = total > 0 ? Math.round((verified / total) * 100) : 0

        return { total, verified, pending, rejected, hours, approvalRate }
    }, [filteredSubmissions])

    // Daily chart data
    const dailyChartData = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return []
        const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to })
        return days.map(day => {
            const daySubmissions = filteredSubmissions.filter(s =>
                isSameDay(new Date(s.submittedAt), day)
            )
            const verified = daySubmissions.filter(s => s.status === 'VERIFIED')
            return {
                date: format(day, 'MMM dd'),
                submissions: daySubmissions.length,
                verified: verified.length,
                hours: verified.reduce((acc, s) => acc + (s.hoursWorked || 0), 0),
            }
        })
    }, [filteredSubmissions, dateRange])

    // Responsibility hours data
    const responsibilityHoursData = useMemo(() => {
        const respMap = new Map<string, number>()
        filteredSubmissions.forEach(s => {
            const title = s.assignment?.responsibility?.title || 'Unknown'
            const hours = (s as any).hoursWorked || 0
            respMap.set(title, (respMap.get(title) || 0) + hours)
        })
        const entries = Array.from(respMap.entries()).sort((a, b) => b[1] - a[1])
        return {
            _fullTitles: entries.map(([t]) => t),
            labels: entries.map(([t]) => t.length > 20 ? t.substring(0, 18) + '...' : t),
            values: entries.map(([, h]) => Math.round(h * 10) / 10),
        }
    }, [filteredSubmissions])

    // ECharts: Responsibility Hours Bar Chart
    const responsibilityHoursOption = useMemo(() => ({
        color: ECHARTS_PALETTE,
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: function (params: any) {
                const dataIndex = params[0].dataIndex
                const fullTitle = responsibilityHoursData._fullTitles[dataIndex]
                return `${fullTitle}<br/>${params[0].marker} Hours: ${params[0].value}h`
            }
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        xAxis: { type: 'category', data: responsibilityHoursData.labels },
        yAxis: { type: 'value', name: 'Hours' },
        series: [{
            name: 'Hours Worked',
            type: 'bar',
            data: responsibilityHoursData.values,
            itemStyle: {
                color: (params: any) => ECHARTS_PALETTE[params.dataIndex % ECHARTS_PALETTE.length]
            }
        }]
    }), [responsibilityHoursData])

    // ECharts: Status Donut Chart
    const statusDonutOption = useMemo(() => ({
        color: ['#85C170', '#F5C242', '#F2846B'],
        tooltip: { trigger: 'item' },
        legend: { bottom: 0, left: 'center' },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        series: [{
            name: 'Submissions',
            type: 'pie',
            roam: false,
            breadcrumb: { show: false },
            radius: ['45%', '70%'],
            avoidLabelOverlap: true,
            label: { show: true, formatter: '{b} ({d}%)', color: 'inherit', textBorderWidth: 0, fontSize: 12 },
            labelLine: { show: true, length: 15, length2: 10, smooth: true },
            data: [
                { value: analyticsStats.verified, name: 'Verified' },
                { value: analyticsStats.pending, name: 'Pending' },
                { value: analyticsStats.rejected, name: 'Rejected' },
            ]
        }]
    }), [analyticsStats])

    // ECharts: Verified Submissions Bar Chart
    const verifiedBarOption = useMemo(() => ({
        color: ['#85C170'],
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        xAxis: { type: 'category', data: dailyChartData.map(d => d.date), axisLabel: { rotate: 45, fontSize: 10 } },
        yAxis: { type: 'value', minInterval: 1, name: 'Count' },
        series: [{
            name: 'Verified',
            type: 'bar',
            data: dailyChartData.map(d => d.verified),
            itemStyle: { borderRadius: [4, 4, 0, 0] }
        }]
    }), [dailyChartData])

    // ECharts: Hours Trend Line Chart
    const hoursTrendOption = useMemo(() => ({
        color: ['#9B7ED9'],
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { top: 0 },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        xAxis: { type: 'category', boundaryGap: false, data: dailyChartData.map(d => d.date), axisLabel: { rotate: 45, fontSize: 10 } },
        yAxis: { type: 'value', name: 'Hours' },
        dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            { type: 'slider', start: 0, end: 100, height: 16, bottom: 0 }
        ],
        series: [{
            name: 'Hours Worked',
            type: 'line',
            smooth: false,
            showSymbol: false,
            lineStyle: { width: 1.5 },
            areaStyle: { opacity: 0.1 },
            data: dailyChartData.map(d => d.hours)
        }]
    }), [dailyChartData])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    if (!staff) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center py-12 text-muted-foreground">
                            <p>Staff member not found</p>
                            <Button
                                variant="outline"
                                className="mt-4"
                                onClick={() => router.push('/admin/departments')}
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Departments
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">


            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl  tracking-tight">Staff Profile</h1>
                    <p className="text-muted-foreground">
                        View staff member details and history
                    </p>
                </div>
            </div>

            {/* Staff Profile Card */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        <Avatar className="h-24 w-24">
                            {staff.avatarUrl && (
                                <AvatarImage src={staff.avatarUrl} alt={staff.name || 'Staff'} />
                            )}
                            <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                                {getInitials(staff.name || 'U')}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-4">
                            <div>
                                <h2 className="text-2xl ">{staff.name}</h2>
                                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                                    <Mail className="h-4 w-4" />
                                    {staff.email}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                <Badge variant="outline" className="gap-1">
                                    <Users className="h-3 w-3" />
                                    {staff.role}
                                </Badge>
                                {department && (
                                    <Badge variant="secondary" className="gap-1">
                                        <Building2 className="h-3 w-3" />
                                        {department.name}
                                    </Badge>
                                )}
                                {subDepartment && (
                                    <Badge variant="secondary" className="gap-1">
                                        <Users className="h-3 w-3" />
                                        {subDepartment.name}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CalendarIcon className="h-4 w-4" />
                                Joined: {format(new Date(staff.createdAt), "MMMM d, yyyy")}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Summary */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            {/* <ClipboardList className="h-4 w-4 text-blue-500" /> */}
                            Total Submissions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl ">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            {/* <Clock className="h-4 w-4 text-amber-500" /> */}
                            Pending
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl ">{stats.pending}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            {/* <CheckCircle className="h-4 w-4 text-green-500" /> */}
                            Verified
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl ">{stats.verified}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            {/* <XCircle className="h-4 w-4 text-red-500" /> */}
                            Rejected
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl ">{stats.rejected}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Performance Analytics */}
            <div>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                        <div>
                            <CardTitle>Performance Analytics</CardTitle>
                            <CardDescription>Detailed metrics and trends</CardDescription>
                        </div>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            <>
                                                {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                                            </>
                                        ) : (
                                            format(dateRange.from, "LLL dd, y")
                                        )
                                    ) : (
                                        <span>Pick a date range</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                {/* <div className="flex gap-2 p-3 border-b">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}
                                    >
                                        Last 7 days
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}
                                    >
                                        Last 30 days
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}
                                    >
                                        This Month
                                    </Button>
                                </div> */}
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={(range) => setDateRange(range as DateRange | undefined)}
                                    numberOfMonths={1}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Analytics Stats Cards */}
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border bg-card p-4">
                            <div className="flex items-center gap-2">
                                {/* <div className="p-2 bg-blue-100 rounded-lg">
                                    <FileText className="h-4 w-4 text-blue-600" />
                                </div> */}
                                <span className="text-sm text-muted-foreground">Period Submissions</span>
                            </div>
                            <p className="text-2xl  mt-2">{analyticsStats.total}</p>
                        </div>
                        <div className="rounded-lg border bg-card p-4">
                            <div className="flex items-center gap-2">
                                {/* <div className="p-2 bg-green-100 rounded-lg">
                                    <TrendingUp className="h-4 w-4 text-green-600" />
                                </div> */}
                                <span className="text-sm text-muted-foreground">Approval Rate</span>
                            </div>
                            <p className="text-2xl  mt-2">{analyticsStats.approvalRate}%</p>
                        </div>
                        <div className="rounded-lg border bg-card p-4">
                            <div className="flex items-center gap-2">
                                {/* <div className="p-2 bg-amber-100 rounded-lg">
                                    <Clock className="h-4 w-4 text-amber-600" />
                                </div> */}
                                <span className="text-sm text-muted-foreground">Pending Review</span>
                            </div>
                            <p className="text-2xl  mt-2">{analyticsStats.pending}</p>
                        </div>
                        <div className=" border bg-card p-4">
                            <div className="flex items-center gap-2">
                                {/* <div className="p-2 bg-purple-100 ">
                                    <Clock className="h-4 w-4 text-purple-600" />
                                </div> */}
                                <span className="text-sm text-muted-foreground">Verified Hours</span>
                            </div>
                            <p className="text-2xl  mt-2">{analyticsStats.hours.toFixed(1)}h</p>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Hours by Responsibility Bar Chart */}
                        <div className="border p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <h3 className="font-semibold">Hours by Responsibility</h3>
                            </div>
                            <div className="w-full min-h-[350px]">
                                {(responsibilityHoursData as any)._fullTitles?.length > 0 ? (
                                    <ReactECharts option={responsibilityHoursOption} style={{ height: '350px', width: '100%' }} />
                                ) : (
                                    <div className="h-[350px] flex items-center justify-center text-muted-foreground text-sm">
                                        No submission data available
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Distribution Doughnut Chart */}
                        <div className="border p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <h3 className="font-semibold">Status Distribution</h3>
                            </div>
                            <div className="w-full min-h-[350px]">
                                <ReactECharts option={statusDonutOption} style={{ height: '350px', width: '100%' }} />
                            </div>
                        </div>

                        {/* Verified Submissions Bar Chart */}
                        <div className="border p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <h3 className="font-semibold">Verified Submissions</h3>
                            </div>
                            <div className="w-full min-h-[350px]">
                                <ReactECharts option={verifiedBarOption} style={{ height: '350px', width: '100%' }} />
                            </div>
                        </div>

                        {/* Hours Trend Line Chart */}
                        <div className="border p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <h3 className="font-semibold">Hours Trend</h3>
                            </div>
                            <div className="w-full min-h-[350px]">
                                <ReactECharts option={hoursTrendOption} style={{ height: '350px', width: '100%' }} />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </div>

            {/* Tabs for Assignments and Submissions */}
            <div>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                        <div>
                            <CardTitle>Activity</CardTitle>
                            <CardDescription>
                                Assignments and submission history
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            {activityFilterDate && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setActivityFilterDate(null)
                                        setAssignmentsPage(1)
                                        setSubmissionsPage(1)
                                    }}
                                    className="text-xs text-muted-foreground"
                                >
                                    Clear filter
                                </Button>
                            )}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {activityFilterDate ? format(activityFilterDate, "MMM d, yyyy") : "Filter by date"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                    <Calendar
                                        mode="single"
                                        selected={activityFilterDate || undefined}
                                        onSelect={(date) => {
                                            setActivityFilterDate(date || null)
                                            setAssignmentsPage(1)
                                            setSubmissionsPage(1)
                                        }}
                                        className="p-2"
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="assignments">
                        <TabsList className="mb-4">
                            <TabsTrigger value="assignments" className="gap-2">
                                Assignments
                                <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs">
                                    {activityAssignments.length}
                                </span>
                            </TabsTrigger>
                            <TabsTrigger value="submissions" className="gap-2">
                                Submissions
                                <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs">
                                    {activitySubmissions.length}
                                </span>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="assignments">
                            {assignments.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No assignments found</p>
                                </div>
                            ) : (
                                <>
                                    <Table className="border">
                                        <TableHeader className="bg-white">
                                            <TableRow>
                                                <TableHead>
                                                    <div className="flex items-center gap-1">
                                                        <span>Responsibility</span>
                                                        <ColumnFilter
                                                            title="Responsibility"
                                                            options={assignRespOptions}
                                                            selected={colAssignRespFilter}
                                                            onChange={setColAssignRespFilter}
                                                        />
                                                    </div>
                                                </TableHead>
                                                <TableHead>
                                                    <div className="flex items-center gap-1">
                                                        <span>Cycle</span>
                                                        <ColumnFilter
                                                            title="Cycle"
                                                            options={assignCycleOptions}
                                                            selected={colAssignCycleFilter}
                                                            onChange={setColAssignCycleFilter}
                                                        />
                                                    </div>
                                                </TableHead>
                                                <TableHead>
                                                    <div className="flex items-center gap-1">
                                                        <span>Status</span>
                                                        <ColumnFilter
                                                            title="Status"
                                                            options={assignStatusOptions}
                                                            selected={colAssignStatusFilter}
                                                            onChange={setColAssignStatusFilter}
                                                        />
                                                    </div>
                                                </TableHead>
                                                <TableHead>Assigned</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginatedAssignments.map((assignment) => (
                                                <TableRow key={assignment.id}>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            {assignment.responsibility?.title || 'N/A'}
                                                        </div>
                                                        {assignment.responsibility?.description && (
                                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                                                {assignment.responsibility.description}
                                                            </p>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary">
                                                            {assignment.responsibility?.cycle || 'N/A'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={assignment.status === 'PENDING' ? 'secondary' : assignment.status === 'VERIFIED' ? 'default' : 'outline'}>
                                                            {assignment.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {format(new Date(assignment.assignedAt), "MMM d, yyyy")}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openViewResponsibilityDialog(assignment)}
                                                        >
                                                            <Eye className="h-4 w-4 mr-1" />
                                                            View
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>

                                    {assignmentsTotalPages > 1 && (
                                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                            <p className="text-sm text-muted-foreground">
                                                Page {assignmentsPage} of {assignmentsTotalPages} ({activityAssignments.length} assignments)
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setAssignmentsPage(p => Math.max(1, p - 1))}
                                                    disabled={assignmentsPage === 1}
                                                >
                                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                                    Previous
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setAssignmentsPage(p => Math.min(assignmentsTotalPages, p + 1))}
                                                    disabled={assignmentsPage === assignmentsTotalPages}
                                                >
                                                    Next
                                                    <ChevronRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </TabsContent>

                        <TabsContent value="submissions">
                            {submissions.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No submissions found</p>
                                </div>
                            ) : (
                                <>
                                    <Table className="border">
                                        <TableHeader className="bg-white">
                                            <TableRow>
                                                <TableHead>
                                                    <div className="flex items-center gap-1">
                                                        <span>Responsibility</span>
                                                        <ColumnFilter
                                                            title="Responsibility"
                                                            options={subRespOptions}
                                                            selected={colSubRespFilter}
                                                            onChange={setColSubRespFilter}
                                                        />
                                                    </div>
                                                </TableHead>
                                                <TableHead>Hours</TableHead>
                                                <TableHead>
                                                    <div className="flex items-center gap-1">
                                                        <span>Status</span>
                                                        <ColumnFilter
                                                            title="Status"
                                                            options={subStatusOptions}
                                                            selected={colSubStatusFilter}
                                                            onChange={setColSubStatusFilter}
                                                        />
                                                    </div>
                                                </TableHead>
                                                <TableHead>Submitted</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginatedSubmissions.map((submission) => (
                                                <TableRow key={submission.id}>
                                                    <TableCell className="font-medium max-w-[200px] truncate">
                                                        {submission.assignment?.responsibility?.title || 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {submission.hoursWorked || '-'}h
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <SubmissionStatusBadge status={submission.status as any} />
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {format(new Date(submission.submittedAt), "MMM d, yyyy")}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>

                                    {submissionsTotalPages > 1 && (
                                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                            <p className="text-sm text-muted-foreground">
                                                Page {submissionsPage} of {submissionsTotalPages} ({activitySubmissions.length} submissions)
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setSubmissionsPage(p => Math.max(1, p - 1))}
                                                    disabled={submissionsPage === 1}
                                                >
                                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                                    Previous
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setSubmissionsPage(p => Math.min(submissionsTotalPages, p + 1))}
                                                    disabled={submissionsPage === submissionsTotalPages}
                                                >
                                                    Next
                                                    <ChevronRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </div>

            {/* View Responsibility Dialog */}
            <Dialog open={viewResponsibilityDialogOpen} onOpenChange={setViewResponsibilityDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {/* <Target className="h-5 w-5 text-indigo-500" /> */}
                            Responsibility Details
                        </DialogTitle>
                        <DialogDescription>
                            View assigned responsibility information
                        </DialogDescription>
                    </DialogHeader>
                    {selectedResponsibility && (
                        <div className="space-y-4 py-4">
                            <div>
                                <h3 className="font-semibold text-lg">{selectedResponsibility.title}</h3>
                                {selectedResponsibility.description && (
                                    <p className="text-muted-foreground mt-1">{selectedResponsibility.description}</p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs text-muted-foreground">Cycle</p>
                                    <p className="font-medium">{selectedResponsibility.cycle}</p>
                                </div>
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs text-muted-foreground">Status</p>
                                    <Badge variant={selectedResponsibility.isActive ? "default" : "secondary"}>
                                        {selectedResponsibility.isActive ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>
                                {selectedResponsibility.startDate && (
                                    <div className="rounded-lg border p-3">
                                        <p className="text-xs text-muted-foreground">Start Date</p>
                                        <p className="font-medium">{format(new Date(selectedResponsibility.startDate), "MMM d, yyyy")}</p>
                                    </div>
                                )}
                                {selectedResponsibility.endDate && (
                                    <div className="rounded-lg border p-3">
                                        <p className="text-xs text-muted-foreground">End Date</p>
                                        <p className="font-medium">{format(new Date(selectedResponsibility.endDate), "MMM d, yyyy")}</p>
                                    </div>
                                )}
                            </div>
                            {selectedAssignment && (
                                <div className="rounded-lg border bg-muted/30 p-4">
                                    <h4 className="font-medium text-sm mb-2">Assignment Info</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Status:</span>{' '}
                                            <Badge variant={selectedAssignment.status === 'VERIFIED' ? 'default' : selectedAssignment.status === 'PENDING' ? 'secondary' : 'outline'} className="ml-1">
                                                {selectedAssignment.status}
                                            </Badge>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Assigned:</span>{' '}
                                            {selectedAssignment.assignedAt ? format(new Date(selectedAssignment.assignedAt), "MMM d, yyyy") : 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {selectedResponsibility.createdAt && (
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs text-muted-foreground">Created At</p>
                                    <p className="font-medium">{format(new Date(selectedResponsibility.createdAt), "MMM d, yyyy HH:mm")}</p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default function StaffDetailsPage({ params }: { params: { staffId: string } }) {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        }>
            <StaffDetailsContent staffId={params.staffId} />
        </Suspense>
    )
}
