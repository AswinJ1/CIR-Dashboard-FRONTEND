"use client"

import { useEffect, useState, useCallback, Suspense, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import { Department, SubDepartment, Employee, Assignment, WorkSubmission, Responsibility } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
} from "lucide-react"
import { toast } from "sonner"
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns"
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler } from 'chart.js'
import { Pie, Bar, Line, Doughnut } from 'react-chartjs-2'

// Register ChartJS components
ChartJS.register(ArcElement, ChartTooltip, ChartLegend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler)

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

    // Status distribution for pie chart
    const statusDistribution = useMemo(() => {
        return [
            { name: 'Verified', value: analyticsStats.verified, color: '#22c55e' },
            { name: 'Pending', value: analyticsStats.pending, color: '#f59e0b' },
            { name: 'Rejected', value: analyticsStats.rejected, color: '#ef4444' },
        ].filter(item => item.value > 0)
    }, [analyticsStats])

    // Chart.js Data Configurations
    const statusPieData = useMemo(() => ({
        labels: ['Verified', 'Pending', 'Rejected'],
        datasets: [{
            data: [analyticsStats.verified, analyticsStats.pending, analyticsStats.rejected],
            backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'],
            borderColor: ['#16a34a', '#d97706', '#dc2626'],
            borderWidth: 2,
            hoverOffset: 8,
        }]
    }), [analyticsStats])

    const dailySubmissionsChartData = useMemo(() => ({
        labels: dailyChartData.map(d => d.date),
        datasets: [{
            label: 'Total Submissions',
            data: dailyChartData.map(d => d.submissions),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#6366f1',
        }, {
            label: 'Verified',
            data: dailyChartData.map(d => d.verified),
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#22c55e',
        }]
    }), [dailyChartData])

    const hoursTrendChartData = useMemo(() => ({
        labels: dailyChartData.map(d => d.date),
        datasets: [{
            label: 'Hours Worked',
            data: dailyChartData.map(d => d.hours),
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#8b5cf6',
        }]
    }), [dailyChartData])

    const verifiedBarData = useMemo(() => ({
        labels: dailyChartData.map(d => d.date),
        datasets: [{
            label: 'Verified Submissions',
            data: dailyChartData.map(d => d.verified),
            backgroundColor: 'rgba(34, 197, 94, 0.7)',
            borderColor: '#22c55e',
            borderWidth: 1,
            borderRadius: 4,
        }]
    }), [dailyChartData])

    // Chart.js Options
    const pieChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    padding: 20,
                    usePointStyle: true,
                    pointStyle: 'circle',
                    font: { size: 12, weight: 500 as const },
                },
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: { size: 14, weight: 'bold' as const },
                bodyFont: { size: 13 },
                callbacks: {
                    label: function(context: any) {
                        const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
                        const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0
                        return `${context.label}: ${context.raw} (${percentage}%)`
                    }
                }
            },
        },
    }

    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    padding: 15,
                    usePointStyle: true,
                    pointStyle: 'circle',
                    font: { size: 12, weight: 500 as const },
                },
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                mode: 'index' as const,
                intersect: false,
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { font: { size: 11 } },
            },
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                ticks: { font: { size: 11 } },
            },
        },
        interaction: {
            mode: 'nearest' as const,
            axis: 'x' as const,
            intersect: false,
        },
    }

    const barChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    padding: 15,
                    usePointStyle: true,
                    pointStyle: 'rectRounded',
                    font: { size: 12, weight: 500 as const },
                },
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { font: { size: 11 } },
            },
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                ticks: { font: { size: 11 } },
            },
        },
    }

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
            {/* Breadcrumb */}
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/admin/departments">Departments</BreadcrumbLink>
                    </BreadcrumbItem>
                    {department && (
                        <>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbLink href={`/admin/departments/subdepartments?departmentId=${department.id}`}>
                                    {department.name}
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                        </>
                    )}
                    {subDepartment && (
                        <>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbLink href={`/admin/departments/subdepartments/staff?departmentId=${departmentId}&subDepartmentId=${subDepartment.id}`}>
                                    {subDepartment.name}
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                        </>
                    )}
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{staff.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Staff Profile</h1>
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
                            <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                                {getInitials(staff.name || 'U')}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-4">
                            <div>
                                <h2 className="text-2xl font-bold">{staff.name}</h2>
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
                            <ClipboardList className="h-4 w-4 text-blue-500" />
                            Total Submissions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-500" />
                            Pending
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pending}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Verified
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.verified}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            Rejected
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.rejected}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Performance Analytics */}
            <Card>
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
                                <div className="flex gap-2 p-3 border-b">
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
                                </div>
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={(range) => setDateRange(range as DateRange | undefined)}
                                    numberOfMonths={2}
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
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <FileText className="h-4 w-4 text-blue-600" />
                                </div>
                                <span className="text-sm text-muted-foreground">Period Submissions</span>
                            </div>
                            <p className="text-2xl font-bold mt-2">{analyticsStats.total}</p>
                        </div>
                        <div className="rounded-lg border bg-card p-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <TrendingUp className="h-4 w-4 text-green-600" />
                                </div>
                                <span className="text-sm text-muted-foreground">Approval Rate</span>
                            </div>
                            <p className="text-2xl font-bold mt-2">{analyticsStats.approvalRate}%</p>
                        </div>
                        <div className="rounded-lg border bg-card p-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-amber-100 rounded-lg">
                                    <Clock className="h-4 w-4 text-amber-600" />
                                </div>
                                <span className="text-sm text-muted-foreground">Pending Review</span>
                            </div>
                            <p className="text-2xl font-bold mt-2">{analyticsStats.pending}</p>
                        </div>
                        <div className="rounded-lg border bg-card p-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-purple-100 rounded-lg">
                                    <Clock className="h-4 w-4 text-purple-600" />
                                </div>
                                <span className="text-sm text-muted-foreground">Verified Hours</span>
                            </div>
                            <p className="text-2xl font-bold mt-2">{analyticsStats.hours.toFixed(1)}h</p>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Daily Submissions Line Chart */}
                        <div className="rounded-lg border p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <Activity className="h-5 w-5 text-indigo-500" />
                                <h3 className="font-semibold">Daily Submissions</h3>
                            </div>
                            <div className="h-[250px]">
                                <Line data={dailySubmissionsChartData} options={lineChartOptions} />
                            </div>
                        </div>

                        {/* Status Distribution Doughnut Chart */}
                        <div className="rounded-lg border p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <BarChart3 className="h-5 w-5 text-green-500" />
                                <h3 className="font-semibold">Status Distribution</h3>
                            </div>
                            <div className="h-[250px]">
                                <Doughnut data={statusPieData} options={pieChartOptions} />
                            </div>
                        </div>

                        {/* Verified Submissions Bar Chart */}
                        <div className="rounded-lg border p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <BarChart3 className="h-5 w-5 text-emerald-500" />
                                <h3 className="font-semibold">Verified Submissions</h3>
                            </div>
                            <div className="h-[250px]">
                                <Bar data={verifiedBarData} options={barChartOptions} />
                            </div>
                        </div>

                        {/* Hours Trend Line Chart */}
                        <div className="rounded-lg border p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <Clock className="h-5 w-5 text-purple-500" />
                                <h3 className="font-semibold">Hours Trend</h3>
                            </div>
                            <div className="h-[250px]">
                                <Line data={hoursTrendChartData} options={lineChartOptions} />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs for Assignments and Submissions */}
            <Card>
                <CardHeader>
                    <CardTitle>Activity</CardTitle>
                    <CardDescription>
                        Assignments and submission history
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="assignments">
                        <TabsList className="mb-4">
                            <TabsTrigger value="assignments" className="gap-2">
                                Assignments
                                <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs">
                                    {assignments.length}
                                </span>
                            </TabsTrigger>
                            <TabsTrigger value="submissions" className="gap-2">
                                Submissions
                                <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs">
                                    {submissions.length}
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
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Responsibility</TableHead>
                                            <TableHead>Cycle</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Assigned</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {assignments.map((assignment) => (
                                            <TableRow key={assignment.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Target className="h-4 w-4 text-indigo-500" />
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
                            )}
                        </TabsContent>

                        <TabsContent value="submissions">
                            {submissions.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No submissions found</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Responsibility</TableHead>
                                            <TableHead>Hours</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Submitted</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {submissions.slice(0, 20).map((submission) => (
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
                            )}
                            {submissions.length > 20 && (
                                <p className="text-sm text-muted-foreground text-center mt-4">
                                    Showing 20 of {submissions.length} submissions
                                </p>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* View Responsibility Dialog */}
            <Dialog open={viewResponsibilityDialogOpen} onOpenChange={setViewResponsibilityDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5 text-indigo-500" />
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
