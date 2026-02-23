"use client"

import { useEffect, useState, useMemo, Suspense } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { Employee, WorkSubmission, SemReport } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
} from "lucide-react"
import { toast } from "sonner"
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns"
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler } from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import { Separator } from "@/components/ui/separator"
import { SemReportCard } from "@/components/sem-reports/sem-report-card"
import { SemReportDetail } from "@/components/sem-reports/sem-report-detail"
import { ReviewActions } from "@/components/sem-reports/review-actions"

// Register ChartJS components
ChartJS.register(ArcElement, ChartTooltip, ChartLegend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler)

type DateRange = { from: Date; to: Date }

function StaffDetailContent({ staffId }: { staffId: string }) {
    const router = useRouter()
    const [staff, setStaff] = useState<Employee | null>(null)
    const [staffSubmissions, setStaffSubmissions] = useState<WorkSubmission[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Semester reports state
    const [semReports, setSemReports] = useState<SemReport[]>([])
    const [semReportsLoading, setSemReportsLoading] = useState(false)
    const [expandedReportId, setExpandedReportId] = useState<number | null>(null)
    const [semReviewLoading, setSemReviewLoading] = useState(false)

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

    // Chart.js Data - Status Distribution (Pie)
    const statusPieData = useMemo(() => ({
        labels: ['Verified', 'Pending', 'Rejected'],
        datasets: [
            {
                label: 'Submissions',
                data: [analyticsStats.verified, analyticsStats.pending, analyticsStats.rejected],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(251, 191, 36, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                ],
                borderColor: [
                    'rgba(34, 197, 94, 1)',
                    'rgba(251, 191, 36, 1)',
                    'rgba(239, 68, 68, 1)',
                ],
                borderWidth: 2,
            },
        ],
    }), [analyticsStats])

    // Daily Submissions (Line Chart)
    const dailySubmissionsChartData = useMemo(() => ({
        labels: dailyChartData.map(d => d.date),
        datasets: [
            {
                label: 'Submissions',
                data: dailyChartData.map(d => d.submissions),
                borderColor: 'rgba(59, 130, 246, 1)',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
            },
        ],
    }), [dailyChartData])

    // Hours Trend (Line Chart)
    const hoursTrendChartData = useMemo(() => ({
        labels: dailyChartData.map(d => d.date),
        datasets: [
            {
                label: 'Hours Worked',
                data: dailyChartData.map(d => d.hours),
                borderColor: 'rgba(139, 92, 246, 1)',
                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
            },
        ],
    }), [dailyChartData])

    // Chart Options
    const pieChartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: { padding: 15, font: { size: 12 }, boxWidth: 12, boxHeight: 12 },
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
            legend: { position: 'bottom' as const, labels: { padding: 15, font: { size: 12 } } },
            tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', padding: 12, titleFont: { size: 14 }, bodyFont: { size: 13 } },
        },
        scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } },
        },
        interaction: { intersect: false, mode: 'index' as const },
    }

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
                <h1 className="text-3xl font-bold tracking-tight">{staff.name}</h1>
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

            {/* Submissions Tabs */}
            <Card>
                <CardHeader>
                    <CardTitle>Submissions</CardTitle>
                    <CardDescription>
                        {staffSubmissions.length} total submission{staffSubmissions.length !== 1 ? 's' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="pending">
                        <TabsList className="mb-4">
                            <TabsTrigger value="pending" className="gap-2">
                                Pending
                                {groupedSubmissions.pending.length > 0 && (
                                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs">
                                        {groupedSubmissions.pending.length}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="approved" className="gap-2">
                                Approved
                                {groupedSubmissions.approved.length > 0 && (
                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">
                                        {groupedSubmissions.approved.length}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="rejected" className="gap-2">
                                Rejected
                                {groupedSubmissions.rejected.length > 0 && (
                                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">
                                        {groupedSubmissions.rejected.length}
                                    </span>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="pending">
                            <SubmissionTable data={groupedSubmissions.pending} />
                        </TabsContent>

                        <TabsContent value="approved">
                            <SubmissionTable data={groupedSubmissions.approved} showActions={false} />
                        </TabsContent>

                        <TabsContent value="rejected">
                            <SubmissionTable data={groupedSubmissions.rejected} showActions={false} />
                        </TabsContent>
                    </Tabs>
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
                                                            <ReviewActions
                                                                onApprove={() => handleSemApprove(report.id)}
                                                                onReject={(reason) => handleSemReject(report.id, reason)}
                                                                isLoading={semReviewLoading}
                                                            />
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
                            <p className="text-2xl font-bold mt-2">{analyticsStats.total}</p>
                        </div>
                        <div className="rounded-none border bg-card p-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 ">
                                    <TrendingUp className="h-4 w-4 text-green-600" />
                                </div>
                                <span className="text-sm text-muted-foreground">Approval Rate</span>
                            </div>
                            <p className="text-2xl font-bold mt-2">{analyticsStats.approvalRate}%</p>
                        </div>
                        <div className="rounded-none border bg-card p-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 ">
                                    <Clock className="h-4 w-4 text-amber-600" />
                                </div>
                                <span className="text-sm text-muted-foreground">Pending Review</span>
                            </div>
                            <p className="text-2xl font-bold mt-2">{analyticsStats.pending}</p>
                        </div>
                        <div className="rounded-none border bg-card p-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 ">
                                    <Clock className="h-4 w-4 text-purple-600" />
                                </div>
                                <span className="text-sm text-muted-foreground">Verified Hours</span>
                            </div>
                            <p className="text-2xl font-bold mt-2">{analyticsStats.verifiedHours.toFixed(1)}h</p>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* Status Distribution Pie Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Activity className="h-5 w-5 text-blue-600" />
                                    Status Distribution
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex justify-center">
                                <div className="w-full max-w-[250px]">
                                    {analyticsStats.total > 0 ? (
                                        <Doughnut data={statusPieData} options={pieChartOptions} />
                                    ) : (
                                        <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                                            No submissions in selected period
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Daily Submissions Line Chart */}
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                                    Daily Submissions
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Line data={dailySubmissionsChartData} options={lineChartOptions} />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Hours Trend */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Clock className="h-5 w-5 text-purple-600" />
                                Hours Trend
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Line data={hoursTrendChartData} options={lineChartOptions} />
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>

            {/* Review Dialog */}
            <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Review Submission</DialogTitle>
                        <DialogDescription>
                            {selectedSubmission?.assignment?.responsibility?.title}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSubmission && (
                        <div className="space-y-4">
                            {/* Submission Info */}
                            <div className="text-sm text-muted-foreground border-b pb-3">
                                Submitted: {format(new Date(selectedSubmission.submittedAt), "PPP 'at' h:mm a")}
                            </div>

                            {/* Hours Worked */}
                            {(selectedSubmission as any).hoursWorked && (
                                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">Hours Worked:</span>
                                    <span>{(selectedSubmission as any).hoursWorked} hours</span>
                                </div>
                            )}

                            {/* Staff Comment */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <MessageSquare className="h-4 w-4" />
                                    Staff Comments:
                                </div>
                                <div className="p-4 bg-muted rounded-lg">
                                    <p className="whitespace-pre-wrap">
                                        {(selectedSubmission as any).staffComment || 'No comments provided'}
                                    </p>
                                </div>
                            </div>

                            {/* Work Proof */}
                            {((selectedSubmission as any).workProofUrl || (selectedSubmission as any).workProofText) && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        <FileText className="h-4 w-4" />
                                        Work Proof:
                                    </div>
                                    <div className="p-4 bg-muted rounded-lg">
                                        {(selectedSubmission as any).workProofText && (
                                            <p className="whitespace-pre-wrap">{(selectedSubmission as any).workProofText}</p>
                                        )}
                                        {(selectedSubmission as any).workProofUrl && (
                                            <a
                                                href={(selectedSubmission as any).workProofUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-primary hover:underline"
                                            >
                                                <Link2 className="h-4 w-4" />
                                                View attachment
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Rejection Reason (for rejected) */}
                            {selectedSubmission.status === 'REJECTED' && selectedSubmission.rejectionReason && (
                                <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                                    <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                                        Previous Rejection Reason:
                                    </p>
                                    <p className="text-red-600 dark:text-red-300">
                                        {selectedSubmission.rejectionReason}
                                    </p>
                                </div>
                            )}

                            {/* Status Change Dropdown */}
                            <div className="space-y-3 pt-4 border-t">
                                <Label className="text-sm font-medium">Change Status</Label>
                                <Select value={newStatus} onValueChange={setNewStatus}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select new status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="VERIFIED">
                                            <span className="flex items-center gap-2">
                                                <CheckCircle className="h-4 w-4 text-green-600" />
                                                Approve
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="REJECTED">
                                            <span className="flex items-center gap-2">
                                                <XCircle className="h-4 w-4 text-red-600" />
                                                Reject
                                            </span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Rejection Reason Input - Show when changing to REJECTED */}
                            {newStatus === 'REJECTED' && (
                                <div className="space-y-3">
                                    <Label className="text-sm font-medium">
                                        Rejection Reason <span className="text-red-500">*</span>
                                    </Label>
                                    <Textarea
                                        placeholder="Provide feedback on why this submission is being rejected..."
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        rows={3}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleStatusChange}
                            disabled={isVerifying || !newStatus || (newStatus === 'REJECTED' && !rejectionReason.trim())}
                            className={newStatus === 'VERIFIED' ? 'bg-green-600 hover:bg-green-700' : newStatus === 'REJECTED' ? 'bg-red-600 hover:bg-red-700' : ''}
                        >
                            {isVerifying ? (
                                <><Clock className="h-4 w-4 mr-2 animate-spin" /> Updating...</>
                            ) : (
                                <>Save Changes</>
                            )}
                        </Button>
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