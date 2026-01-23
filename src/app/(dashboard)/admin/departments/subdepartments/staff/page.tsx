"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import { Department, SubDepartment, Employee } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
import { Search, User, ChevronRight, ArrowLeft, Mail } from "lucide-react"
import { toast } from "sonner"

function StaffListContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const departmentId = searchParams.get('departmentId')
    const subDepartmentId = searchParams.get('subDepartmentId')

    const [department, setDepartment] = useState<Department | null>(null)
    const [subDepartment, setSubDepartment] = useState<SubDepartment | null>(null)
    const [staffMembers, setStaffMembers] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [hasFetched, setHasFetched] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")

    const fetchData = useCallback(async () => {
        if (hasFetched) return

        try {
            setHasFetched(true)
            const [depts, allSubDepts, allEmployees] = await Promise.all([
                api.departments.getAll(),
                api.subDepartments.getAll(),
                api.employees.getAll(),
            ])

            const currentDept = depts.find(d => String(d.id) === departmentId)
            const currentSubDept = allSubDepts.find(sd => String(sd.id) === subDepartmentId)

            if (!currentDept || !currentSubDept) {
                toast.error("Department or sub-department not found")
                router.push('/admin/departments')
                return
            }

            setDepartment(currentDept)
            setSubDepartment(currentSubDept)
            setStaffMembers(allEmployees.filter(e =>
                String(e.subDepartmentId) === subDepartmentId && e.role === 'STAFF'
            ))
        } catch (error) {
            console.error("Failed to fetch data:", error)
            toast.error("Failed to load staff members")
            setHasFetched(false)
        } finally {
            setIsLoading(false)
        }
    }, [departmentId, subDepartmentId, hasFetched, router])

    useEffect(() => {
        if (departmentId && subDepartmentId && !hasFetched) {
            fetchData()
        } else if (!departmentId || !subDepartmentId) {
            setIsLoading(false)
        }
    }, [departmentId, subDepartmentId, hasFetched, fetchData])

    const filteredStaff = staffMembers.filter(s =>
        s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    function getInitials(name: string): string {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
    }

    function navigateToStaffDetails(staffId: string) {
        router.push(`/admin/departments/subdepartments/staff/${staffId}?departmentId=${departmentId}&subDepartmentId=${subDepartmentId}`)
    }

    if (!departmentId || !subDepartmentId) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center py-12 text-muted-foreground">
                            <p>No sub-department selected</p>
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href={`/admin/departments/subdepartments?departmentId=${departmentId}`}>
                            {department?.name}
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{subDepartment?.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/admin/departments/subdepartments?departmentId=${departmentId}`)}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Staff Members</h1>
                    <p className="text-muted-foreground">
                        Staff in {subDepartment?.name}
                    </p>
                </div>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search staff by name or email..."
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
                    <CardTitle>Staff in {subDepartment?.name}</CardTitle>
                    <CardDescription>
                        {staffMembers.length} staff member{staffMembers.length !== 1 ? 's' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredStaff.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No staff members found in this sub-department</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Staff Member</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStaff.map((staff) => (
                                    <TableRow key={staff.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                                        {getInitials(staff.name || 'U')}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="font-medium">{staff.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Mail className="h-4 w-4" />
                                                {staff.email}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{staff.role}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => navigateToStaffDetails(staff.id)}
                                                className="gap-1"
                                            >
                                                View Profile
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default function StaffListPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        }>
            <StaffListContent />
        </Suspense>
    )
}
