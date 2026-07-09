"use client"

import { useEffect, useState, useMemo, Suspense } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/providers/auth-context"
import { api } from "@/lib/api"
import { Employee, WorkSubmission, SemReport } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { RoleBadge, SubmissionStatusBadge } from "@/components/ui/status-badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import {
    User,
    Mail,
    Building,
    Eye,
    CheckCircle,
    XCircle,
    Clock,
    ArrowLeft,
    FileText,
    Link2,
    MessageSquare,
    CalendarIcon,
    TrendingUp,
    Activity,
    Target,
} from "lucide-react"

import { toast } from "sonner"
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns"
import ReactECharts from 'echarts-for-react'
import { ECHARTS_COMMON_OPTS, ECHARTS_PALETTE } from '@/lib/echarts-theme'
import { SemReportCard } from "@/components/sem-reports/sem-report-card"
import { SemReportDetail } from "@/components/sem-reports/sem-report-detail"
import { ReviewActions } from "@/components/sem-reports/review-actions"

type DateRange = { from: Date; to: Date }

function StaffDetailContent({ staffId }: { staffId: string }) {
    const router = useRouter()
    const { user } = useAuth()
    const isOwnSubmission = String(user?.id) === String(staffId)
    const [staff, setStaff] = useState<Employee | null>(null)
    const [staffSubmissions, setStaffSubmissions] = useState<WorkSubmission[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Semester reports state
    const [semReports, setSemReports] = useState<SemReport[]>([])
    const [semReportsLoading, setSemReportsLoading] = useState(false)
    const [expandedReportId, setExpandedReportId] = useState<number | null>(null)
    const [semReviewLoading, setSemReviewLoading] = useState(false)

    // Selected date for daily submissions view
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [openDay, setOpenDay] = useState<string>(format(new Date(), 'yyyy-MM-dd'))

    // Submissions date range filter
    const [submissionDateRange, setSubmissionDateRange] = useState<DateRange>({
        from: subDays(new Date(), 30),
        to: new Date(),
    })
    const [submissionsPage, setSubmissionsPage] = useState(1)
    const SUBMISSIONS_PER_PAGE = 10
    const [submissionStatusFilter, setSubmissionStatusFilter] = useState<string>("all")

    // Analytics date range
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 30),
        to: new Date(),
    })

    // Review dialog
    const [selectedSubmission, setSelectedSubmission] = useState<WorkSubmission | null>(null)
    const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
    const [rejectionReason, setRejectionReason] = useState("")
    const [isVerifying, setIsVerifying] = useState(false)
    const [newStatus, setNewStatus] = useState<string>("")

    useEffect(() => {
        fetchStaffData()
    }, [staffId])

    async function fetchStaffData() {
        try {
            const [employees, allSubmissions] = await Promise.all([
                api.employees.getAll(),
                api.workSubmissions.getAll(),
            ])

            const staffMember = employees.find(e => String(e.id) === staffId)
            if (!staffMember) {
                toast.error("Staff member not found")
                router.push('/manager/staff')
                return
            }

            setStaff(staffMember)
            setStaffSubmissions(allSubmissions.filter(s => String(s.staffId) === staffId))

            // Fetch semester reports for this staff member
            try {
                setSemReportsLoading(true)
                const reports = await api.semReports.getByStaffId(Number(staffId))
                setSemReports(reports)
            } catch (err) {
                console.error("Failed to fetch sem reports:", err)
            } finally {
                setSemReportsLoading(false)
            }
        } catch (error) {
            console.error("Failed to fetch staff data:", error)
            toast.error("Failed to load staff data")
        } finally {
            setIsLoading(false)
        }
    }

    // Semester report review handlers
    const handleSemApprove = async (reportId: number) => {
        try {
            setSemReviewLoading(true)
            await api.semReports.managerReview(reportId, { action: "APPROVE" })
            toast.success("Report approved and forwarded to Admin review")
            setExpandedReportId(null)
            const reports = await api.semReports.getByStaffId(Number(staffId))
            setSemReports(reports)
        } catch (err: any) {
            toast.error(err?.message || "Failed to approve report")
        } finally {
            setSemReviewLoading(false)
        }
    }

    const handleSemReject = async (reportId: number, reason: string) => {
        try {
            setSemReviewLoading(true)
            await api.semReports.managerReview(reportId, {
                action: "REJECT",
                rejectionReason: reason,
            })
            toast.success("Report rejected")
            setExpandedReportId(null)
            const reports = await api.semReports.getByStaffId(Number(staffId))
            setSemReports(reports)
        } catch (err: any) {
            toast.error(err?.message || "Failed to reject report")
        } finally {
            setSemReviewLoading(false)
        }
    }

    const pendingSemReports = semReports.filter((r) => r.status === "UNDER_MANAGER_REVIEW")
    const reviewedSemReports = semReports.filter((r) => r.status !== "UNDER_MANAGER_REVIEW" && r.status !== "DRAFT")

    // Group submissions by status
    const groupedSubmissions = useMemo(() => {
        const pending = staffSubmissions.filter(s => s.status === 'SUBMITTED' || s.status === 'PENDING')
        const approved = staffSubmissions.filter(s => s.status === 'VERIFIED')
        const rejected = staffSubmissions.filter(s => s.status === 'REJECTED')
        return { pending, approved, rejected }
    }, [staffSubmissions])

    // Filter submissions by date range + status
    const dateRangeSubmissions = useMemo(() => {
        return staffSubmissions.filter(s => {
            const date = new Date(s.workDate || s.submittedAt)
            const inRange = date >= submissionDateRange.from && date <= submissionDateRange.to
            if (!inRange) return false
            if (submissionStatusFilter === "all") return true
            if (submissionStatusFilter === "pending") return s.status === 'SUBMITTED' || s.status === 'PENDING'
            if (submissionStatusFilter === "approved") return s.status === 'VERIFIED'
            if (submissionStatusFilter === "rejected") return s.status === 'REJECTED'
            return true
        }).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    }, [staffSubmissions, submissionDateRange, submissionStatusFilter])

    // Paginated submissions
    const submissionsTotalPages = Math.ceil(dateRangeSubmissions.length / SUBMISSIONS_PER_PAGE)
    const paginatedSubmissions = useMemo(() => {
        const start = (submissionsPage - 1) * SUBMISSIONS_PER_PAGE
        return dateRangeSubmissions.slice(start, start + SUBMISSIONS_PER_PAGE)
    }, [dateRangeSubmissions, submissionsPage])

    // Filter submissions by date range for analytics
    const filteredSubmissions = useMemo(() => {
        return staffSubmissions.filter(s => {
            const date = new Date(s.submittedAt)
            return date >= dateRange.from && date <= dateRange.to
        })
    }, [staffSubmissions, dateRange])

    // Analytics stats
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

    // Daily data for charts
    const dailyChartData = useMemo(() => {
        const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to })

        return days.map(day => {
            const daySubmissions = filteredSubmissions.filter(s =>
                isSameDay(new Date(s.submittedAt), day)
            )
            const verified = daySubmissions.filter(s => s.status === 'VERIFIED').length
            const pendingCount = daySubmissions.filter(s => s.status === 'SUBMITTED' || s.status === 'PENDING').length
            const rejectedCount = daySubmissions.filter(s => s.status === 'REJECTED').length
            const hours = daySubmissions.reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)

            return {
                date: format(day, 'MMM d'),
                submissions: daySubmissions.length,
                verified,
                pending: pendingCount,
                rejected: rejectedCount,
                hours: Math.round(hours * 10) / 10,
            }
        })
    }, [filteredSubmissions, dateRange])

    // ECharts Configurations
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

    const respMap = new Map<string, number>();
    filteredSubmissions.forEach(s => {
        const title = s.assignment?.responsibility?.title || 'Unknown';
        const hours = (s as any).hoursWorked || 0;
        respMap.set(title, (respMap.get(title) || 0) + hours);
    });
    const respEntries = Array.from(respMap.entries()).sort((a, b) => b[1] - a[1]);
    
    const responsibilityHoursOption = {
        color: ECHARTS_PALETTE,
        tooltip: { 
            trigger: 'axis', 
            axisPointer: { type: 'shadow' },
            formatter: function (params: any) {
                const dataIndex = params[0].dataIndex;
                const fullTitle = respEntries[dataIndex][0];
                return `${fullTitle}<br/>${params[0].marker} Hours Worked: ${params[0].value}h`;
            }
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        xAxis: { type: 'category', data: respEntries.map(([t]) => t.length > 20 ? t.substring(0, 18) + '...' : t) },
        yAxis: { type: 'value', name: 'Hours' },
        series: [{
            name: 'Hours Worked',
            type: 'bar',
            data: respEntries.map(([, h]) => Math.round(h * 10) / 10),
            itemStyle: {
                color: (params: any) => ECHARTS_PALETTE[params.dataIndex % ECHARTS_PALETTE.length]
            }
        }]
    };

    const hoursTrendOption = {
        color: ['#9B7ED9'],
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { top: 0 },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        toolbox: ECHARTS_COMMON_OPTS.toolbox,
        xAxis: { type: 'category', boundaryGap: false, data: dailyChartData.map(d => d.date) },
        yAxis: { type: 'value', name: 'Hours' },
        dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            { type: 'slider', start: 0, end: 100, height: 16, bottom: 0 }
        ],
        series: [
            { name: 'Hours Worked', type: 'line', smooth: false, showSymbol: false, lineStyle: { width: 1.5 }, areaStyle: { opacity: 0.1 }, data: dailyChartData.map(d => d.hours) }
        ]
    };

    async function handleVerify(status: 'VERIFIED' | 'REJECTED', submission?: WorkSubmission) {
        const targetSubmission = submission || selectedSubmission
        if (!targetSubmission) return

        if (status === 'REJECTED' && !rejectionReason.trim()) {
            toast.error("Rejection reason is required")
            return
        }

        setIsVerifying(true)
        try {
            await api.workSubmissions.verify(targetSubmission.id, {
                approved: status === 'VERIFIED',
                managerComment: status === 'REJECTED' ? rejectionReason.trim() : undefined,
            })
            toast.success(`Submission ${status === 'VERIFIED' ? 'approved' : 'rejected'} successfully`)
            setReviewDialogOpen(false)
            setSelectedSubmission(null)
            setRejectionReason("")
            await fetchStaffData()
        } catch (error: any) {
            console.error("Failed to verify submission:", error)
            toast.error(error.message || "Failed to verify submission")
        } finally {
            setIsVerifying(false)
        }
    }

    function openReviewDialog(submission: WorkSubmission) {
        setSelectedSubmission(submission)
        setRejectionReason("")
        setNewStatus(submission.status) // Pre-fill with current status
        setReviewDialogOpen(true)
    }

    async function handleStatusChange() {
        if (!selectedSubmission || !newStatus) return
        if (newStatus === selectedSubmission.status) {
            setReviewDialogOpen(false)
            return
        }

        if (newStatus === 'REJECTED' && !rejectionReason.trim()) {
            toast.error("Rejection reason is required")
            return
        }

        setIsVerifying(true)
        try {
            await api.workSubmissions.verify(selectedSubmission.id, {
                approved: newStatus === 'VERIFIED',
                managerComment: newStatus === 'REJECTED' ? rejectionReason.trim() : undefined,
            })
            toast.success(`Submission status changed to ${newStatus === 'VERIFIED' ? 'Approved' : 'Rejected'}`)
            setReviewDialogOpen(false)
            setSelectedSubmission(null)
            setRejectionReason("")
            setNewStatus("")
            await fetchStaffData()
        } catch (error: any) {
            console.error("Failed to update submission status:", error)
            toast.error(error.message || "Failed to update status")
        } finally {
            setIsVerifying(false)
        }
    }

    const SubmissionTable = ({ data, showActions = true }: { data: WorkSubmission[], showActions?: boolean }) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Responsibility</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No submissions found
                        </TableCell>
                    </TableRow>
                ) : (
                    data.map((submission) => (
                        <TableRow key={submission.id}>
                            <TableCell className="font-medium">
                                {submission.assignment?.responsibility?.title || 'N/A'}
                            </TableCell>
                            <TableCell>
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {(submission as any).hoursWorked || '-'}h
                                </span>
                            </TableCell>
                            <TableCell>
                                {format(new Date(submission.submittedAt), "MMM d, h:mm a")}
                            </TableCell>
                            <TableCell>
                                <SubmissionStatusBadge status={submission.status} />
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openReviewDialog(submission)}
                                    >
                                        <Eye className="h-4 w-4 mr-1" /> Review
                                    </Button>
                                    {showActions && (submission.status === 'SUBMITTED' || submission.status === 'PENDING') && (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                disabled={isVerifying}
                                                onClick={() => handleVerify('VERIFIED', submission)}
                                            >
                                                <CheckCircle className="h-4 w-4" /> Approve
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => openReviewDialog(submission)}
                                            >
                                                <XCircle className="h-4 w-4" /> Reject
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    )

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
                                onClick={() => router.push('/manager/staff')}
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Staff List
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Back Button and Header */}
            <div>
                <Button variant="ghost" size="sm" onClick={() => router.push('/manager/staff')} className="mb-4">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Staff List
                </Button>
                <h1 className="text-3xl  tracking-tight">{staff.name}</h1>
                <p className="text-muted-foreground">Staff member details and submissions</p>
            </div>

            {/* Staff Info Card */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-start gap-6">
                        <Avatar className="h-24 w-24 ring-2 ring-primary/20 hover:ring-primary/40 transition-all border-2 border-background shadow-sm flex-shrink-0">
                            {staff.avatarUrl ? (
                                <AvatarImage src={staff.avatarUrl} alt={staff.name || ''} />
                            ) : (
                                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-semibold text-sm">
                                    {staff.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                                </AvatarFallback>
                            )}
                        </Avatar>
                        <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                <span>{staff.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span>{staff.email}</span>
                            </div>
                                <div className="flex items-center gap-2">
                                    <Building className="h-4 w-4 text-muted-foreground" />
                                    <span>{staff.subDepartment?.name}</span> | <span>{staff.department?.name}</span>
                                </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Submissions */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row justify-between gap-4">
                            <div>
                                <CardTitle>All Submissions</CardTitle>
                                <CardDescription>
                                    {dateRangeSubmissions.length} submission{dateRangeSubmissions.length !== 1 ? 's' : ''} found
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-9 justify-start text-left font-normal">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {format(submissionDateRange.from, "MMM dd, y")}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="end">
                                        <Calendar
                                            initialFocus
                                            mode="single"
                                            selected={submissionDateRange.from}
                                            onSelect={(date: any) => {
                                                if (date) {
                                                    setSubmissionDateRange(prev => ({ ...prev, from: date }))
                                                    setSubmissionsPage(1)
                                                }
                                            }}
                                            className="p-2"
                                        />
                                    </PopoverContent>
                                </Popover>
                                <span className="text-sm text-muted-foreground">to</span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-9 justify-start text-left font-normal">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {format(submissionDateRange.to, "MMM dd, y")}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="end">
                                        <Calendar
                                            initialFocus
                                            mode="single"
                                            selected={submissionDateRange.to}
                                            onSelect={(date: any) => {
                                                if (date) {
                                                    setSubmissionDateRange(prev => ({ ...prev, to: date }))
                                                    setSubmissionsPage(1)
                                                }
                                            }}
                                            className="p-2"
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        {/* Status filter tabs */}
                        <div className="flex flex-wrap gap-2">
                            {[
                                { key: "all", label: "All", count: staffSubmissions.length },
                                { key: "pending", label: "Pending", count: groupedSubmissions.pending.length, icon: <Clock className="h-3 w-3 text-amber-500" /> },
                                { key: "approved", label: "Approved", count: groupedSubmissions.approved.length, icon: <CheckCircle className="h-3 w-3 text-green-500" /> },
                                { key: "rejected", label: "Rejected", count: groupedSubmissions.rejected.length, icon: <XCircle className="h-3 w-3 text-red-500" /> },
                            ].map((tab) => (
                                <Button
                                    key={tab.key}
                                    variant={submissionStatusFilter === tab.key ? "default" : "outline"}
                                    size="sm"
                                    className="h-8 gap-1.5"
                                    onClick={() => { setSubmissionStatusFilter(tab.key); setSubmissionsPage(1) }}
                                >
                                    {tab.icon}
                                    {tab.label}
                                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                                        {tab.count}
                                    </Badge>
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Responsibility</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Hours</TableHead>
                                <TableHead>Status</TableHead>
                                {!isOwnSubmission && <TableHead className="text-right">Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedSubmissions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={!isOwnSubmission ? 5 : 4} className="text-center py-8 text-muted-foreground">
                                        No submissions in selected date range
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedSubmissions.map((submission) => (
                                    <TableRow key={submission.id}>
                                        <TableCell className="font-medium max-w-[200px] truncate">
                                            {submission.assignment?.responsibility?.title || 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {format(new Date(submission.workDate || submission.submittedAt), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {(submission as any).hoursWorked || '-'}h
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <SubmissionStatusBadge status={submission.status} />
                                        </TableCell>
                                        {!isOwnSubmission && (
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => openReviewDialog(submission)}>
                                                    <Eye className="h-4 w-4 mr-1" /> Review
                                                </Button>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    {submissionsTotalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            <p className="text-sm text-muted-foreground">
                                Page {submissionsPage} of {submissionsTotalPages} ({dateRangeSubmissions.length} submissions)
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSubmissionsPage(p => Math.max(1, p - 1))}
                                    disabled={submissionsPage === 1}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSubmissionsPage(p => Math.min(submissionsTotalPages, p + 1))}
                                    disabled={submissionsPage === submissionsTotalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Semester Reports Section - Between Submissions and Analytics */}
            <Card>
                <CardHeader>
                    <CardTitle>Semester Reports</CardTitle>
                    {/* <CardDescription>
                        Review semester reports submitted by {staff.name}
                    </CardDescription> */}
                </CardHeader>
                <CardContent>
                    {semReportsLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </div>
                    ) : semReports.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                            <p className="text-muted-foreground text-sm">No semester reports found for this staff member.</p>
                        </div>
                    ) : (
                        <Tabs defaultValue="pending-sem">
                            <TabsList className="mb-4">
                                <TabsTrigger value="pending-sem" className="gap-2">
                                    Pending Review
                                    {pendingSemReports.length > 0 && (
                                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs">
                                            {pendingSemReports.length}
                                        </span>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="reviewed-sem" className="gap-2">
                                    Reviewed
                                    {reviewedSemReports.length > 0 && (
                                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">
                                            {reviewedSemReports.length}
                                        </span>
                                    )}
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="pending-sem">
                                {pendingSemReports.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                        <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                                        <p className="text-muted-foreground text-sm">No reports pending your review.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4">
                                        {pendingSemReports.map((report) => (
                                            <div key={report.id} className="space-y-0">
                                                <div
                                                    className="cursor-pointer"
                                                    onClick={() =>
                                                        setExpandedReportId(expandedReportId === report.id ? null : report.id)
                                                    }
                                                >
                                                    <SemReportCard report={report} />
                                                </div>
                                                {expandedReportId === report.id && (
                                                    <Card className="border-t-0 rounded-t-none pt-4 p-6">
                                                        <SemReportDetail report={report}>
                                                            {!isOwnSubmission && (
                                                                <ReviewActions
                                                                    onApprove={() => handleSemApprove(report.id)}
                                                                    onReject={(reason) => handleSemReject(report.id, reason)}
                                                                    isLoading={semReviewLoading}
                                                                />
                                                            )}
                                                        </SemReportDetail>
                                                    </Card>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="reviewed-sem">
                                {reviewedSemReports.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                        <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                                        <p className="text-muted-foreground text-sm">No reviewed reports yet.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4">
                                        {reviewedSemReports.map((report) => (
                                            <div key={report.id} className="space-y-0">
                                                <div
                                                    className="cursor-pointer"
                                                    onClick={() =>
                                                        setExpandedReportId(expandedReportId === report.id ? null : report.id)
                                                    }
                                                >
                                                    <SemReportCard report={report} />
                                                </div>
                                                {expandedReportId === report.id && (
                                                    <Card className="border-t-0 rounded-t-none pt-4 p-6">
                                                        <SemReportDetail report={report} />
                                                    </Card>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    )}
                </CardContent>
            </Card>

            {/* Analytics Section */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                        <div>
                            <CardTitle>Performance Analytics</CardTitle>
                            <CardDescription>Detailed metrics for {staff.name}</CardDescription>
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
                                <div className="flex flex-wrap gap-1 p-2 border-b">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-7"
                                        onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}
                                    >
                                        7 days
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-7"
                                        onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}
                                    >
                                        30 days
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-7"
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
                                    onSelect={(range: any) => {
                                        if (range?.from && range?.to) {
                                            setDateRange(range)
                                        }
                                    }}
                                    numberOfMonths={1}
                                    className="p-2"
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Stats Cards */}
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 rounded-none">
                        <div className="rounded-none border bg-card p-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 ">
                                    <FileText className="h-4 w-4 text-blue-600" />
                                </div>
                                <span className="text-sm text-muted-foreground">Total Submissions</span>
                            </div>
                            <p className="text-2xl  mt-2">{analyticsStats.total}</p>
                        </div>
                        <div className="rounded-none border bg-card p-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 ">
                                    <TrendingUp className="h-4 w-4 text-green-600" />
                                </div>
                                <span className="text-sm text-muted-foreground">Approval Rate</span>
                            </div>
                            <p className="text-2xl  mt-2">{analyticsStats.approvalRate}%</p>
                        </div>
                        <div className="rounded-none border bg-card p-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 ">
                                    <Clock className="h-4 w-4 text-amber-600" />
                                </div>
                                <span className="text-sm text-muted-foreground">Pending Review</span>
                            </div>
                            <p className="text-2xl  mt-2">{analyticsStats.pending}</p>
                        </div>
                        <div className="rounded-none border bg-card p-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 ">
                                    <Clock className="h-4 w-4 text-purple-600" />
                                </div>
                                <span className="text-sm text-muted-foreground">Verified Hours</span>
                            </div>
                            <p className="text-2xl  mt-2">{analyticsStats.verifiedHours.toFixed(1)}h</p>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* Status Distribution Pie Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    Status Distribution
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex justify-center">
                                <div className="w-full min-h-[350px]">
                                    {analyticsStats.total > 0 ? (
                                        <ReactECharts option={statusDonutOption} style={{ height: '350px', width: '100%' }} />
                                    ) : (
                                        <div className="h-[350px] flex items-center justify-center text-muted-foreground text-sm">
                                            No submissions in selected period
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Hours by Responsibility Bar Chart */}
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    Hours by Responsibility
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="w-full min-h-[350px]">
                                    {respEntries.length > 0 ? (
                                        <ReactECharts option={responsibilityHoursOption} style={{ height: '350px', width: '100%' }} />
                                    ) : (
                                        <div className="h-[350px] flex items-center justify-center text-muted-foreground text-sm">
                                            No submission data available
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Hours Trend */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                Hours Trend
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="w-full min-h-[300px]">
                                <ReactECharts option={hoursTrendOption} style={{ height: '300px', width: '100%' }} />
                            </div>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>

            {/* Review Dialog */}
            <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-lg">{selectedSubmission?.assignment?.responsibility?.title || 'Submission'}</DialogTitle>
                        <DialogDescription>
                            {selectedSubmission && format(new Date(selectedSubmission.submittedAt), "EEEE, MMM d, yyyy 'at' h:mm a")}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSubmission && (
                        <div className="space-y-4">
                            {/* Quick Info Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs text-muted-foreground">Hours Worked</p>
                                    <p className="text-lg font-semibold">{(selectedSubmission as any).hoursWorked || 0}h</p>
                                </div>
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs text-muted-foreground">Current Status</p>
                                    <div className="mt-1"><SubmissionStatusBadge status={selectedSubmission.status} /></div>
                                </div>
                            </div>

                            {/* Staff Comment */}
                            {(selectedSubmission as any).staffComment && (
                                <div className="rounded-lg border p-3 space-y-1">
                                    <p className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Staff Comment</p>
                                    <p className="text-sm whitespace-pre-wrap">{(selectedSubmission as any).staffComment}</p>
                                </div>
                            )}

                            {/* Work Proof */}
                            {((selectedSubmission as any).workProofUrl || (selectedSubmission as any).workProofText) && (
                                <div className="rounded-lg border p-3 space-y-1">
                                    <p className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> Work Proof</p>
                                    {(selectedSubmission as any).workProofText && (
                                        <p className="text-sm whitespace-pre-wrap">{(selectedSubmission as any).workProofText}</p>
                                    )}
                                    {(selectedSubmission as any).workProofUrl && (
                                        <a href={(selectedSubmission as any).workProofUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                                            <Link2 className="h-3 w-3" /> View attachment
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Previous Rejection Reason */}
                            {selectedSubmission.status === 'REJECTED' && selectedSubmission.rejectionReason && (
                                <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                                    <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Previous Rejection Reason</p>
                                    <p className="text-sm text-red-600 dark:text-red-300">{selectedSubmission.rejectionReason}</p>
                                </div>
                            )}

                            {/* Change Status Dropdown */}
                            <div className="space-y-2 pt-2 border-t">
                                <Label className="text-sm font-medium">Change Status</Label>
                                <Select value={newStatus} onValueChange={setNewStatus}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select new status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="VERIFIED">
                                            <span className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Approved</span>
                                        </SelectItem>
                                        <SelectItem value="REJECTED">
                                            <span className="flex items-center gap-2"><XCircle className="h-3.5 w-3.5 text-red-500" /> Rejected</span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Rejection Reason Input */}
                            {newStatus === 'REJECTED' && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">
                                        Rejection Reason <span className="text-red-500">*</span>
                                    </Label>
                                    <Textarea
                                        placeholder="Why is this submission being rejected?"
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        rows={3}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="flex gap-2 sm:gap-2">
                        <Button variant="outline" onClick={() => setReviewDialogOpen(false)} className="flex-1">
                            Close
                        </Button>
                        {selectedSubmission && newStatus && newStatus !== selectedSubmission.status && (
                            <Button
                                className={`flex-1 ${newStatus === 'VERIFIED' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                                disabled={isVerifying || (newStatus === 'REJECTED' && !rejectionReason.trim())}
                                onClick={() => handleStatusChange()}
                            >
                                {isVerifying ? (
                                    <><Clock className="h-4 w-4 mr-1 animate-spin" /> Saving...</>
                                ) : newStatus === 'VERIFIED' ? (
                                    <><CheckCircle className="h-4 w-4 mr-1" /> Confirm Approve</>
                                ) : (
                                    <><XCircle className="h-4 w-4 mr-1" /> Confirm Reject</>
                                )}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default function ManagerStaffDetailPage({ params }: { params: { staffId: string } }) {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        }>
            <StaffDetailContent staffId={params.staffId} />
        </Suspense>
    )
}