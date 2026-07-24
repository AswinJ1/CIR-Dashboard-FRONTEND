"use client"

import { useEffect, useState, useMemo } from "react"
import { api } from "@/lib/api"
import { WorkSubmission, Department, SubDepartment, Employee } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar as CalendarIcon, Filter, X } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ColumnFilter } from "@/components/ui/column-filter"
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

type SortField = 'responsibility' | 'employee' | 'department' | 'hours' | 'submittedAt' | 'status' | null
type SortOrder = 'asc' | 'desc' | null

export default function AdminWorkSubmissionsPage() {
    const [submissions, setSubmissions] = useState<WorkSubmission[]>([])
    const [departments, setDepartments] = useState<Department[]>([])
    const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [departmentFilter, setDepartmentFilter] = useState<string>("all")
    const [subdepartmentFilter, setSubdepartmentFilter] = useState<string>("all")

    // Table Header Column Filters State
    const [colEmployeeFilter, setColEmployeeFilter] = useState<string[]>([])
    const [colResponsibilityFilter, setColResponsibilityFilter] = useState<string[]>([])
    const [colDepartmentFilter, setColDepartmentFilter] = useState<string[]>([])
    const [colStatusFilter, setColStatusFilter] = useState<string[]>([])
    const [colSubmittedDateFilter, setColSubmittedDateFilter] = useState<Date | undefined>(undefined)

    // Table Header Sorting State
    const [sortField, setSortField] = useState<SortField>(null)
    const [sortOrder, setSortOrder] = useState<SortOrder>(null)

    // View/Verify dialog state
    const [viewDialogOpen, setViewDialogOpen] = useState(false)
    const [selectedSubmission, setSelectedSubmission] = useState<WorkSubmission | null>(null)
    const [verifyComment, setVerifyComment] = useState("")
    const [isVerifying, setIsVerifying] = useState(false)
    const [newStatus, setNewStatus] = useState<string>("")

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

    // Options for Header Column Filters
    const employeeOptions = useMemo(() => {
        return Array.from(new Set(submissions.map(s => s.staff?.name || "Unknown"))).filter(Boolean)
    }, [submissions])

    const responsibilityOptions = useMemo(() => {
        return Array.from(new Set(submissions.map(s => s.assignment?.responsibility?.title || "N/A"))).filter(Boolean)
    }, [submissions])

    const departmentOptions = useMemo(() => {
        return Array.from(new Set(submissions.map(s => {
            const { department } = getEmployeeDepartmentInfo(s.staffId)
            return department?.name || "N/A"
        }))).filter(Boolean)
    }, [submissions, employees, departments, subDepartments])

    const statusOptions = ["PENDING", "SUBMITTED", "VERIFIED", "REJECTED"]

    // Sorting Handler
    const handleSort = (field: SortField) => {
        if (sortField !== field) {
            setSortField(field)
            setSortOrder('asc')
        } else if (sortOrder === 'asc') {
            setSortOrder('desc')
        } else if (sortOrder === 'desc') {
            setSortField(null)
            setSortOrder(null)
        } else {
            setSortOrder('asc')
        }
    }

    // Filtered & Sorted Submissions
    const filteredSubmissions = useMemo(() => {
        let result = submissions.filter(s => {
            // Global Search Filter
            const searchLower = searchQuery.toLowerCase()
            const matchesSearch =
                !searchQuery ||
                s.staff?.name?.toLowerCase().includes(searchLower) ||
                s.assignment?.responsibility?.title?.toLowerCase().includes(searchLower)

            if (!matchesSearch) return false

            // Top Bar Filters
            if (statusFilter !== "all" && s.status !== statusFilter) return false

            const { department, subDepartment } = getEmployeeDepartmentInfo(s.staffId)

            if (departmentFilter !== "all") {
                if (!department || String(department.id) !== departmentFilter) return false
            }
            if (subdepartmentFilter !== "all") {
                if (!subDepartment || String(subDepartment.id) !== subdepartmentFilter) return false
            }

            // Header Column Filters
            const empName = s.staff?.name || "Unknown"
            if (colEmployeeFilter.length > 0 && !colEmployeeFilter.includes(empName)) return false

            const respTitle = s.assignment?.responsibility?.title || "N/A"
            if (colResponsibilityFilter.length > 0 && !colResponsibilityFilter.includes(respTitle)) return false

            const deptName = department?.name || "N/A"
            if (colDepartmentFilter.length > 0 && !colDepartmentFilter.includes(deptName)) return false

            if (colStatusFilter.length > 0 && !colStatusFilter.includes(s.status)) return false

            if (colSubmittedDateFilter) {
                const subDate = new Date(s.submittedAt)
                if (
                    subDate.getFullYear() !== colSubmittedDateFilter.getFullYear() ||
                    subDate.getMonth() !== colSubmittedDateFilter.getMonth() ||
                    subDate.getDate() !== colSubmittedDateFilter.getDate()
                ) {
                    return false
                }
            }

            return true
        })

        // Column Sorting
        if (sortField && sortOrder) {
            result = [...result].sort((a, b) => {
                let aVal: any = ""
                let bVal: any = ""

                switch (sortField) {
                    case "responsibility":
                        aVal = a.assignment?.responsibility?.title || ""
                        bVal = b.assignment?.responsibility?.title || ""
                        break
                    case "employee":
                        aVal = a.staff?.name || ""
                        bVal = b.staff?.name || ""
                        break
                    case "department": {
                        const deptA = getEmployeeDepartmentInfo(a.staffId).department?.name || ""
                        const deptB = getEmployeeDepartmentInfo(b.staffId).department?.name || ""
                        aVal = deptA
                        bVal = deptB
                        break
                    }
                    case "hours":
                        aVal = (a as any).hoursWorked || 0
                        bVal = (b as any).hoursWorked || 0
                        break
                    case "submittedAt":
                        aVal = new Date(a.submittedAt).getTime()
                        bVal = new Date(b.submittedAt).getTime()
                        break
                    case "status":
                        aVal = a.status || ""
                        bVal = b.status || ""
                        break
                }

                if (typeof aVal === "string") {
                    const comp = aVal.localeCompare(bVal as string)
                    return sortOrder === "asc" ? comp : -comp
                } else {
                    return sortOrder === "asc"
                        ? (aVal > bVal ? 1 : aVal < bVal ? -1 : 0)
                        : (aVal < bVal ? 1 : aVal > bVal ? -1 : 0)
                }
            })
        }

        return result
    }, [
        submissions,
        searchQuery,
        statusFilter,
        departmentFilter,
        subdepartmentFilter,
        colEmployeeFilter,
        colResponsibilityFilter,
        colDepartmentFilter,
        colStatusFilter,
        colSubmittedDateFilter,
        sortField,
        sortOrder,
        employees,
        departments,
        subDepartments
    ])

    const hasActiveColumnFilters =
        colEmployeeFilter.length > 0 ||
        colResponsibilityFilter.length > 0 ||
        colDepartmentFilter.length > 0 ||
        colStatusFilter.length > 0 ||
        colSubmittedDateFilter !== undefined

    const clearAllColumnFilters = () => {
        setColEmployeeFilter([])
        setColResponsibilityFilter([])
        setColDepartmentFilter([])
        setColStatusFilter([])
        setColSubmittedDateFilter(undefined)
    }

    function openViewDialog(submission: WorkSubmission) {
        setSelectedSubmission(submission)
        setVerifyComment("")
        setNewStatus(submission.status)
        setViewDialogOpen(true)
    }

    async function handleVerify(approved: boolean, submission?: WorkSubmission) {
        const target = submission || selectedSubmission
        if (!target) return

        setIsVerifying(true)
        try {
            await api.workSubmissions.verify(target.id, {
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
                <h1 className="text-3xl tracking-tight">Work Submissions</h1>
                <p className="text-muted-foreground">
                    View and verify all work submissions across the system
                </p>
            </div>

            {/* Top Bar Filters */}
            <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-center">
                <div className="relative max-w-sm w-full sm:w-auto">
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
                <Select value={subdepartmentFilter} onValueChange={setSubdepartmentFilter}>
                    <SelectTrigger className="w-[180px]">
                        <Building2 className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Subdepartment" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Subdepartments</SelectItem>
                        {subDepartments.map((subdept) => (
                            <SelectItem key={subdept.id} value={String(subdept.id)}>
                                {subdept.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              

                {hasActiveColumnFilters && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAllColumnFilters}
                        className="text-xs flex items-center gap-1"
                    >
                        <X className="h-3.5 w-3.5" />
                        Clear Column Filters
                    </Button>
                )}
            </div>

            {/* Submissions Table */}
            <div>
                <div className="mb-2 flex items-center justify-between">
                    <div>
                        <div className="font-semibold text-lg">All Submissions</div>
                        <p className="text-sm text-muted-foreground">
                            {filteredSubmissions.length} submission{filteredSubmissions.length !== 1 ? 's' : ''} found
                        </p>
                    </div>
                </div>
                <div>
                    {filteredSubmissions.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8 border rounded-md">
                            No submissions found
                        </p>
                    ) : (
                        <Table className="border">
                            <TableHeader className="bg-white">
                                <TableRow>
                                    <TableHead>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleSort('responsibility')}
                                                className="flex items-center font-semibold hover:text-primary transition-colors focus:outline-none"
                                            >
                                                Responsibility
                                            </button>
                                            <ColumnFilter
                                                title="Responsibility"
                                                options={responsibilityOptions}
                                                selected={colResponsibilityFilter}
                                                onChange={setColResponsibilityFilter}
                                            />
                                        </div>
                                    </TableHead>
                                    <TableHead>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleSort('employee')}
                                                className="flex items-center font-semibold hover:text-primary transition-colors focus:outline-none"
                                            >
                                                Employee
                                            </button>
                                            <ColumnFilter
                                                title="Employee"
                                                options={employeeOptions}
                                                selected={colEmployeeFilter}
                                                onChange={setColEmployeeFilter}
                                            />
                                        </div>
                                    </TableHead>
                                    <TableHead>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleSort('department')}
                                                className="flex items-center font-semibold hover:text-primary transition-colors focus:outline-none"
                                            >
                                                Department
                                            </button>
                                            <ColumnFilter
                                                title="Department"
                                                options={departmentOptions}
                                                selected={colDepartmentFilter}
                                                onChange={setColDepartmentFilter}
                                            />
                                        </div>
                                    </TableHead>
                                    <TableHead>
                                        <button
                                            onClick={() => handleSort('hours')}
                                            className="flex items-center font-semibold hover:text-primary transition-colors focus:outline-none"
                                        >
                                            Hours
                                        </button>
                                    </TableHead>
                                    <TableHead>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleSort('submittedAt')}
                                                className="flex items-center font-semibold hover:text-primary transition-colors focus:outline-none"
                                            >
                                                Submitted
                                            </button>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className={`h-6 w-6 ${colSubmittedDateFilter ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                                                        title="Filter by submitted date"
                                                    >
                                                        <CalendarIcon className="h-3.5 w-3.5" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent align="start" className="w-auto p-0">
                                                    <div className="p-3 border-b flex items-center justify-between">
                                                        <span className="text-xs font-semibold">Filter Date</span>
                                                        {colSubmittedDateFilter && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setColSubmittedDateFilter(undefined)}
                                                                className="h-6 text-xs px-2 text-muted-foreground hover:text-destructive"
                                                            >
                                                                Clear
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <Calendar
                                                        mode="single"
                                                        selected={colSubmittedDateFilter}
                                                        onSelect={setColSubmittedDateFilter}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </TableHead>
                                    <TableHead>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleSort('status')}
                                                className="flex items-center font-semibold hover:text-primary transition-colors focus:outline-none"
                                            >
                                                Status
                                            </button>
                                            <ColumnFilter
                                                title="Status"
                                                options={statusOptions}
                                                selected={colStatusFilter}
                                                onChange={setColStatusFilter}
                                            />
                                        </div>
                                    </TableHead>
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
                                                        className="text-black dark:text-white border border-black dark:border-white p-2 dark:bg-black rounded-none"
                                                        onClick={() => openViewDialog(submission)}
                                                    >
                                                        VIEW
                                                    </Button>
                                                    {canVerify && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-black dark:text-white border border-black dark:border-white p-2 dark:bg-black rounded-none"
                                                                onClick={() => {
                                                                    handleVerify(true, submission)
                                                                }}
                                                            >
                                                                VERIFY
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-black dark:text-white border border-black dark:border-white p-2 dark:bg-black rounded-none"
                                                                onClick={() => openViewDialog(submission)}
                                                            >
                                                                REVIEW
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
                </div>
            </div>

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

                            {(selectedSubmission as any).managerComment && (
                                <div>
                                    <Label className="text-muted-foreground text-xs">
                                        {(selectedSubmission as any).verifiedBy
                                            ? `Previous Comment by ${(selectedSubmission as any).verifiedBy.name} (${(selectedSubmission as any).verifiedBy.role === 'ADMIN' ? 'Admin' : 'Manager'})`
                                            : "Previous Reviewer Comment"}
                                    </Label>
                                    <p className="text-sm mt-1 p-2 bg-muted rounded">
                                        {(selectedSubmission as any).managerComment}
                                    </p>
                                </div>
                            )}

                            <div className="space-y-3 pt-4 border-t">
                                <Label>Change Status</Label>
                                <Select value={newStatus} onValueChange={setNewStatus}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="VERIFIED">Verified</SelectItem>
                                        <SelectItem value="REJECTED">Rejected</SelectItem>
                                    </SelectContent>
                                </Select>

                                {newStatus === 'REJECTED' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="verifyComment">Rejection Reason</Label>
                                        <Textarea
                                            id="verifyComment"
                                            placeholder="Add a reason for rejection..."
                                            value={verifyComment}
                                            onChange={(e) => setVerifyComment(e.target.value)}
                                            rows={3}
                                        />
                                    </div>
                                )}

                                {newStatus !== 'REJECTED' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="verifyComment">Comment (optional)</Label>
                                        <Textarea
                                            id="verifyComment"
                                            placeholder="Add a comment..."
                                            value={verifyComment}
                                            onChange={(e) => setVerifyComment(e.target.value)}
                                            rows={3}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                            Close
                        </Button>
                        {selectedSubmission && newStatus !== selectedSubmission.status && (
                            <Button
                                onClick={() => handleVerify(newStatus === 'VERIFIED')}
                                disabled={isVerifying || (newStatus === 'REJECTED' && !verifyComment.trim())}
                                className="bg-black dark:bg-white text-white dark:text-black border-2 border-black dark:border-white hover:bg-gray-800 dark:hover:bg-gray-200"
                            >
                                {isVerifying ? (
                                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                                ) : newStatus === 'VERIFIED' ? (
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                ) : (
                                    <XCircle className="h-4 w-4 mr-2" />
                                )}
                                {newStatus === 'VERIFIED' ? 'Confirm Verify' : 'Confirm Reject'}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
