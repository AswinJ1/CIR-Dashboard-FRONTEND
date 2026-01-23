"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { Department, SubDepartment } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Search, Plus, Pencil, Trash2, Building2, ChevronRight } from "lucide-react"
import { toast } from "sonner"

export default function AdminDepartmentsPage() {
    const router = useRouter()
    const [departments, setDepartments] = useState<Department[]>([])
    const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")

    // Department dialog state
    const [deptDialogOpen, setDeptDialogOpen] = useState(false)
    const [isEditingDept, setIsEditingDept] = useState(false)
    const [editingDeptId, setEditingDeptId] = useState<string | null>(null)
    const [deptName, setDeptName] = useState("")
    const [deptDescription, setDeptDescription] = useState("")
    const [isSavingDept, setIsSavingDept] = useState(false)

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        try {
            const [depts, subDepts] = await Promise.all([
                api.departments.getAll(),
                api.subDepartments.getAll(),
            ])
            setDepartments(depts)
            setSubDepartments(subDepts)
        } catch (error) {
            console.error("Failed to fetch departments:", error)
            toast.error("Failed to load departments")
        } finally {
            setIsLoading(false)
        }
    }

    function getSubDeptCount(deptId: string): number {
        return subDepartments.filter(sd => sd.departmentId === deptId).length
    }

    const filteredDepartments = departments.filter(d =>
        d.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    function openCreateDeptDialog() {
        setIsEditingDept(false)
        setEditingDeptId(null)
        setDeptName("")
        setDeptDescription("")
        setDeptDialogOpen(true)
    }

    function openEditDeptDialog(dept: Department) {
        setIsEditingDept(true)
        setEditingDeptId(dept.id)
        setDeptName(dept.name)
        setDeptDescription(dept.description || "")
        setDeptDialogOpen(true)
    }

    async function handleSaveDept() {
        if (!deptName.trim()) {
            toast.error("Department name is required")
            return
        }

        setIsSavingDept(true)
        try {
            if (isEditingDept && editingDeptId) {
                await api.departments.update(editingDeptId, {
                    name: deptName,
                    description: deptDescription || undefined,
                })
                toast.success("Department updated successfully")
            } else {
                await api.departments.create({
                    name: deptName,
                    description: deptDescription || undefined,
                })
                toast.success("Department created successfully")
            }
            setDeptDialogOpen(false)
            fetchData()
        } catch (error: any) {
            console.error("Failed to save department:", error)
            toast.error(error.message || "Failed to save department")
        } finally {
            setIsSavingDept(false)
        }
    }

    async function handleDeleteDept(id: string) {
        if (!confirm("Are you sure you want to delete this department? All sub-departments will also be deleted.")) return

        try {
            await api.departments.delete(id)
            toast.success("Department deleted successfully")
            fetchData()
        } catch (error) {
            console.error("Failed to delete department:", error)
            toast.error("Failed to delete department")
        }
    }

    function navigateToSubDepartments(deptId: string) {
        router.push(`/admin/departments/subdepartments?departmentId=${deptId}`)
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Departments</h1>
                    <p className="text-muted-foreground">
                        Manage organization departments
                    </p>
                </div>
                <Button onClick={openCreateDeptDialog}>
                    <Plus className="h-4 w-4 mr-2" /> Add Department
                </Button>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search departments..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Departments List */}
            <Card>
                <CardHeader>
                    <CardTitle>All Departments</CardTitle>
                    <CardDescription>
                        {departments.length} department{departments.length !== 1 ? 's' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredDepartments.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No departments found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Sub-departments</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredDepartments.map((dept) => (
                                    <TableRow key={dept.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-primary/10 rounded-lg">
                                                    <Building2 className="h-4 w-4 text-primary" />
                                                </div>
                                                <span className="font-medium">{dept.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground max-w-[300px] truncate">
                                            {dept.description || '—'}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => navigateToSubDepartments(dept.id)}
                                                className="gap-1"
                                            >
                                                {getSubDeptCount(dept.id)} sub-departments
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openEditDeptDialog(dept)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDeleteDept(dept.id)}
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

            {/* Department Dialog */}
            <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {isEditingDept ? 'Edit Department' : 'Create Department'}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditingDept ? 'Update department details' : 'Add a new department to the organization'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Name <span className="text-red-500">*</span></Label>
                            <Input
                                placeholder="Enter department name"
                                value={deptName}
                                onChange={(e) => setDeptName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                placeholder="Enter department description (optional)"
                                value={deptDescription}
                                onChange={(e) => setDeptDescription(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeptDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveDept} disabled={isSavingDept}>
                            {isSavingDept ? "Saving..." : isEditingDept ? "Save Changes" : "Create Department"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
