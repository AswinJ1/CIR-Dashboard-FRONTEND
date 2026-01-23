"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import { Department, SubDepartment, Employee } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Search, Plus, Pencil, Trash2, Users, ChevronRight, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

function SubDepartmentsContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const departmentId = searchParams.get('departmentId')

    const [department, setDepartment] = useState<Department | null>(null)
    const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [hasFetched, setHasFetched] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")

    // Sub-department dialog state
    const [subDeptDialogOpen, setSubDeptDialogOpen] = useState(false)
    const [isEditingSubDept, setIsEditingSubDept] = useState(false)
    const [editingSubDeptId, setEditingSubDeptId] = useState<string | null>(null)
    const [subDeptName, setSubDeptName] = useState("")
    const [subDeptDescription, setSubDeptDescription] = useState("")
    const [isSavingSubDept, setIsSavingSubDept] = useState(false)

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
            if (!currentDept) {
                toast.error("Department not found")
                router.push('/admin/departments')
                return
            }

            setDepartment(currentDept)
            setSubDepartments(allSubDepts.filter(sd => String(sd.departmentId) === departmentId))
            setEmployees(allEmployees)
        } catch (error) {
            console.error("Failed to fetch data:", error)
            toast.error("Failed to load sub-departments")
            setHasFetched(false)
        } finally {
            setIsLoading(false)
        }
    }, [departmentId, hasFetched, router])

    useEffect(() => {
        if (departmentId && !hasFetched) {
            fetchData()
        } else if (!departmentId) {
            setIsLoading(false)
        }
    }, [departmentId, hasFetched, fetchData])

    const refetchData = async () => {
        setHasFetched(false)
        setIsLoading(true)
        try {
            const [depts, allSubDepts, allEmployees] = await Promise.all([
                api.departments.getAll(),
                api.subDepartments.getAll(),
                api.employees.getAll(),
            ])

            const currentDept = depts.find(d => d.id === departmentId)
            setDepartment(currentDept || null)
            setSubDepartments(allSubDepts.filter(sd => sd.departmentId === departmentId))
            setEmployees(allEmployees)
            setHasFetched(true)
        } catch (error) {
            console.error("Failed to fetch data:", error)
            toast.error("Failed to load sub-departments")
        } finally {
            setIsLoading(false)
        }
    }

    const filteredSubDepartments = subDepartments.filter(sd =>
        sd.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    function getStaffCount(subDeptId: string): number {
        return employees.filter(e => e.subDepartmentId === subDeptId && e.role === 'STAFF').length
    }

    function openCreateSubDeptDialog() {
        setIsEditingSubDept(false)
        setEditingSubDeptId(null)
        setSubDeptName("")
        setSubDeptDescription("")
        setSubDeptDialogOpen(true)
    }

    function openEditSubDeptDialog(subDept: SubDepartment) {
        setIsEditingSubDept(true)
        setEditingSubDeptId(subDept.id)
        setSubDeptName(subDept.name)
        setSubDeptDescription(subDept.description || "")
        setSubDeptDialogOpen(true)
    }

    async function handleSaveSubDept() {
        if (!subDeptName.trim()) {
            toast.error("Sub-department name is required")
            return
        }

        setIsSavingSubDept(true)
        try {
            if (isEditingSubDept && editingSubDeptId) {
                await api.subDepartments.update(editingSubDeptId, {
                    name: subDeptName,
                    description: subDeptDescription || undefined,
                })
                toast.success("Sub-department updated successfully")
            } else {
                await api.subDepartments.create({
                    name: subDeptName,
                    description: subDeptDescription || undefined,
                    departmentId: departmentId!,
                })
                toast.success("Sub-department created successfully")
            }
            setSubDeptDialogOpen(false)
            refetchData()
        } catch (error: any) {
            console.error("Failed to save sub-department:", error)
            toast.error(error.message || "Failed to save sub-department")
        } finally {
            setIsSavingSubDept(false)
        }
    }

    async function handleDeleteSubDept(id: string) {
        if (!confirm("Are you sure you want to delete this sub-department?")) return

        try {
            await api.subDepartments.delete(id)
            toast.success("Sub-department deleted successfully")
            refetchData()
        } catch (error) {
            console.error("Failed to delete sub-department:", error)
            toast.error("Failed to delete sub-department")
        }
    }

    function navigateToStaff(subDeptId: string) {
        router.push(`/admin/departments/subdepartments/staff?departmentId=${departmentId}&subDepartmentId=${subDeptId}`)
    }

    if (!departmentId) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center py-12 text-muted-foreground">
                            <p>No department selected</p>
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
                        <BreadcrumbPage>{department?.name || 'Sub-Departments'}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push('/admin/departments')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Sub-Departments</h1>
                        <p className="text-muted-foreground">
                            Manage sub-departments under {department?.name}
                        </p>
                    </div>
                </div>
                <Button onClick={openCreateSubDeptDialog}>
                    <Plus className="h-4 w-4 mr-2" /> Add Sub-Department
                </Button>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search sub-departments..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Sub-Departments List */}
            <Card>
                <CardHeader>
                    <CardTitle>Sub-Departments in {department?.name}</CardTitle>
                    <CardDescription>
                        {subDepartments.length} sub-department{subDepartments.length !== 1 ? 's' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredSubDepartments.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No sub-departments found</p>
                            <Button variant="outline" className="mt-4" onClick={openCreateSubDeptDialog}>
                                <Plus className="h-4 w-4 mr-2" /> Create First Sub-Department
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Sub-Department</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Staff</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSubDepartments.map((subDept) => (
                                    <TableRow key={subDept.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                                    <Users className="h-4 w-4 text-blue-500" />
                                                </div>
                                                <span className="font-medium">{subDept.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground max-w-[300px] truncate">
                                            {subDept.description || '—'}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => navigateToStaff(subDept.id)}
                                                className="gap-1"
                                            >
                                                {getStaffCount(subDept.id)} staff
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openEditSubDeptDialog(subDept)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDeleteSubDept(subDept.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Sub-Department Dialog */}
            <Dialog open={subDeptDialogOpen} onOpenChange={setSubDeptDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {isEditingSubDept ? 'Edit Sub-Department' : 'Create Sub-Department'}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditingSubDept ? 'Update sub-department details' : `Add a new sub-department to ${department?.name}`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Name <span className="text-red-500">*</span></Label>
                            <Input
                                placeholder="Enter sub-department name"
                                value={subDeptName}
                                onChange={(e) => setSubDeptName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                placeholder="Enter sub-department description (optional)"
                                value={subDeptDescription}
                                onChange={(e) => setSubDeptDescription(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSubDeptDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveSubDept} disabled={isSavingSubDept}>
                            {isSavingSubDept ? "Saving..." : isEditingSubDept ? "Save Changes" : "Create Sub-Department"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default function SubDepartmentsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        }>
            <SubDepartmentsContent />
        </Suspense>
    )
}
