"use client"

import { useEffect, useState, useMemo } from "react"
import { api } from "@/lib/api"
import { Employee, WorkSubmission } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RoleBadge, SubmissionStatusBadge } from "@/components/ui/status-badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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
    Search,
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
    BarChart3,
    Activity,
} from "lucide-react"
import { toast } from "sonner"
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns"
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler } from 'chart.js'
import { Pie, Bar, Line, Doughnut } from 'react-chartjs-2'

// Register ChartJS components
ChartJS.register(ArcElement, ChartTooltip, ChartLegend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler)

type DateRange = { from: Date; to: Date }

export default function ManagerStaffPage() {
    const [staff, setStaff] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")

    // Staff detail view
    const [selectedStaff, setSelectedStaff] = useState<Employee | null>(null)
    const [staffSubmissions, setStaffSubmissions] = useState<WorkSubmission[]>([])
    const [loadingSubmissions, setLoadingSubmissions] = useState(false)

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

    useEffect(() => {
        fetchStaff()
    }, [])

    async function fetchStaff() {
        try {
            const employees = await api.employees.getAll()
            // Backend already scopes to sub-department, filter for STAFF role
            setStaff(employees.filter(e => e.role === 'STAFF'))
        } catch (error) {
            console.error("Failed to fetch staff:", error)
        } finally {
            setIsLoading(false)
        }
    }

    async function fetchStaffSubmissions(staffId: string) {
        setLoadingSubmissions(true)
        try {
            const allSubmissions = await api.workSubmissions.getAll()
            // Filter submissions for this staff member
            const staffSubs = allSubmissions.filter(s => s.staffId === staffId)
            setStaffSubmissions(staffSubs)
        } catch (error) {
            console.error("Failed to fetch submissions:", error)
            toast.error("Failed to load submissions")
        } finally {
            setLoadingSubmissions(false)
        }
    }

    function handleStaffClick(member: Employee) {
        setSelectedStaff(member)
        fetchStaffSubmissions(member.id)
    }

    function handleBackToList() {
        setSelectedStaff(null)
        setStaffSubmissions([])
    }

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
            const pending = daySubmissions.filter(s => s.status === 'SUBMITTED' || s.status === 'PENDING').length
            const rejected = daySubmissions.filter(s => s.status === 'REJECTED').length
            const hours = daySubmissions.reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)
            
            return {
                date: format(day, 'MMM d'),
                submissions: daySubmissions.length,
                verified,
                pending,
                rejected,
                hours: Math.round(hours * 10) / 10,
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
                    label: function(context: any) {
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

    async function handleVerify(status: 'VERIFIED' | 'REJECTED') {
        if (!selectedSubmission) return

        if (status === 'REJECTED' && !rejectionReason.trim()) {
            toast.error("Rejection reason is required")
            return
        }

        setIsVerifying(true)
        try {
            await api.workSubmissions.verify(selectedSubmission.id, {
                approved: status === 'VERIFIED',
                managerComment: status === 'REJECTED' ? rejectionReason.trim() : undefined,
            })
            toast.success(`Submission ${status === 'VERIFIED' ? 'approved' : 'rejected'} successfully`)
            setReviewDialogOpen(false)
            setSelectedSubmission(null)
            setRejectionReason("")
            if (selectedStaff) {
                fetchStaffSubmissions(selectedStaff.id)
            }
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
        setReviewDialogOpen(true)
    }

    const filteredStaff = staff.filter(s =>
        s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )

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
                                                onClick={() => {
                                                    setSelectedSubmission(submission)
                                                    handleVerify('VERIFIED')
                                                }}
                                            >
                                                <CheckCircle className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => openReviewDialog(submission)}
                                            >
                                                <XCircle className="h-4 w-4" />
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

    // Staff Detail View
    if (selectedStaff) {
        return (
            <div className="p-6 space-y-6">
                {/* Back Button and Header */}
                <div>
                    <Button variant="ghost" size="sm" onClick={handleBackToList} className="mb-4">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Staff List
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">{selectedStaff.name}</h1>
                    <p className="text-muted-foreground">Staff member details and submissions</p>
                </div>

                {/* Staff Info Card */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-6">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-8 w-8 text-primary" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <span>{selectedStaff.email}</span>
                                </div>
                                {selectedStaff.subDepartment && (
                                    <div className="flex items-center gap-2">
                                        <Building className="h-4 w-4 text-muted-foreground" />
                                        <span>{selectedStaff.subDepartment.name}</span>
                                    </div>
                                )}
                                <RoleBadge role={selectedStaff.role} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Analytics Section */}
                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between gap-4">
                            <div>
                                <CardTitle>Performance Analytics</CardTitle>
                                <CardDescription>Detailed metrics for {selectedStaff.name}</CardDescription>
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
                                        onSelect={setDateRange}
                                        numberOfMonths={2}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Stats Cards */}
                        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-lg border bg-card p-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <FileText className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <span className="text-sm text-muted-foreground">Total Submissions</span>
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

                {/* Submissions Tabs */}
                <Card>
                    <CardHeader>
                        <CardTitle>Submissions</CardTitle>
                        <CardDescription>
                            {staffSubmissions.length} total submission{staffSubmissions.length !== 1 ? 's' : ''}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingSubmissions ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            </div>
                        ) : (
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
                        )}
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
                                            Rejection Reason:
                                        </p>
                                        <p className="text-red-600 dark:text-red-300">
                                            {selectedSubmission.rejectionReason}
                                        </p>
                                    </div>
                                )}

                                {/* Rejection Reason Input */}
                                {(selectedSubmission.status === 'SUBMITTED' || selectedSubmission.status === 'PENDING') && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">
                                            Rejection Reason <span className="text-red-500">*</span>
                                            <span className="text-muted-foreground font-normal"> (required if rejecting)</span>
                                        </label>
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
                            {selectedSubmission && (selectedSubmission.status === 'SUBMITTED' || selectedSubmission.status === 'PENDING') && (
                                <>
                                    <Button
                                        variant="destructive"
                                        onClick={() => handleVerify('REJECTED')}
                                        disabled={isVerifying || !rejectionReason.trim()}
                                    >
                                        <XCircle className="h-4 w-4 mr-2" /> Reject
                                    </Button>
                                    <Button
                                        onClick={() => handleVerify('VERIFIED')}
                                        disabled={isVerifying}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        <CheckCircle className="h-4 w-4 mr-2" /> Approve
                                    </Button>
                                </>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        )
    }

    // Staff List View
    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">My Staff</h1>
                <p className="text-muted-foreground">
                    View staff members and their work submissions
                </p>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Staff List */}
            <Card>
                <CardHeader>
                    <CardTitle>Staff Members</CardTitle>
                    <CardDescription>
                        {filteredStaff.length} staff member{filteredStaff.length !== 1 ? 's' : ''} - Click to view submissions
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredStaff.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            No staff members found
                        </p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {filteredStaff.map((member) => (
                                <Card
                                    key={member.id}
                                    className="p-4 cursor-pointer hover:shadow-md transition-shadow hover:border-primary"
                                    onClick={() => handleStaffClick(member)}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                            <User className="h-6 w-6 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{member.name}</p>
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                                <Mail className="h-3 w-3" />
                                                <span className="truncate">{member.email}</span>
                                            </div>
                                            {member.subDepartment && (
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                                    <Building className="h-3 w-3" />
                                                    <span className="truncate">{member.subDepartment.name}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
