"use client"

import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@/components/providers/auth-context"
import { api } from "@/lib/api"
import { useRouter } from "next/navigation"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Employee, Assignment, WorkSubmission, Responsibility, SubDepartment } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SubmissionStatusBadge } from "@/components/ui/status-badge"
import { CreateResponsibilityDialog } from "@/components/manager/create-responsibility-dialog"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Users,
    ClipboardList,
    FileCheck,
    Clock,
    CheckCircle,
    XCircle,
    ArrowRight,
    Plus,
    Briefcase,
    BarChart3,
    TrendingUp,
    Target,
    Activity,
    Calendar as CalendarIcon,
    Award,
    AlertCircle,
    Download,
    CalendarCheck,
    ChevronRight,
} from "lucide-react"
import { cn} from "@/lib/utils"
import { getSubmissionsForDate, getToday } from "@/lib/responsibility-status"
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, addDays } from "date-fns"
import ReactECharts from 'echarts-for-react'
import { ECHARTS_COMMON_OPTS, ECHARTS_PALETTE } from '@/lib/echarts-theme'
import { ManagerExportDialog } from '@/components/export-dialog'

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
                // Handle values that contain commas or quotes
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

type DateRange = {
    from: Date
    to: Date
}

export default function ManagerDashboardPage() {
    const { user } = useAuth()
    const router = useRouter()
    const [calendarView, setCalendarView] = useState<'month' | 'week' | 'list'>('month')
    const [pendingSubmissions, setPendingSubmissions] = useState<WorkSubmission[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [submissions, setSubmissions] = useState<WorkSubmission[]>([])
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [staffList, setStaffList] = useState<Employee[]>([])
    const [responsibilities, setResponsibilities] = useState<Responsibility[]>([])
    const [subDepartment, setSubDepartment] = useState<SubDepartment | null>(null)
    const [employeeName, setEmployeeName] = useState<string | null>(null)
    const [selectedStaffId, setSelectedStaffId] = useState<string>("all")
    const [respPage, setRespPage] = useState(1)
    const [selectedResponsibilityId, setSelectedResponsibilityId] = useState<string>("all")
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 30),
        to: new Date(),
    })
    const [lookbackDays, setLookbackDays] = useState(7)

    const today = useMemo(() => getToday(), [])

    // SINGLE unified data fetching function
    useEffect(() => {
        async function fetchData() {
            if (!user?.subDepartmentId) return

            try {
                setIsLoading(true)
                const [allSubmissions, allAssignments, allEmployees, allResponsibilities, allSubDepts, allSettings] = await Promise.all([
                    api.workSubmissions.getAll(),
                    api.assignments.getAll(),
                    api.employees.getAll(),
                    api.responsibilities.getAll(),
                    api.subDepartments.getAll(),
                    api.settings.getAll(),
                ])

                const lookbackSetting = allSettings.find(s => s.key === 'work_submission_lookback_days')
                if (lookbackSetting && !isNaN(Number(lookbackSetting.value))) {
                    setLookbackDays(Number(lookbackSetting.value))
                }

                // Get manager's sub-department
                const managerSubDept = allSubDepts.find(sd => String(sd.id) === String(user.subDepartmentId))
                setSubDepartment(managerSubDept || null)

                // Get manager's name from employee data
                const managerData = allEmployees.find(e => String(e.id) === String(user.id))
                if (managerData?.name) {
                    setEmployeeName(managerData.name)
                }

                // Filter staff and managers in manager's sub-department
                const deptStaff = allEmployees.filter(e =>
                    String(e.subDepartmentId) === String(user.subDepartmentId) && (e.role === 'STAFF' || e.role === 'MANAGER')
                )
                setStaffList(deptStaff)

                // Get staff IDs
                const staffIds = deptStaff.map(s => String(s.id))

                // Filter submissions and assignments for staff in this sub-department
                const deptSubmissions = allSubmissions.filter(s => staffIds.includes(String(s.staffId)))
                setSubmissions(deptSubmissions)
                setAssignments(allAssignments.filter(a => staffIds.includes(String(a.staffId))))

                // Filter responsibilities for this sub-department
                setResponsibilities(allResponsibilities.filter(r =>
                    String(r.subDepartmentId) === String(user.subDepartmentId)
                ))

                // Get pending submissions (SUBMITTED status)
                const allPending = deptSubmissions.filter(s =>
                    s.status === 'SUBMITTED' || s.assignment?.status === 'SUBMITTED'
                )
                setPendingSubmissions(allPending.slice(0, 5))

            } catch (error) {
                console.error("Failed to fetch analytics data:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [user])

    // Filter by date and optionally by selected staff
    const filteredSubmissions = useMemo(() => {
        return submissions.filter(s => {
            const date = new Date(s.workDate || s.submittedAt)
            const inDateRange = date >= dateRange.from && date <= dateRange.to
            const matchesStaff = selectedStaffId === "all" || String(s.staffId) === selectedStaffId
            return inDateRange && matchesStaff
        })
    }, [submissions, dateRange, selectedStaffId])

    // Filter by responsibility
    const filteredByResponsibility = useMemo(() => {
        if (selectedResponsibilityId === "all") return filteredSubmissions
        return filteredSubmissions.filter(s => {
            const assignment = assignments.find(a => String(a.id) === String(s.assignmentId))
            return assignment && String(assignment.responsibilityId) === selectedResponsibilityId
        })
    }, [filteredSubmissions, selectedResponsibilityId, assignments])

    // Dashboard stats (for top cards - based on TODAY only)
    const dashboardStats = useMemo(() => {
        const todaySubmissions = getSubmissionsForDate(submissions, today)

        return {
            teamSize: staffList.length,
            totalAssignments: assignments.length,
            pendingVerifications: todaySubmissions.filter(s =>
                s.status === 'SUBMITTED' || s.assignment?.status === 'SUBMITTED'
            ).length,
            verifiedCount: todaySubmissions.filter(s =>
                s.status === 'VERIFIED' || s.assignment?.status === 'VERIFIED'
            ).length,
            rejectedCount: todaySubmissions.filter(s =>
                s.status === 'REJECTED' || s.assignment?.status === 'REJECTED'
            ).length,
        }
    }, [submissions, staffList, assignments, today])

    // Analytics stats (for charts - based on filtered date range)
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
            const assignedStaffIds = [...new Set(respAssignments.map(a => String(a.staffId)))]
            const assignedStaffNames = assignedStaffIds
                .map(id => staffList.find(s => String(s.id) === id)?.name)
                .filter(Boolean)
                .join(', ')
            const respSubmissions = filteredSubmissions.filter(s =>
                respAssignments.some(a => String(a.id) === String(s.assignmentId))
            )
            const verified = respSubmissions.filter(s => s.status === 'VERIFIED').length
            const pending = respSubmissions.filter(s => s.status === 'SUBMITTED' || s.status === 'PENDING').length
            const rejected = respSubmissions.filter(s => s.status === 'REJECTED').length

            return {
                ...resp,
                assignedStaff: assignedStaffIds.length,
                assignedStaffNames,
                totalSubmissions: respSubmissions.length,
                verified,
                pending,
                rejected,
                completionRate: respSubmissions.length > 0 ? Math.round((verified / respSubmissions.length) * 100) : 0,
            }
        }).sort((a, b) => b.totalSubmissions - a.totalSubmissions)
    }, [responsibilities, assignments, filteredSubmissions, staffList])

    // ECharts Configurations
    const ITEMS_PER_PAGE = 15;
    const totalRespPages = Math.ceil(responsibilityStats.length / ITEMS_PER_PAGE);
    const paginatedResponsibilityStats = responsibilityStats.slice((respPage - 1) * ITEMS_PER_PAGE, respPage * ITEMS_PER_PAGE);

    const responsibilityTreemapOption = {
        color: ECHARTS_PALETTE,
        tooltip: { formatter: '{b}: {c} submissions' },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        series: [{
            type: 'treemap',
            roam: false,
            nodeClick: false,
            breadcrumb: { show: false },
            label: { show: true, formatter: '{b}', color: '#fff', fontSize: 12, overflow: 'truncate' },
            itemStyle: { borderColor: '#fff', borderWidth: 2, gapWidth: 2 },
            levels: [{ itemStyle: { borderWidth: 0 } }],
            data: paginatedResponsibilityStats.map((r, i) => ({
                name: r.title,
                value: r.totalSubmissions,
                itemStyle: { color: ECHARTS_PALETTE[i % ECHARTS_PALETTE.length] }
            }))
        }]
    };

    const statusDonutOption = {
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
                { value: analyticsStats.rejected, name: 'Rejected' }
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
            { name: 'Total Responsibilities', type: 'line', smooth: false, showSymbol: false, lineStyle: { width: 1.5 }, areaStyle: { opacity: 0.1 }, data: dailyData.map(d => d.submissions) },
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

    const staffHoursOption = {
        color: ECHARTS_PALETTE,
        tooltip: { trigger: 'item' },
        legend: { type: 'scroll', bottom: 0, left: 'center' },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        series: [{
            name: 'Hours Worked',
            type: 'pie',
            radius: '60%',
            data: staffStats.map(s => ({
                value: s.hours, name: s.name.split(' ')[0]
            }))
        }]
    };

    const staffDistributionOption = {
        color: ECHARTS_PALETTE,
        tooltip: { trigger: 'item' },
        legend: { type: 'scroll', bottom: 0, left: 'center' },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        series: [{
            name: 'Submissions',
            type: 'pie',
            radius: '60%',
            data: staffStats.slice(0, 8).map(s => ({
                value: s.total, name: s.name.split(' ')[0]
            }))
        }]
    };

    const staffApprovalOption = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        visualMap: {
            show: false,
            min: 0,
            max: 100,
            inRange: {
                color: ['#F2846B', '#F5C242', '#85C170']
            }
        },
        xAxis: { type: 'category', data: staffStats.map(s => s.name.split(' ')[0]) },
        yAxis: { type: 'value', max: 100, name: 'Approval Rate (%)' },
        series: [{
            name: 'Approval Rate (%)',
            type: 'bar',
            data: staffStats.map(s => s.approvalRate)
        }]
    };

    const responsibilityDistributionOption = {
        color: ECHARTS_PALETTE,
        tooltip: { trigger: 'item' },
        legend: { type: 'scroll', bottom: 0, left: 'center' },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        series: [{
            name: 'Submissions',
            type: 'pie',
            radius: '60%',
            data: responsibilityStats.slice(0, 6).map(r => ({
                value: r.totalSubmissions, name: r.title.length > 15 ? r.title.substring(0, 15) + '...' : r.title
            }))
        }]
    };

    const responsibilityStatusOption = {
        color: ['#85C170', '#F5C242', '#F2846B'],
        tooltip: { trigger: 'item' },
        legend: { bottom: 0, left: 'center' },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        series: [{
            name: 'Status',
            type: 'pie',
            radius: '60%',
            data: [
                { value: responsibilityStats.reduce((sum, r) => sum + r.verified, 0), name: 'Verified' },
                { value: responsibilityStats.reduce((sum, r) => sum + r.pending, 0), name: 'Pending' },
                { value: responsibilityStats.reduce((sum, r) => sum + r.rejected, 0), name: 'Rejected' }
            ]
        }]
    };

    const responsibilityFullTitles = responsibilityStats.map(r => r.title);
    const responsibilityCompletionOption = {
        color: ['#4A90D9'],
        tooltip: { 
            trigger: 'axis', 
            axisPointer: { type: 'shadow' },
            formatter: function (params: any) {
                const dataIndex = params[0].dataIndex;
                const fullTitle = responsibilityFullTitles[dataIndex];
                const value = params[0].value;
                return `${fullTitle}<br/>${params[0].marker} Completion Rate: ${value}%`;
            }
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        xAxis: { type: 'value', max: 100, name: 'Completion Rate (%)' },
        yAxis: { type: 'category', data: responsibilityStats.map(r => r.title.length > 25 ? r.title.substring(0, 22) + '...' : r.title) },
        series: [{
            name: 'Completion Rate (%)',
            type: 'bar',
            data: responsibilityStats.map(r => r.completionRate)
        }]
    };

    const { submittedDates, missingDates } = useMemo(() => {
        
        if (!user?.id) return { submittedDates: [], missingDates: [] }
        
        // Filter submissions to only the manager's own submissions
        const mySubmissions = submissions.filter(s => String(s.staffId) === String(user.id))
        
        const todayStart = new Date()
        todayStart.setHours(0,0,0,0)
        
        const submitted: Date[] = []
        const missing: Date[] = []

        // Check past lookbackDays for indicators (today is excluded - it isn't "missed" until the day is over)
        for (let i = 1; i <= lookbackDays; i++) {
            const date = new Date(todayStart)
            date.setDate(date.getDate() - i)
            const dateSubmissions = getSubmissionsForDate(mySubmissions, date)
            if (dateSubmissions.length > 0) {
                submitted.push(date)
            } else {
                missing.push(date)
            }
        }
        return { submittedDates: submitted, missingDates: missing }
    }, [submissions, user?.id, lookbackDays])

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
                <Skeleton className="h-10 w-64" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
                </div>
                <Skeleton className="h-[400px]" />
            </div>
        )
    }
    const getDayStatusCategory = (day: Date) => {
        const todayStart = new Date(today)
        todayStart.setHours(0,0,0,0)
        const dayStart = new Date(day)
        dayStart.setHours(0,0,0,0)
        
        if (dayStart > todayStart) return 'future'
        
        const mySubmissions = submissions.filter(s => String(s.staffId) === String(user?.id))
        const daySubmissions = getSubmissionsForDate(mySubmissions, dayStart)
        
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
                        Manage your team's work here.
                    </p>
                </div>
                <ManagerExportDialog
                    submissions={submissions}
                    staffList={staffList}
                    responsibilities={responsibilities}
                    assignments={assignments}
                    subDepartmentName={subDepartment?.name || 'Sub-Department'}
                />
            </div>

            <div className="my-10 bg-card rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border/50 p-6 md:p-8 flex flex-col lg:flex-row gap-8 lg:gap-12 w-full max-w-6xl mx-auto">
                {/* Left Side: Title and Description */}
                <div className="w-full lg:w-1/3 space-y-4 pt-2">
                    <div className="flex items-center gap-3">
                        <CalendarCheck className="h-8 w-8 text-foreground" />
                        <h2 className="text-2xl  tracking-tight text-foreground">
                            Submit Work
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
                                        router.push(`/manager/work-calendar/${format(date, 'yyyy-MM-dd')}`)
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
                                                        router.push(`/manager/work-calendar/${format(day, 'yyyy-MM-dd')}`)
                                                    }
                                                }}
                                                className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${status === 'future' ? 'opacity-50 pointer-events-none' : 'hover:border-primary/50 cursor-pointer hover:shadow-md bg-card'}`}
                                            >
                                                <span className="text-sm text-muted-foreground uppercase tracking-wider mb-2">{format(day, 'EEE')}</span>
                                                <span className={`text-3xl font-bold mb-4 ${isSameDay(day, today) ? 'text-primary' : 'text-foreground'}`}>{format(day, 'd')}</span>
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
                                                onClick={() => router.push(`/manager/work-calendar/${format(day, 'yyyy-MM-dd')}`)}
                                                className="flex items-center justify-between p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${isSameDay(day, today) ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                                                        {format(day, 'd')}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-foreground">{format(day, 'EEEE')}</h4>
                                                        <p className="text-sm text-muted-foreground">{format(day, 'MMMM yyyy')}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {renderStatusBadge(status)}
                                                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
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
                            <div className="w-4 h-4 rounded-sm bg-amber-50 border border-amber-200 dark:bg-amber-900/30 dark:border-amber-800"></div> 
                            Pending
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-sm bg-red-50 border border-red-200 dark:bg-red-900/30 dark:border-red-800"></div> 
                            Missed
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-sm bg-background border border-input"></div> 
                            No Data
                        </div>
                    </div>
                </div>
            </div>

            {/* Analytics Header with Filters */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* <div>
                    <h2 className="text-2xl  tracking-tight">Team Analytics</h2>
                    <p className="text-muted-foreground">
                        {subDepartment?.name || 'Sub-Department'} performance metrics and insights
                    </p>
                </div> */}
              
            </div>

            {/* Analytics Stats Cards (based on filtered date range) */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card className="cursor-pointer transition-all hover:shadow-md" onClick={() => router.push('/manager/staff')}>
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
                        <div className="text-2xl  text-indigo-600">{analyticsStats.total}</div>
                        <p className="text-xs text-muted-foreground">{analyticsStats.totalHours.toFixed(1)} hours logged</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl  text-green-600">{analyticsStats.approvalRate}%</div>
                        <p className="text-xs text-muted-foreground">{analyticsStats.verified} verified of {analyticsStats.total}</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer transition-all hover:shadow-md" onClick={() => router.push('/manager/staff')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl  text-amber-600">{analyticsStats.pending}</div>
                        <p className="text-xs text-muted-foreground">Awaiting verification</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Verified Hours</CardTitle>
                        <FileCheck className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl  text-purple-600">{analyticsStats.verifiedHours.toFixed(1)}h</div>
                        <p className="text-xs text-muted-foreground">Approved work hours</p>
                    </CardContent>
                </Card>
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
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            {/* <Activity className="h-5 w-5 text-indigo-500" /> */}
                                            Daily Responsibilities
                                        </CardTitle>
                                        <CardDescription>Responsibilities trend over time</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="w-full min-h-[300px]">
                                            <ReactECharts option={dailySubmissionsOption} style={{ height: '300px', width: '100%' }} />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            {/* <Target className="h-5 w-5 text-green-500" /> */}
                                            Status Distribution
                                        </CardTitle>
                                        <CardDescription>Breakdown by submission status</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="w-full min-h-[300px]">
                                    {analyticsStats.total > 0 ? (
                                            <ReactECharts option={statusDonutOption} style={{ height: '300px', width: '100%' }} />
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
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        Staff Hours
                                    </CardTitle>
                                    <CardDescription>Hours worked by each employee</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="w-full min-h-[250px]">
                                            <ReactECharts option={staffHoursOption} style={{ height: '250px', width: '100%' }} />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Staff Performance Tab - ENHANCED */}
                <TabsContent value="staff" className="space-y-4">
                    {/* Top Stats for Staff */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
                                <Award className="h-4 w-4 text-yellow-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg  text-yellow-600">
                                    {staffStats[0]?.name.split(' ')[0] || 'N/A'}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {staffStats[0]?.total || 0} submissions
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Avg Approval</CardTitle>
                                <TrendingUp className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg  text-green-600">
                                    {staffStats.length > 0 ? Math.round(staffStats.reduce((sum, s) => sum + s.approvalRate, 0) / staffStats.length) : 0}%
                                </div>
                                <p className="text-xs text-muted-foreground">Team average</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                                <Clock className="h-4 w-4 text-purple-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg  text-purple-600">
                                    {staffStats.reduce((sum, s) => sum + s.hours, 0).toFixed(1)}h
                                </div>
                                <p className="text-xs text-muted-foreground">All staff combined</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
                                <Users className="h-4 w-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg  text-blue-600">
                                    {staffStats.filter(s => s.total > 0).length}
                                </div>
                                <p className="text-xs text-muted-foreground">With submissions</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            Submission Distribution
                                        </CardTitle>
                                        <CardDescription>Top performers by submission count</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    {staffStats.length > 0 ? (
                                        <ReactECharts option={staffDistributionOption} style={{ height: '100%', width: '100%' }} />
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground">
                                            No staff data available
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Activity className="h-5 w-5 text-indigo-500" />
                                            Status Breakdown
                                        </CardTitle>
                                        <CardDescription>Verified, pending, and rejected by staff</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="w-full min-h-[300px]">
                                            <ReactECharts option={staffComparisonOption} style={{ height: '300px', width: '100%' }} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Clock className="h-5 w-5 text-purple-500" />
                                            Hours Worked
                                        </CardTitle>
                                        <CardDescription>Verified hours by staff member</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="w-full min-h-[300px]">
                                    <ReactECharts option={staffHoursOption} style={{ height: '300px', width: '100%' }} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <TrendingUp className="h-5 w-5 text-green-500" />
                                            Approval Rates
                                        </CardTitle>
                                        <CardDescription>Approval rate trend across staff</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="w-full min-h-[300px]">
                                        <ReactECharts option={staffApprovalOption} style={{ height: '300px', width: '100%' }} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Staff Details Table */}
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <CardTitle>Staff Details</CardTitle>
                                    <CardDescription>Individual performance metrics</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px]">
                                <div className="space-y-3">
                                    {staffStats.map((staff, index) => (
                                        <div
                                            key={staff.id}
                                            className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                        <Avatar className="h-10 w-10 ring-2 ring-primary/20 hover:ring-primary/40 transition-all border-2 border-background shadow-sm flex-shrink-0">
                                                {staff.avatarUrl ? (
                                                    <AvatarImage src={staff.avatarUrl} alt={staff.name || ''} />
                                                ) : (
                                                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-semibold text-sm">
                                                        {staff.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                                                    </AvatarFallback>
                                                )}
                                            </Avatar>
                                                    {index < 3 && (
                                                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-400 border-2 border-white flex items-center justify-center text-xs ">
                                                            {index + 1}
                                                        </div>
                                                    )}
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
                                                <div className="flex gap-4 text-sm text-muted-foreground items-center">
                                                    <div>
                                                        Verified: <span className="font-semibold text-foreground">{staff.verified}</span>
                                                    </div>
                                                    <div>
                                                        Pending: <span className="font-semibold text-foreground">{staff.pending}</span>
                                                    </div>
                                                    <div>
                                                        Rejected: <span className="font-semibold text-foreground">{staff.rejected}</span>
                                                    </div>
                                                </div>
                                                <div className="text-center min-w-[80px]">
                                                    <p className="text-lg font-semibold text-foreground">{staff.hours}h</p>
                                                    <p className="text-xs text-muted-foreground">Total Hours</p>
                                                </div>
                                                <div className="text-center min-w-[60px]">
                                                    <p className="text-lg font-semibold text-foreground">
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

                {/* Responsibilities Tab - ENHANCED */}
                <TabsContent value="responsibilities" className="space-y-4">
                    {/* Responsibility Filter */}
                    {/* <div className="flex items-center gap-2">
                        <Select value={selectedResponsibilityId} onValueChange={setSelectedResponsibilityId}>
                            <SelectTrigger className="w-[250px]">
                                <Briefcase className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Select responsibility" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Responsibilities</SelectItem>
                                {responsibilities.map(resp => (
                                    <SelectItem key={resp.id} value={String(resp.id)}>
                                        {resp.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div> */}

                    {/* Top Stats for Responsibilities */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                                <Target className="h-4 w-4 text-indigo-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg  text-indigo-600">
                                    {responsibilities.filter(r => r.isActive).length}
                                </div>
                                <p className="text-xs text-muted-foreground">Active responsibilities</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Most Active</CardTitle>
                                <Award className="h-4 w-4 text-yellow-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg  text-yellow-600 truncate">
                                    {responsibilityStats[0]?.title.substring(0, 15) || 'N/A'}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {responsibilityStats[0]?.totalSubmissions || 0} submissions
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
                                <TrendingUp className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg  text-green-600">
                                    {responsibilityStats.length > 0 ? Math.round(responsibilityStats.reduce((sum, r) => sum + r.completionRate, 0) / responsibilityStats.length) : 0}%
                                </div>
                                <p className="text-xs text-muted-foreground">Overall average</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Staff Coverage</CardTitle>
                                <Users className="h-4 w-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg  text-blue-600">
                                    {responsibilityStats.reduce((sum, r) => sum + r.assignedStaff, 0)}
                                </div>
                                <p className="text-xs text-muted-foreground">Total assignments</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            Activity Distribution
                                        </CardTitle>
                                        <CardDescription>Submissions by responsibility</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="w-full min-h-[300px]">
                                    {responsibilityStats.length > 0 ? (
                                        <ReactECharts option={responsibilityDistributionOption} style={{ height: '300px', width: '100%' }} />
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground">
                                            No responsibility data available
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Activity className="h-5 w-5 text-indigo-500" />
                                            Status Breakdown
                                        </CardTitle>
                                        <CardDescription>Verified, pending, rejected by task</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="w-full min-h-[300px]">
                                        <ReactECharts option={responsibilityStatusOption} style={{ height: '300px', width: '100%' }} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            {/* <Target className="h-5 w-5 text-green-500" /> */}
                                            Completion Rates
                                        </CardTitle>
                                        <CardDescription>Success rate trend across responsibilities</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="w-full min-h-[300px]">
                                        <ReactECharts option={responsibilityCompletionOption} style={{ height: '300px', width: '100%' }} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Responsibilities Details */}
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Briefcase className="h-5 w-5 text-indigo-500" />
                                        Responsibilities Overview
                                    </CardTitle>
                                    <CardDescription>Performance by responsibility</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="w-full min-h-[500px]">
                                {paginatedResponsibilityStats.length > 0 ? (
                                    <>
                                        <div className="h-[450px] w-full">
                                            <ReactECharts option={responsibilityTreemapOption} style={{ height: '100%', width: '100%' }} />
                                        </div>
                                        <div className="flex justify-between items-center mt-4">
                                            <Button variant="outline" size="sm" onClick={() => setRespPage(p => Math.max(1, p - 1))} disabled={respPage === 1}>Previous</Button>
                                            <span className="text-sm text-muted-foreground">Page {respPage} of {totalRespPages || 1}</span>
                                            <Button variant="outline" size="sm" onClick={() => setRespPage(p => Math.min(totalRespPages, p + 1))} disabled={respPage >= totalRespPages || totalRespPages === 0}>Next</Button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-muted-foreground min-h-[400px]">
                                        No responsibilities found
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dashboard Stats Cards (based on TODAY) */}
            {/* <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
               <p>Todays  Stats: </p>
                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                        <Clock className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl ">{dashboardStats.pendingVerifications}</div>
                        <p className="text-xs text-muted-foreground">
                            Awaiting verification (Today)
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Verified Today</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl ">{dashboardStats.verifiedCount}</div>
                        <p className="text-xs text-muted-foreground">
                            Completed verifications
                        </p>
                    </CardContent>
                </Card>
            </div> */}

            {/* Pending Verifications */}
            {/* <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Pending Verifications</CardTitle>
                        <CardDescription>Submissions awaiting your review</CardDescription>
                    </div>
                    {dashboardStats.pendingVerifications > 0 && (
                        <Button asChild>
                            <Link href="/manager/submissions">
                                View All <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {pendingSubmissions.length === 0 ? (
                        <div className="text-center py-8">
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                            <p className="text-muted-foreground">
                                All caught up! No pending verifications.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Review {pendingSubmissions.length} pending submissions in the Submissions section.
                            </p>

                            <Button asChild className="mt-4">
                                <Link href="/manager/submissions" className="flex items-center">
                                    View all submissions
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card> */}

            {/* Quick Actions */}
            {/* <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <Link href="/manager/submissions">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileCheck className="h-5 w-5" />
                                Review Submissions
                            </CardTitle>
                            <CardDescription>
                                Review and approve staff work submissions
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <Link href="/manager/assignments">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ClipboardList className="h-5 w-5" />
                                Manage Assignments
                            </CardTitle>
                            <CardDescription>
                                Create and manage work assignments for your team
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <Link href="/manager/staff">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                My Staff
                            </CardTitle>
                            <CardDescription>
                                View staff members and their submissions
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <Link href="/manager/responsibilities">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Briefcase className="h-5 w-5" />
                                Responsibilities
                            </CardTitle>
                            <CardDescription>
                                Create and manage work responsibilities
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>
            </div> */}
        </div>
    )
}