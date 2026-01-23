"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import { Department, SubDepartment, Employee, Assignment, WorkSubmission } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { SubmissionStatusBadge } from "@/components/ui/status-badge"
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
    Calendar,
    ClipboardList,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

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
                                <Calendar className="h-4 w-4" />
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
                                            <TableHead>Status</TableHead>
                                            <TableHead>Assigned</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {assignments.map((assignment) => (
                                            <TableRow key={assignment.id}>
                                                <TableCell className="font-medium">
                                                    {assignment.responsibility?.title || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">
                                                        {assignment.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {format(new Date(assignment.assignedAt), "MMM d, yyyy")}
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
