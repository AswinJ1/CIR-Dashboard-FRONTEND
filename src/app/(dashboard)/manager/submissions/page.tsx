"use client"

import { useEffect, useState, useMemo } from "react"
import { api } from "@/lib/api"
import { WorkSubmission, Employee } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { SubmissionStatusBadge } from "@/components/ui/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
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
    CheckCircle,
    XCircle,
    Eye,
    CalendarIcon,
    Clock,
    FileText,
    Link2,
    MessageSquare,
    RefreshCw,
    Search,
    User,
    ClipboardList
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface StaffSubmissionSummary {
    staff: Employee
    pending: WorkSubmission[]
    approved: WorkSubmission[]
    rejected: WorkSubmission[]
    total: number
}

export default function ManagerSubmissionsPage() {
    const [submissions, setSubmissions] = useState<WorkSubmission[]>([])
    const [staff, setStaff] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [searchQuery, setSearchQuery] = useState("")
    const router = useRouter()

    // Staff submissions modal state
    const [selectedStaff, setSelectedStaff] = useState<StaffSubmissionSummary | null>(null)
    const [staffModalOpen, setStaffModalOpen] = useState(false)

    // Review dialog state
    const [selectedSubmission, setSelectedSubmission] = useState<WorkSubmission | null>(null)
    const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
    const [rejectionReason, setRejectionReason] = useState("")
    const [isVerifying, setIsVerifying] = useState(false)
    const [verifyingSubmissionId, setVerifyingSubmissionId] = useState<string | null>(null)

    useEffect(() => {
        fetchData()
    }, [selectedDate])

    async function fetchData() {
        setIsLoading(true)
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd')
            const [submissionsData, staffData] = await Promise.all([
                api.workSubmissions.getByDate(dateStr).catch(() => api.workSubmissions.getAll()),
                api.employees.getAll(),
            ])

            // Filter staff to only include STAFF role
            const staffMembers = staffData.filter(e => e.role === 'STAFF')

            // Filter submissions for the selected date
            const dateFilteredSubmissions = submissionsData.filter(s => {
                const submissionDate = new Date((s as any).workDate || s.submittedAt)
                return format(submissionDate, 'yyyy-MM-dd') === dateStr
            })

            setSubmissions(dateFilteredSubmissions)
            setStaff(staffMembers)
        } catch (error) {
            console.error("Failed to fetch data:", error)
            toast.error("Failed to load submissions")
        } finally {
            setIsLoading(false)
        }
    }

    // Helper to get the effective status of a submission
    const getSubmissionStatus = (s: WorkSubmission): string => {
        const status = s.status || (s.assignment?.status as string) || 'PENDING'
        return status.toUpperCase()
    }

    // Group submissions by staff
    const staffSubmissionSummaries = useMemo((): StaffSubmissionSummary[] => {
        const summaryMap = new Map<string, StaffSubmissionSummary>()

        // Initialize with all staff (even those with no submissions)
        staff.forEach(s => {
            summaryMap.set(s.id, {
                staff: s,
                pending: [],
                approved: [],
                rejected: [],
                total: 0
            })
        })

        // Populate submissions
        submissions.forEach(sub => {
            const staffId = sub.staffId || sub.staff?.id
            if (!staffId) return

            let summary = summaryMap.get(staffId)
            if (!summary && sub.staff) {
                summary = {
                    staff: sub.staff,
                    pending: [],
                    approved: [],
                    rejected: [],
                    total: 0
                }
                summaryMap.set(staffId, summary)
            }

            if (summary) {
                const status = getSubmissionStatus(sub)
                if (status === 'SUBMITTED' || status === 'PENDING') {
                    summary.pending.push(sub)
                } else if (status === 'VERIFIED') {
                    summary.approved.push(sub)
                } else if (status === 'REJECTED') {
                    summary.rejected.push(sub)
                }
                summary.total++
            }
        })

        return Array.from(summaryMap.values())
    }, [submissions, staff])

    // Filter staff by search
    const filteredStaffSummaries = useMemo(() => {
        if (!searchQuery) return staffSubmissionSummaries
        const query = searchQuery.toLowerCase()
        return staffSubmissionSummaries.filter(s =>
            s.staff.name?.toLowerCase().includes(query) ||
            s.staff.email?.toLowerCase().includes(query)
        )
    }, [staffSubmissionSummaries, searchQuery])

    // Total counts for summary cards
    const totalCounts = useMemo(() => {
        return staffSubmissionSummaries.reduce((acc, s) => ({
            pending: acc.pending + s.pending.length,
            approved: acc.approved + s.approved.length,
            rejected: acc.rejected + s.rejected.length
        }), { pending: 0, approved: 0, rejected: 0 })
    }, [staffSubmissionSummaries])

    async function handleVerify(status: 'VERIFIED' | 'REJECTED', submissionOverride?: WorkSubmission) {
        const submission = submissionOverride || selectedSubmission
        if (!submission) return

        if (status === 'REJECTED' && !rejectionReason.trim()) {
            toast.error("Rejection reason is required")
            return
        }

        setIsVerifying(true)
        setVerifyingSubmissionId(submission.id)
        try {
            await api.workSubmissions.verify(submission.id, {
                approved: status === 'VERIFIED',
                managerComment: status === 'REJECTED' ? rejectionReason.trim() : undefined,
            })
            toast.success(`Submission ${status === 'VERIFIED' ? 'approved' : 'rejected'} successfully`)
            setReviewDialogOpen(false)
            setSelectedSubmission(null)
            setRejectionReason("")
            fetchData()

            // Update the selected staff modal data
            if (selectedStaff) {
                const updatedSummary = staffSubmissionSummaries.find(s => s.staff.id === selectedStaff.staff.id)
                if (updatedSummary) {
                    setSelectedStaff(updatedSummary)
                }
            }
        } catch (error: any) {
            console.error("Failed to verify submission:", error)
            toast.error(error.message || "Failed to verify submission")
        } finally {
            setIsVerifying(false)
            setVerifyingSubmissionId(null)
        }
    }

    function openReviewDialog(submission: WorkSubmission) {
        setSelectedSubmission(submission)
        setRejectionReason("")
        setReviewDialogOpen(true)
    }

    function openStaffModal(summary: StaffSubmissionSummary) {
        setSelectedStaff(summary)
        setStaffModalOpen(true)
    }

    function getInitials(name: string): string {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
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
                                {format(new Date(submission.submittedAt), "h:mm a")}
                            </TableCell>
                            <TableCell>
                                <SubmissionStatusBadge status={getSubmissionStatus(submission) as any} />
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => router.push(`/manager/submissions/${submission.id}`)}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
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

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Submissions Review</h1>
                    <p className="text-muted-foreground">
                        Review and verify work submissions from your team
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Date Picker and Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <p>Filter by date:</p>
                        {/* Date Picker */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-[240px] justify-start text-left font-normal",
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {format(selectedDate, "PPP")}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={(date) => date && setSelectedDate(date)}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </CardContent>
            </Card>

            {/* Status Summary */}
            {/* <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-l-4 border-l-amber-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">VERIFICATION PENDING</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalCounts.pending}</div>
                        <p className="text-xs text-muted-foreground">Awaiting review</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">VERIFIED TODAY</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalCounts.approved}</div>
                        <p className="text-xs text-muted-foreground">Verified submissions</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">REJECTED RESPONSIBILITIES</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalCounts.rejected}</div>
                        <p className="text-xs text-muted-foreground">Need revision</p>
                    </CardContent>
                </Card>
            </div> */}

            {/* Staff List */}
            <Card>
                <CardHeader>
                    <CardTitle>Staff Submissions - {format(selectedDate, "MMMM d, yyyy")}</CardTitle>
                    <CardDescription>
                        Click on a staff member to review their submissions
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredStaffSummaries.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No staff members found</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredStaffSummaries.map((summary) => (
                                <Card
                                    key={summary.staff.id}
                                    className={cn(
                                        "cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
                                        summary.pending.length > 0 && "border-l-4 border-l-amber-500"
                                    )}
                                    onClick={() => openStaffModal(summary)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <Avatar className="h-10 w-10">
                                                <AvatarFallback className="bg-primary/10 text-primary">
                                                    {getInitials(summary.staff.name || 'U')}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{summary.staff.name}</p>
                                                <p className="text-sm text-muted-foreground truncate">
                                                    {summary.staff.email}
                                                </p>
                                                <div className="flex gap-2 mt-2">
                                                    {summary.pending.length > 0 && (
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                                            {summary.pending.length} pending
                                                        </Badge>
                                                    )}
                                                    {summary.approved.length > 0 && (
                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                            {summary.approved.length} approved
                                                        </Badge>
                                                    )}
                                                    {summary.rejected.length > 0 && (
                                                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                                            {summary.rejected.length} rejected
                                                        </Badge>
                                                    )}
                                                    {summary.total === 0 && (
                                                        <Badge variant="outline" className="text-muted-foreground">
                                                            No submissions
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="shrink-0">
                                                <ClipboardList className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Staff Submissions Modal */}
            <Dialog open={staffModalOpen} onOpenChange={setStaffModalOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            {selectedStaff && (
                                <>
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                            {getInitials(selectedStaff.staff.name || 'U')}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span>{selectedStaff.staff.name}&apos;s Submissions</span>
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {format(selectedDate, "MMMM d, yyyy")} • {selectedStaff?.total || 0} total submissions
                        </DialogDescription>
                    </DialogHeader>

                    {selectedStaff && (
                        <ScrollArea className="max-h-[60vh]">
                            <Tabs defaultValue="pending" className="w-full">
                                <TabsList className="mb-4">
                                    <TabsTrigger value="pending" className="gap-2">
                                        Pending
                                        {selectedStaff.pending.length > 0 && (
                                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs">
                                                {selectedStaff.pending.length}
                                            </span>
                                        )}
                                    </TabsTrigger>
                                    <TabsTrigger value="approved" className="gap-2">
                                        Approved
                                        {selectedStaff.approved.length > 0 && (
                                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">
                                                {selectedStaff.approved.length}
                                            </span>
                                        )}
                                    </TabsTrigger>
                                    <TabsTrigger value="rejected" className="gap-2">
                                        Rejected
                                        {selectedStaff.rejected.length > 0 && (
                                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">
                                                {selectedStaff.rejected.length}
                                            </span>
                                        )}
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="pending">
                                    <SubmissionTable data={selectedStaff.pending} />
                                </TabsContent>

                                <TabsContent value="approved">
                                    <SubmissionTable data={selectedStaff.approved} showActions={false} />
                                </TabsContent>

                                <TabsContent value="rejected">
                                    <SubmissionTable data={selectedStaff.rejected} showActions={false} />
                                </TabsContent>
                            </Tabs>
                        </ScrollArea>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setStaffModalOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Review Dialog */}
           
        </div>
    )
}