"use client"

import { useEffect, useState, useMemo } from "react"
import { api } from "@/lib/api"
import { Assignment, Responsibility, Employee, AssignmentStatus } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AssignmentStatusBadge } from "@/components/ui/status-badge"
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
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { toast } from "sonner"

const ITEMS_PER_PAGE = 10

export default function ManagerAssignmentsPage() {
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [responsibilities, setResponsibilities] = useState<Responsibility[]>([])
    const [staff, setStaff] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [isCreating, setIsCreating] = useState(false)

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const [searchQuery, setSearchQuery] = useState("")

    // Form state for create
    const [selectedResponsibility, setSelectedResponsibility] = useState("")
    const [selectedEmployee, setSelectedEmployee] = useState("")
    const [assignToAll, setAssignToAll] = useState(false)

    // Edit dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)
    const [editSelectedStaff, setEditSelectedStaff] = useState("")
    const [editAssignToAll, setEditAssignToAll] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        try {
            const [assignmentsData, responsibilitiesData, employeesData] = await Promise.all([
                api.assignments.getAll(),
                api.responsibilities.getAll(),
                api.employees.getAll(),
            ])
            setAssignments(assignmentsData)
            setResponsibilities(responsibilitiesData)
            setStaff(employeesData.filter(e => e.role === 'STAFF'))
        } catch (error) {
            console.error("Failed to fetch data:", error)
        } finally {
            setIsLoading(false)
        }
    }

    // Filtered and paginated assignments
    const filteredAssignments = useMemo(() => {
        return assignments.filter(a => {
            const searchLower = searchQuery.toLowerCase()
            return (
                a.responsibility?.title?.toLowerCase().includes(searchLower) ||
                a.staff?.name?.toLowerCase().includes(searchLower)
            )
        })
    }, [assignments, searchQuery])

    const totalPages = Math.ceil(filteredAssignments.length / ITEMS_PER_PAGE)

    const paginatedAssignments = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return filteredAssignments.slice(start, start + ITEMS_PER_PAGE)
    }, [filteredAssignments, currentPage])

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery])

    async function handleCreate() {
        if (!selectedResponsibility) {
            toast.error("Please select a responsibility")
            return
        }
        if (!assignToAll && !selectedEmployee) {
            toast.error("Please select an employee or choose 'Assign to All'")
            return
        }

        setIsCreating(true)
        try {
            if (assignToAll) {
                for (const emp of staff) {
                    await api.assignments.create({
                        responsibility: { connect: { id: parseInt(selectedResponsibility) } },
                        staff: { connect: { id: parseInt(emp.id) } },
                    })
                }
                toast.success(`Assignment created for ${staff.length} staff members`)
            } else {
                await api.assignments.create({
                    responsibility: { connect: { id: parseInt(selectedResponsibility) } },
                    staff: { connect: { id: parseInt(selectedEmployee) } },
                })
                toast.success("Assignment created successfully")
            }
            setCreateDialogOpen(false)
            resetForm()
            fetchData()
        } catch (error) {
            console.error("Failed to create assignment:", error)
            toast.error("Failed to create assignment")
        } finally {
            setIsCreating(false)
        }
    }

    function resetForm() {
        setSelectedResponsibility("")
        setSelectedEmployee("")
        setAssignToAll(false)
    }

    function openEditDialog(assignment: Assignment) {
        setEditingAssignment(assignment)
        setEditSelectedStaff(assignment.staffId || "")
        setEditAssignToAll(false)
        setEditDialogOpen(true)
    }

    async function handleUpdate() {
        if (!editingAssignment) return

        if (!editAssignToAll && !editSelectedStaff) {
            toast.error("Please select a staff member or choose 'Assign to All'")
            return
        }

        setIsUpdating(true)
        try {
            // Delete old assignment
            await api.assignments.delete(editingAssignment.id)

            if (editAssignToAll) {
                // Create assignment for all staff members
                for (const emp of staff) {
                    await api.assignments.create({
                        responsibility: { connect: { id: parseInt(editingAssignment.responsibilityId) } },
                        staff: { connect: { id: parseInt(emp.id) } },
                    })
                }
                toast.success(`Assigned to ${staff.length} staff members`)
            } else {
                // If same staff, recreate (no actual change but keeps consistent flow)
                await api.assignments.create({
                    responsibility: { connect: { id: parseInt(editingAssignment.responsibilityId) } },
                    staff: { connect: { id: parseInt(editSelectedStaff) } },
                })
                toast.success("Assignment reassigned successfully")
            }

            setEditDialogOpen(false)
            setEditingAssignment(null)
            fetchData()
        } catch (error) {
            console.error("Failed to update assignment:", error)
            toast.error("Failed to reassign")
        } finally {
            setIsUpdating(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure you want to delete this assignment?")) return

        try {
            await api.assignments.delete(id)
            toast.success("Assignment deleted")
            fetchData()
        } catch (error) {
            console.error("Failed to delete assignment:", error)
            toast.error("Failed to delete assignment")
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
                    <p className="text-muted-foreground">
                        Create and manage work assignments for your team
                    </p>
                </div>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" /> Create Assignment
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Assignment</DialogTitle>
                            <DialogDescription>
                                Assign a responsibility to a staff member
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Responsibility *</Label>
                                <Select value={selectedResponsibility} onValueChange={setSelectedResponsibility}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a responsibility" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {responsibilities.map((resp) => (
                                            <SelectItem key={resp.id} value={resp.id}>
                                                {resp.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="assignToAll"
                                    checked={assignToAll}
                                    onChange={(e) => {
                                        setAssignToAll(e.target.checked)
                                        if (e.target.checked) setSelectedEmployee("")
                                    }}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <Label htmlFor="assignToAll" className="text-sm font-medium">
                                    Assign to all staff members ({staff.length})
                                </Label>
                            </div>

                            {!assignToAll && (
                                <div className="space-y-2">
                                    <Label>Assign To *</Label>
                                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a staff member" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {staff.map((emp) => (
                                                <SelectItem key={emp.id} value={emp.id}>
                                                    {emp.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreate} disabled={isCreating}>
                                {isCreating ? "Creating..." : "Create Assignment"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search by responsibility or staff name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Assignments Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Assignments</CardTitle>
                    <CardDescription>
                        Showing {paginatedAssignments.length} of {filteredAssignments.length} assignments
                        {searchQuery && ` matching "${searchQuery}"`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredAssignments.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            {searchQuery ? "No assignments match your search." : "No assignments yet. Create one to get started."}
                        </p>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Responsibility</TableHead>
                                        <TableHead>Assigned To</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedAssignments.map((assignment) => (
                                        <TableRow key={assignment.id}>
                                            <TableCell className="font-medium">
                                                {assignment.responsibility?.title || 'N/A'}
                                            </TableCell>
                                            <TableCell>{assignment.staff?.name || 'Unknown'}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openEditDialog(assignment)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={() => handleDelete(assignment.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                    <p className="text-sm text-muted-foreground">
                                        Page {currentPage} of {totalPages}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4 mr-1" />
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            Next
                                            <ChevronRight className="h-4 w-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reassign Task</DialogTitle>
                        <DialogDescription>
                            Change who this responsibility is assigned to
                        </DialogDescription>
                    </DialogHeader>

                    {editingAssignment && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">Responsibility</Label>
                                <p className="font-medium">{editingAssignment.responsibility?.title || 'N/A'}</p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-muted-foreground">Currently Assigned To</Label>
                                <p className="font-medium">{editingAssignment.staff?.name || 'Unknown'}</p>
                            </div>

                            {/* Assign to All Toggle */}
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="editAssignToAll"
                                    checked={editAssignToAll}
                                    onChange={(e) => {
                                        setEditAssignToAll(e.target.checked)
                                        if (e.target.checked) setEditSelectedStaff("")
                                    }}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <Label htmlFor="editAssignToAll" className="text-sm font-medium">
                                    Assign to all staff members ({staff.length})
                                </Label>
                            </div>

                            {!editAssignToAll && (
                                <div className="space-y-2">
                                    <Label>Reassign To *</Label>
                                    <Select value={editSelectedStaff} onValueChange={setEditSelectedStaff}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a staff member" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {staff.map((emp) => (
                                                <SelectItem key={emp.id} value={emp.id}>
                                                    {emp.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpdate} disabled={isUpdating}>
                            {isUpdating ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    )
}
