"use client"

import { useEffect, useState, useMemo } from "react"
import { api } from "@/lib/api"
import { WorkSubmission, Department, SubDepartment, Employee } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SubmissionStatusBadge } from "@/components/ui/status-badge"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
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
import { 
    Search, 
    Eye, 
    CheckCircle, 
    XCircle, 
    Building2, 
    Layers,
    Clock,
    FileText,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

export default function AdminWorkSubmissionsPage() {
    const [submissions, setSubmissions] = useState<WorkSubmission[]>([])
    const [departments, setDepartments] = useState<Department[]>([])
    const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [departmentFilter, setDepartmentFilter] = useState<string>("all")

    // View/Verify dialog state
    const [viewDialogOpen, setViewDialogOpen] = useState(false)
    const [selectedSubmission, setSelectedSubmission] = useState<WorkSubmission | null>(null)
    const [verifyComment, setVerifyComment] = useState("")
    const [isVerifying, setIsVerifying] = useState(false)

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        try {
            const [submissionsData, deptsData, subDeptsData, employeesData] = await Promise.all([
                api.workSubmissions.getAll(),
                api.departments.getAll(),
                api.subDepartments.getAll(),
                api.employees.getAll(),
            ])
            setSubmissions(submissionsData)
            setDepartments(deptsData)
            setSubDepartments(subDeptsData)
            setEmployees(employeesData)
        } catch (error) {
            console.error("Failed to fetch data:", error)
            toast.error("Failed to load submissions")
        } finally {
            setIsLoading(false)
        }
    }

    // Get employee's department info
    const getEmployeeDepartmentInfo = (staffId?: string) => {
        if (!staffId) return { department: null, subDepartment: null }
        const employee = employees.find(e => String(e.id) === String(staffId))
        if (!employee) return { department: null, subDepartment: null }
        
        const subDept = subDepartments.find(sd => String(sd.id) === String(employee.subDepartmentId))
        
        // Get department from employee's departmentId OR from subDepartment's departmentId
        let dept = null
        if (employee.departmentId) {
            dept = departments.find(d => String(d.id) === String(employee.departmentId))
        }
        // Fallback: get department from subDepartment if employee doesn't have direct departmentId
        if (!dept && subDept) {
            dept = departments.find(d => String(d.id) === String(subDept.departmentId))
        }
        
        return { department: dept, subDepartment: subDept }
    }

    // Filtered submissions
    const filteredSubmissions = useMemo(() => {
        return submissions.filter(s => {
            // Search filter
            const searchLower = searchQuery.toLowerCase()
            const matchesSearch = 
                s.staff?.name?.toLowerCase().includes(searchLower) ||
                s.assignment?.responsibility?.title?.toLowerCase().includes(searchLower)
            
            if (searchQuery && !matchesSearch) return false

            // Status filter
            if (statusFilter !== "all" && s.status !== statusFilter) return false

            // Department filter
            if (departmentFilter !== "all") {
                const { department } = getEmployeeDepartmentInfo(s.staffId)
                if (!department || String(department.id) !== departmentFilter) return false
            }

            return true
        })
    }, [submissions, searchQuery, statusFilter, departmentFilter, employees, departments, subDepartments])

    function openViewDialog(submission: WorkSubmission) {
        setSelectedSubmission(submission)
        setVerifyComment("")
        setViewDialogOpen(true)
    }

    async function handleVerify(approved: boolean) {
        if (!selectedSubmission) return

        setIsVerifying(true)
        try {
            await api.workSubmissions.verify(selectedSubmission.id, {
                approved,
                managerComment: verifyComment,
            })
            toast.success(approved ? "Submission verified successfully" : "Submission rejected")
            setViewDialogOpen(false)
            setSelectedSubmission(null)
            fetchData()
        } catch (error: any) {
            console.error("Failed to verify submission:", error)
            toast.error(error.message || "Failed to verify submission")
        } finally {
            setIsVerifying(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Work Submissions</h1>
                <p className="text-muted-foreground">
                    View and verify all work submissions across the system
                </p>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search by employee or responsibility..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                            <SelectTrigger className="w-[180px]">
                                <Building2 className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                {departments.map((dept) => (
                                    <SelectItem key={dept.id} value={String(dept.id)}>
                                        {dept.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="PENDING">Pending</SelectItem>
                                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                                <SelectItem value="VERIFIED">Verified</SelectItem>
                                <SelectItem value="REJECTED">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Submissions Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Submissions</CardTitle>
                    <CardDescription>
                        {filteredSubmissions.length} submission{filteredSubmissions.length !== 1 ? 's' : ''} found
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredSubmissions.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            No submissions found
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Responsibility</TableHead>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Hours</TableHead>
                                    <TableHead>Submitted</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSubmissions.map((submission) => {
                                    const { department, subDepartment } = getEmployeeDepartmentInfo(submission.staffId)
                                    const canVerify = submission.status === 'SUBMITTED' || submission.status === 'PENDING'
                                    
                                    return (
                                        <TableRow key={submission.id}>
                                            <TableCell className="font-medium max-w-[200px]">
                                                <p className="truncate">
                                                    {submission.assignment?.responsibility?.title || 'N/A'}
                                                </p>
                                            </TableCell>
                                            <TableCell>{submission.staff?.name || 'Unknown'}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    {department && (
                                                        <Badge variant="secondary" className="w-fit text-xs gap-1">
                                                            <Building2 className="h-3 w-3" />
                                                            {department.name}
                                                        </Badge>
                                                    )}
                                                    {subDepartment && (
                                                        <Badge variant="outline" className="w-fit text-xs gap-1">
                                                            <Layers className="h-3 w-3" />
                                                            {subDepartment.name}
                                                        </Badge>
                                                    )}
                                                    {!department && !subDepartment && (
                                                        <span className="text-muted-foreground">N/A</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                                    {(submission as any).hoursWorked || '-'}h
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {format(new Date(submission.submittedAt), "MMM d, yyyy")}
                                            </TableCell>
                                            <TableCell>
                                                <SubmissionStatusBadge status={submission.status} />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        onClick={() => openViewDialog(submission)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    {canVerify && (
                                                        <>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm"
                                                                className="text-green-600 hover:text-green-700"
                                                                onClick={() => {
                                                                    setSelectedSubmission(submission)
                                                                    setVerifyComment("")
                                                                    handleVerify(true)
                                                                }}
                                                            >
                                                                <CheckCircle className="h-4 w-4" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm"
                                                                className="text-red-600 hover:text-red-700"
                                                                onClick={() => openViewDialog(submission)}
                                                            >
                                                                <XCircle className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* View/Verify Dialog */}
            <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Submission Details</DialogTitle>
                        <DialogDescription>
                            View submission details and verify/reject
                        </DialogDescription>
                    </DialogHeader>
                    
                    {selectedSubmission && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-muted-foreground text-xs">Responsibility</Label>
                                    <p className="font-medium">
                                        {selectedSubmission.assignment?.responsibility?.title || 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Employee</Label>
                                    <p className="font-medium">
                                        {selectedSubmission.staff?.name || 'Unknown'}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Department</Label>
                                    {(() => {
                                        const { department, subDepartment } = getEmployeeDepartmentInfo(selectedSubmission.staffId)
                                        return (
                                            <div className="flex flex-col gap-1">
                                                {department && <p className="font-medium">{department.name}</p>}
                                                {subDepartment && <p className="text-sm text-muted-foreground">{subDepartment.name}</p>}
                                                {!department && !subDepartment && <p className="text-muted-foreground">N/A</p>}
                                            </div>
                                        )
                                    })()}
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Status</Label>
                                    <div className="mt-1">
                                        <SubmissionStatusBadge status={selectedSubmission.status} />
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Hours Worked</Label>
                                    <p className="font-medium">
                                        {(selectedSubmission as any).hoursWorked || '-'} hours
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Submitted At</Label>
                                    <p className="font-medium">
                                        {format(new Date(selectedSubmission.submittedAt), "MMM d, yyyy HH:mm")}
                                    </p>
                                </div>
                            </div>

                            {selectedSubmission.staffComment && (
                                <div>
                                    <Label className="text-muted-foreground text-xs">Staff Comment</Label>
                                    <p className="text-sm mt-1 p-2 bg-muted rounded">
                                        {selectedSubmission.staffComment}
                                    </p>
                                </div>
                            )}

                            {/* Work Proof Section */}
                            {(selectedSubmission.workProofUrl || selectedSubmission.workProofText) && (
                                <div>
                                    <Label className="text-muted-foreground text-xs">Work Proof</Label>
                                    {selectedSubmission.workProofType && (
                                        <Badge variant="outline" className="ml-2 text-xs">
                                            {selectedSubmission.workProofType}
                                        </Badge>
                                    )}
                                    {selectedSubmission.workProofUrl && (
                                        <a 
                                            href={selectedSubmission.workProofUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline flex items-center gap-1 mt-1"
                                        >
                                            <FileText className="h-4 w-4" />
                                            View Attachment
                                        </a>
                                    )}
                                    {selectedSubmission.workProofText && (
                                        <p className="text-sm mt-1 p-2 bg-muted rounded whitespace-pre-wrap">
                                            {selectedSubmission.workProofText}
                                        </p>
                                    )}
                                </div>
                            )}

                            {(selectedSubmission.status === 'SUBMITTED' || selectedSubmission.status === 'PENDING') && (
                                <div className="space-y-2 pt-4 border-t">
                                    <Label htmlFor="verifyComment">Verification Comment</Label>
                                    <Textarea
                                        id="verifyComment"
                                        placeholder="Add a comment (required for rejection)..."
                                        value={verifyComment}
                                        onChange={(e) => setVerifyComment(e.target.value)}
                                        rows={3}
                                    />
                                </div>
                            )}

                            {(selectedSubmission as any).managerComment && (
                                <div>
                                    <Label className="text-muted-foreground text-xs">Manager Comment</Label>
                                    <p className="text-sm mt-1 p-2 bg-muted rounded">
                                        {(selectedSubmission as any).managerComment}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                            Close
                        </Button>
                        {selectedSubmission && (selectedSubmission.status === 'SUBMITTED' || selectedSubmission.status === 'PENDING') && (
                            <>
                                <Button
                                    variant="destructive"
                                    onClick={() => handleVerify(false)}
                                    disabled={isVerifying || !verifyComment.trim()}
                                >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Reject
                                </Button>
                                <Button
                                    onClick={() => handleVerify(true)}
                                    disabled={isVerifying}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Verify
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
