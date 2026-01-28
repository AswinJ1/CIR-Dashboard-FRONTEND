"use client"

import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@/components/providers/auth-context"
import { api } from "@/lib/api"
import { WorkSubmission, Assignment, Employee, Responsibility, Department, SubDepartment } from "@/types/cir"
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
    Building2,
    Briefcase,
    Layers,
} from "lucide-react"
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns"
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler } from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler)

type DateRange = {
    from: Date
    to: Date
}

export default function AdminAnalyticsPage() {
    const { user } = useAuth()
    const [isLoading, setIsLoading] = useState(true)
    const [submissions, setSubmissions] = useState<WorkSubmission[]>([])
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [responsibilities, setResponsibilities] = useState<Responsibility[]>([])
    const [departments, setDepartments] = useState<Department[]>([])
    const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([])
    
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("all")
    const [selectedSubDepartmentId, setSelectedSubDepartmentId] = useState<string>("all")
    const [selectedStaffId, setSelectedStaffId] = useState<string>("all")
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 30),
        to: new Date(),
    })

    useEffect(() => {
        fetchData()
    }, [user])

    async function fetchData() {
        try {
            const [allSubmissions, allAssignments, allEmployees, allResponsibilities, allDepts, allSubDepts] = await Promise.all([
                api.workSubmissions.getAll(),
                api.assignments.getAll(),
                api.employees.getAll(),
                api.responsibilities.getAll(),
                api.departments.getAll(),
                api.subDepartments.getAll(),
            ])
            
            setSubmissions(allSubmissions)
            setAssignments(allAssignments)
            setEmployees(allEmployees)
            setResponsibilities(allResponsibilities)
            setDepartments(allDepts)
            setSubDepartments(allSubDepts)
        } catch (error) {
            console.error("Failed to fetch analytics data:", error)
        } finally {
            setIsLoading(false)
        }
    }

    // Filter sub-departments based on selected department
    const filteredSubDepartments = useMemo(() => {
        if (selectedDepartmentId === "all") return subDepartments
        return subDepartments.filter(sd => String(sd.departmentId) === selectedDepartmentId)
    }, [subDepartments, selectedDepartmentId])

    // Filter staff based on selected department/sub-department
    const filteredStaffList = useMemo(() => {
        let staff = employees.filter(e => e.role === 'STAFF')
        if (selectedDepartmentId !== "all") {
            staff = staff.filter(e => String(e.departmentId) === selectedDepartmentId)
        }
        if (selectedSubDepartmentId !== "all") {
            staff = staff.filter(e => String(e.subDepartmentId) === selectedSubDepartmentId)
        }
        return staff
    }, [employees, selectedDepartmentId, selectedSubDepartmentId])

    // Filter submissions based on all filters
    const filteredSubmissions = useMemo(() => {
        return submissions.filter(s => {
            const date = new Date(s.workDate || s.submittedAt)
            const inDateRange = date >= dateRange.from && date <= dateRange.to
            
            // Get staff for this submission
            const staff = employees.find(e => String(e.id) === String(s.staffId))
            if (!staff) return false
            
            // Apply filters
            const matchesDept = selectedDepartmentId === "all" || String(staff.departmentId) === selectedDepartmentId
            const matchesSubDept = selectedSubDepartmentId === "all" || String(staff.subDepartmentId) === selectedSubDepartmentId
            const matchesStaff = selectedStaffId === "all" || String(s.staffId) === selectedStaffId
            
            return inDateRange && matchesDept && matchesSubDept && matchesStaff
        })
    }, [submissions, employees, dateRange, selectedDepartmentId, selectedSubDepartmentId, selectedStaffId])

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
        
        const totalStaff = employees.filter(e => e.role === 'STAFF').length
        const totalManagers = employees.filter(e => e.role === 'MANAGER').length
        
        return { total, verified, pending, rejected, totalHours, verifiedHours, approvalRate, totalStaff, totalManagers }
    }, [filteredSubmissions, employees])

    // Department stats
    const departmentStats = useMemo(() => {
        return departments.map(dept => {
            const deptStaff = employees.filter(e => String(e.departmentId) === String(dept.id) && e.role === 'STAFF')
            const staffIds = deptStaff.map(s => String(s.id))
            const deptSubmissions = filteredSubmissions.filter(s => staffIds.includes(String(s.staffId)))
            const verified = deptSubmissions.filter(s => s.status === 'VERIFIED').length
            const hours = deptSubmissions
                .filter(s => s.status === 'VERIFIED')
                .reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)
            
            return {
                ...dept,
                staffCount: deptStaff.length,
                totalSubmissions: deptSubmissions.length,
                verified,
                hours: Math.round(hours * 10) / 10,
                approvalRate: deptSubmissions.length > 0 ? Math.round((verified / deptSubmissions.length) * 100) : 0,
            }
        }).sort((a, b) => b.totalSubmissions - a.totalSubmissions)
    }, [departments, employees, filteredSubmissions])

    // Sub-department stats
    const subDepartmentStats = useMemo(() => {
        return filteredSubDepartments.map(subDept => {
            const subDeptStaff = employees.filter(e => String(e.subDepartmentId) === String(subDept.id) && e.role === 'STAFF')
            const staffIds = subDeptStaff.map(s => String(s.id))
            const subDeptSubmissions = filteredSubmissions.filter(s => staffIds.includes(String(s.staffId)))
            const verified = subDeptSubmissions.filter(s => s.status === 'VERIFIED').length
            const hours = subDeptSubmissions
                .filter(s => s.status === 'VERIFIED')
                .reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)
            
            return {
                ...subDept,
                staffCount: subDeptStaff.length,
                totalSubmissions: subDeptSubmissions.length,
                verified,
                hours: Math.round(hours * 10) / 10,
                approvalRate: subDeptSubmissions.length > 0 ? Math.round((verified / subDeptSubmissions.length) * 100) : 0,
            }
        }).sort((a, b) => b.totalSubmissions - a.totalSubmissions)
    }, [filteredSubDepartments, employees, filteredSubmissions])

    // Staff stats
    const staffStats = useMemo(() => {
        return filteredStaffList.map(staff => {
            const staffSubmissions = filteredSubmissions.filter(s => String(s.staffId) === String(staff.id))
            const verified = staffSubmissions.filter(s => s.status === 'VERIFIED').length
            const pending = staffSubmissions.filter(s => s.status === 'SUBMITTED' || s.status === 'PENDING').length
            const rejected = staffSubmissions.filter(s => s.status === 'REJECTED').length
            const hours = staffSubmissions
                .filter(s => s.status === 'VERIFIED')
                .reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)
            
            return {
                ...staff,
                total: staffSubmissions.length,
                verified,
                pending,
                rejected,
                hours: Math.round(hours * 10) / 10,
                approvalRate: staffSubmissions.length > 0 ? Math.round((verified / staffSubmissions.length) * 100) : 0,
            }
        }).sort((a, b) => b.total - a.total)
    }, [filteredStaffList, filteredSubmissions])

    // Responsibility stats
    const responsibilityStats = useMemo(() => {
        let resps = responsibilities
        if (selectedDepartmentId !== "all") {
            // Filter by department through sub-department
            const subDeptIdsInDept = subDepartments
                .filter(sd => String(sd.departmentId) === selectedDepartmentId)
                .map(sd => String(sd.id))
            resps = resps.filter(r => subDeptIdsInDept.includes(String(r.subDepartmentId)))
        }
        if (selectedSubDepartmentId !== "all") {
            resps = resps.filter(r => String(r.subDepartmentId) === selectedSubDepartmentId)
        }
        
        return resps.map(resp => {
            const respAssignments = assignments.filter(a => String(a.responsibilityId) === String(resp.id))
            // Get unique staff IDs and their details
            const assignedStaffIds = [...new Set(respAssignments.map(a => String(a.staffId)))]
            const assignedStaffList = assignedStaffIds.map(staffId => {
                const staff = employees.find(e => String(e.id) === staffId)
                return staff ? { id: staff.id, name: staff.name } : null
            }).filter(Boolean) as { id: string, name: string }[]
            
            const respSubmissions = filteredSubmissions.filter(s => 
                respAssignments.some(a => String(a.id) === String(s.assignmentId))
            )
            const verified = respSubmissions.filter(s => s.status === 'VERIFIED').length
            
            // Get sub-department and department info for this responsibility
            const subDept = subDepartments.find(sd => String(sd.id) === String(resp.subDepartmentId))
            const dept = subDept ? departments.find(d => String(d.id) === String(subDept.departmentId)) : null
            
            return {
                ...resp,
                assignedStaff: assignedStaffList.length,
                assignedStaffList,
                subDepartmentName: subDept?.name || 'Unknown',
                departmentName: dept?.name || 'Unknown',
                totalSubmissions: respSubmissions.length,
                verified,
                completionRate: respSubmissions.length > 0 ? Math.round((verified / respSubmissions.length) * 100) : 0,
            }
        }).sort((a, b) => b.totalSubmissions - a.totalSubmissions)
    }, [responsibilities, assignments, filteredSubmissions, selectedDepartmentId, selectedSubDepartmentId, subDepartments, employees, departments])

    // Daily data for charts
    const dailyData = useMemo(() => {
        const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to })
        
        return days.map(day => {
            const daySubmissions = filteredSubmissions.filter(s => 
                isSameDay(new Date(s.workDate || s.submittedAt), day)
            )
            const verified = daySubmissions.filter(s => s.status === 'VERIFIED').length
            const hours = daySubmissions.reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)
            
            return {
                date: format(day, 'MMM d'),
                submissions: daySubmissions.length,
                verified,
                hours: Math.round(hours * 10) / 10,
            }
        })
    }, [filteredSubmissions, dateRange])

    // Chart Data
    const statusPieData = {
        labels: ['Verified', 'Pending', 'Rejected'],
        datasets: [{
            data: [stats.verified, stats.pending, stats.rejected],
            backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(251, 191, 36, 0.8)', 'rgba(239, 68, 68, 0.8)'],
            borderColor: ['rgba(34, 197, 94, 1)', 'rgba(251, 191, 36, 1)', 'rgba(239, 68, 68, 1)'],
            borderWidth: 2,
            hoverOffset: 8,
        }]
    }

    const dailySubmissionsData = {
        labels: dailyData.map(d => d.date),
        datasets: [{
            label: 'Total Submissions',
            data: dailyData.map(d => d.submissions),
            borderColor: 'rgba(99, 102, 241, 1)',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
        }, {
            label: 'Verified',
            data: dailyData.map(d => d.verified),
            borderColor: 'rgba(34, 197, 94, 1)',
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
        }]
    }

    const departmentBarData = {
        labels: departmentStats.slice(0, 8).map(d => d.name.length > 15 ? d.name.substring(0, 12) + '...' : d.name),
        datasets: [{
            label: 'Verified',
            data: departmentStats.slice(0, 8).map(d => d.verified),
            backgroundColor: 'rgba(34, 197, 94, 0.8)',
            borderRadius: 4,
        }, {
            label: 'Pending/Rejected',
            data: departmentStats.slice(0, 8).map(d => d.totalSubmissions - d.verified),
            backgroundColor: 'rgba(251, 191, 36, 0.8)',
            borderRadius: 4,
        }]
    }

    const hoursChartData = {
        labels: dailyData.map(d => d.date),
        datasets: [{
            label: 'Hours Worked',
            data: dailyData.map(d => d.hours),
            borderColor: 'rgba(139, 92, 246, 1)',
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
        }]
    }

    // Chart Options
    const pieChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' as const, labels: { padding: 20, usePointStyle: true } },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
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
            legend: { position: 'top' as const, labels: { padding: 15, usePointStyle: true } },
            tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', padding: 12, mode: 'index' as const, intersect: false },
        },
        scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.05)' } },
        },
        interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false },
    }

    const barChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y' as const,
        plugins: {
            legend: { position: 'top' as const, labels: { padding: 15, usePointStyle: true } },
            tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', padding: 12 },
        },
        scales: {
            x: { stacked: true, beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.05)' } },
            y: { stacked: true, grid: { display: false } },
        },
    }

    // Reset sub-department when department changes
    useEffect(() => {
        setSelectedSubDepartmentId("all")
        setSelectedStaffId("all")
    }, [selectedDepartmentId])

    useEffect(() => {
        setSelectedStaffId("all")
    }, [selectedSubDepartmentId])

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
                    <h1 className="text-3xl font-bold tracking-tight">System Analytics</h1>
                    <p className="text-muted-foreground">
                        Organization-wide performance metrics and insights
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Department Filter */}
                    <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                        <SelectTrigger className="w-[160px]">
                            <Building2 className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Department" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {departments.map(dept => (
                                <SelectItem key={dept.id} value={String(dept.id)}>
                                    {dept.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Sub-Department Filter */}
                    <Select value={selectedSubDepartmentId} onValueChange={setSelectedSubDepartmentId}>
                        <SelectTrigger className="w-[160px]">
                            <Layers className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Sub-Dept" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Sub-Depts</SelectItem>
                            {filteredSubDepartments.map(subDept => (
                                <SelectItem key={subDept.id} value={String(subDept.id)}>
                                    {subDept.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Staff Filter */}
                    <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                        <SelectTrigger className="w-[160px]">
                            <Users className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Staff" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Staff</SelectItem>
                            {filteredStaffList.map(staff => (
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Departments</CardTitle>
                        <Building2 className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{departments.length}</div>
                        <p className="text-xs text-muted-foreground">{subDepartments.length} sub-departments</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
                        <Users className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-indigo-600">{stats.totalStaff}</div>
                        <p className="text-xs text-muted-foreground">{stats.totalManagers} managers</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Submissions</CardTitle>
                        <BarChart3 className="h-4 w-4 text-cyan-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-cyan-600">{stats.total}</div>
                        <p className="text-xs text-muted-foreground">{stats.totalHours.toFixed(1)} hours logged</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.approvalRate}%</div>
                        <p className="text-xs text-muted-foreground">{stats.verified} verified</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
                        <p className="text-xs text-muted-foreground">Awaiting review</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Verified Hours</CardTitle>
                        <FileCheck className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">{stats.verifiedHours.toFixed(1)}h</div>
                        <p className="text-xs text-muted-foreground">Approved work</p>
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
                    <TabsTrigger value="departments" className="gap-2">
                        <Building2 className="h-4 w-4" />
                        Departments
                    </TabsTrigger>
                    <TabsTrigger value="staff" className="gap-2">
                        <Users className="h-4 w-4" />
                        Staff
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
                                    <Activity className="h-5 w-5 text-indigo-500" />
                                    Daily Submissions Trend
                                </CardTitle>
                                <CardDescription>Submissions and verifications over time</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    <Line data={dailySubmissionsData} options={lineChartOptions} />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Target className="h-5 w-5 text-green-500" />
                                    Status Distribution
                                </CardTitle>
                                <CardDescription>Breakdown by submission status</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    {stats.total > 0 ? (
                                        <Doughnut data={statusPieData} options={pieChartOptions} />
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground">
                                            No submissions in selected period
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-blue-500" />
                                    Department Performance
                                </CardTitle>
                                <CardDescription>Submissions by department</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    <Bar data={departmentBarData} options={barChartOptions} />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-purple-500" />
                                    Hours Trend
                                </CardTitle>
                                <CardDescription>Daily hours worked</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    <Line data={hoursChartData} options={lineChartOptions} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Departments Tab */}
                <TabsContent value="departments" className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-blue-500" />
                                    Departments Overview
                                </CardTitle>
                                <CardDescription>Performance by department</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[400px]">
                                    <div className="space-y-3">
                                        {departmentStats.map((dept) => (
                                            <div 
                                                key={dept.id} 
                                                className="p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                                                onClick={() => setSelectedDepartmentId(String(dept.id))}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium">{dept.name}</span>
                                                    <Badge variant="outline">{dept.staffCount} staff</Badge>
                                                </div>
                                                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                                                    <div>
                                                        <p className="font-semibold text-indigo-600">{dept.totalSubmissions}</p>
                                                        <p className="text-xs text-muted-foreground">Submissions</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-green-600">{dept.verified}</p>
                                                        <p className="text-xs text-muted-foreground">Verified</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-purple-600">{dept.hours}h</p>
                                                        <p className="text-xs text-muted-foreground">Hours</p>
                                                    </div>
                                                    <div>
                                                        <p className={`font-semibold ${dept.approvalRate >= 80 ? 'text-green-600' : dept.approvalRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                            {dept.approvalRate}%
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">Approval</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Layers className="h-5 w-5 text-cyan-500" />
                                    Sub-Departments
                                </CardTitle>
                                <CardDescription>
                                    {selectedDepartmentId === "all" ? "All sub-departments" : "Filtered by department"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[400px]">
                                    <div className="space-y-3">
                                        {subDepartmentStats.map((subDept) => (
                                            <div 
                                                key={subDept.id} 
                                                className="p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                                                onClick={() => setSelectedSubDepartmentId(String(subDept.id))}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium">{subDept.name}</span>
                                                    <Badge variant="outline">{subDept.staffCount} staff</Badge>
                                                </div>
                                                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                                                    <div>
                                                        <p className="font-semibold text-indigo-600">{subDept.totalSubmissions}</p>
                                                        <p className="text-xs text-muted-foreground">Submissions</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-green-600">{subDept.verified}</p>
                                                        <p className="text-xs text-muted-foreground">Verified</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-purple-600">{subDept.hours}h</p>
                                                        <p className="text-xs text-muted-foreground">Hours</p>
                                                    </div>
                                                    <div>
                                                        <p className={`font-semibold ${subDept.approvalRate >= 80 ? 'text-green-600' : subDept.approvalRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                            {subDept.approvalRate}%
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">Approval</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {subDepartmentStats.length === 0 && (
                                            <div className="text-center py-8 text-muted-foreground">
                                                No sub-departments found
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Staff Tab */}
                <TabsContent value="staff" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-indigo-500" />
                                Staff Performance
                            </CardTitle>
                            <CardDescription>
                                Individual staff metrics 
                                {selectedDepartmentId !== "all" && " (filtered by department)"}
                                {selectedSubDepartmentId !== "all" && " (filtered by sub-department)"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px]">
                                <div className="space-y-3">
                                    {staffStats.map((staff) => (
                                        <div 
                                            key={staff.id} 
                                            className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                                            onClick={() => setSelectedStaffId(String(staff.id))}
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
                                            No staff members found with current filters
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
                                <Briefcase className="h-5 w-5 text-indigo-500" />
                                Responsibilities Overview
                            </CardTitle>
                            <CardDescription>
                                Performance by responsibility
                                {selectedDepartmentId !== "all" && " (filtered)"}
                            </CardDescription>
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
                                            {/* Department and Sub-department info */}
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                <Badge variant="outline" className="text-xs">
                                                    <Building2 className="h-3 w-3 mr-1" />
                                                    {resp.departmentName}
                                                </Badge>
                                                <Badge variant="outline" className="text-xs bg-blue-50">
                                                    <Layers className="h-3 w-3 mr-1" />
                                                    {resp.subDepartmentName}
                                                </Badge>
                                            </div>
                                            {resp.description && (
                                                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{resp.description}</p>
                                            )}
                                            {/* Assigned Staff List */}
                                            {resp.assignedStaffList.length > 0 && (
                                                <div className="mb-3">
                                                    <p className="text-xs font-medium text-muted-foreground mb-1">Assigned Staff:</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {resp.assignedStaffList.slice(0, 5).map((staff) => (
                                                            <Badge key={staff.id} variant="secondary" className="text-xs">
                                                                <Users className="h-3 w-3 mr-1" />
                                                                {staff.name}
                                                            </Badge>
                                                        ))}
                                                        {resp.assignedStaffList.length > 5 && (
                                                            <Badge variant="secondary" className="text-xs">
                                                                +{resp.assignedStaffList.length - 5} more
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
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
                                            No responsibilities found with current filters
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
