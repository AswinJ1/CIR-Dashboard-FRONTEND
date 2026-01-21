"use client"

import { useEffect, useState, useMemo } from "react"
import { api } from "@/lib/api"
import { WorkSubmission, Employee } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { SubmissionStatusBadge } from "@/components/ui/status-badge"
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
    Search
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export default function ManagerSubmissionsPage() {
    const [submissions, setSubmissions] = useState<WorkSubmission[]>([])
    const [staff, setStaff] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [searchQuery, setSearchQuery] = useState("")

    // Review dialog state
    const [selectedSubmission, setSelectedSubmission] = useState<WorkSubmission | null>(null)
    const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
    const [rejectionReason, setRejectionReason] = useState("")
    const [isVerifying, setIsVerifying] = useState(false)

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
        // Check submission status first, then assignment status
        const status = s.status || (s.assignment?.status as string) || 'PENDING'
        return status.toUpperCase()
    }

    // Group submissions by status
    const groupedSubmissions = useMemo(() => {
        const pending = submissions.filter(s => {
            const status = getSubmissionStatus(s)
            return status === 'SUBMITTED' || status === 'PENDING'
        })
        const approved = submissions.filter(s => getSubmissionStatus(s) === 'VERIFIED')
        const rejected = submissions.filter(s => getSubmissionStatus(s) === 'REJECTED')
        return { pending, approved, rejected }
    }, [submissions])

    // Filter submissions by search
    const filterSubmissions = (subs: WorkSubmission[]) => {
        if (!searchQuery) return subs
        const query = searchQuery.toLowerCase()
        return subs.filter(s =>
            s.staff?.name?.toLowerCase().includes(query) ||
            s.assignment?.responsibility?.title?.toLowerCase().includes(query)
        )
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
            fetchData()
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

    const SubmissionTable = ({ data, showActions = true }: { data: WorkSubmission[], showActions?: boolean }) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Responsibility</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No submissions found
                        </TableCell>
                    </TableRow>
                ) : (
                    data.map((submission) => (
                        <TableRow key={submission.id}>
                            <TableCell className="font-medium">
                                {submission.assignment?.responsibility?.title || 'N/A'}
                            </TableCell>
                            <TableCell>{submission.staff?.name || 'Unknown'}</TableCell>
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
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openReviewDialog(submission)}
                                    >
                                        <Eye className="h-4 w-4 mr-1" /> Review
                                    </Button>
                                    {showActions && (getSubmissionStatus(submission) === 'SUBMITTED' || getSubmissionStatus(submission) === 'PENDING') && (
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

                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search by staff name or responsibility..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Status Summary */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-l-4 border-l-amber-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{groupedSubmissions.pending.length}</div>
                        <p className="text-xs text-muted-foreground">Awaiting review</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Approved</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{groupedSubmissions.approved.length}</div>
                        <p className="text-xs text-muted-foreground">Verified submissions</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{groupedSubmissions.rejected.length}</div>
                        <p className="text-xs text-muted-foreground">Need revision</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabbed Submissions */}
            <Card>
                <CardHeader>
                    <CardTitle>Submissions for {format(selectedDate, "MMMM d, yyyy")}</CardTitle>
                    <CardDescription>
                        {submissions.length} total submission{submissions.length !== 1 ? 's' : ''}
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
                            <SubmissionTable data={filterSubmissions(groupedSubmissions.pending)} />
                        </TabsContent>

                        <TabsContent value="approved">
                            <SubmissionTable data={filterSubmissions(groupedSubmissions.approved)} showActions={false} />
                        </TabsContent>

                        <TabsContent value="rejected">
                            <SubmissionTable data={filterSubmissions(groupedSubmissions.rejected)} showActions={false} />
                        </TabsContent>
                    </Tabs>
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
                            {/* Staff Info */}
                            <div className="flex items-center justify-between text-sm border-b pb-3">
                                <span className="font-medium">{selectedSubmission.staff?.name || 'Unknown Staff'}</span>
                                <span className="text-muted-foreground">
                                    Submitted: {format(new Date(selectedSubmission.submittedAt), "PPP 'at' h:mm a")}
                                </span>
                            </div>

                            {/* Hours Worked */}
                            {selectedSubmission.hoursWorked && (
                                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">Hours Worked:</span>
                                    <span>{selectedSubmission.hoursWorked} hours</span>
                                </div>
                            )}

                            {/* Work Description / Staff Comment */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <MessageSquare className="h-4 w-4" />
                                    Staff Comments:
                                </div>
                                <div className="p-4 bg-muted rounded-lg">
                                    <p className="whitespace-pre-wrap">
                                        {selectedSubmission.staffComment || 'No comments provided'}
                                    </p>
                                </div>
                            </div>

                            {/* Work Proof */}
                            {(selectedSubmission.workProofUrl || selectedSubmission.workProofText) && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        <FileText className="h-4 w-4" />
                                        Work Proof:
                                    </div>
                                    <div className="p-4 bg-muted rounded-lg">
                                        {selectedSubmission.workProofText && (
                                            <p className="whitespace-pre-wrap">{selectedSubmission.workProofText}</p>
                                        )}
                                        {selectedSubmission.workProofUrl && (
                                            <a
                                                href={selectedSubmission.workProofUrl}
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

                            {/* Rejection Reason (for rejected submissions) */}
                            {getSubmissionStatus(selectedSubmission) === 'REJECTED' && selectedSubmission.rejectionReason && (
                                <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                                    <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                                        Rejection Reason:
                                    </p>
                                    <p className="text-red-600 dark:text-red-300">
                                        {selectedSubmission.rejectionReason}
                                    </p>
                                </div>
                            )}

                            {/* Rejection Reason Input (for pending submissions) */}
                            {(getSubmissionStatus(selectedSubmission) === 'SUBMITTED' || getSubmissionStatus(selectedSubmission) === 'PENDING') && (
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
                        {selectedSubmission && (getSubmissionStatus(selectedSubmission) === 'SUBMITTED' || getSubmissionStatus(selectedSubmission) === 'PENDING') && (
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
