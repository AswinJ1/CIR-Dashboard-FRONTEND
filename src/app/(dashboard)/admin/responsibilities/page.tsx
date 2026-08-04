"use client"

import { useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import { useAuth } from "@/components/providers/auth-context"
import { Responsibility, ResponsibilityGroup, SubDepartment, Department, CreateResponsibilityDto, UpdateResponsibilityDto, Employee, Assignment } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
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
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Plus, Pencil, Trash2, CalendarIcon, Building, ChevronDown, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, Users, FolderOpen, Layers, User } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

function parseLogicalDate(dateStr: string | null | undefined): Date | undefined {
    if (!dateStr) return undefined;
    const ymd = typeof dateStr === 'string' ? dateStr.substring(0, 10) : new Date(dateStr).toISOString().substring(0, 10);
    const [year, month, day] = ymd.split('-').map(Number);
    return new Date(year, month - 1, day);
}

export default function AdminResponsibilitiesPage() {
    const { user } = useAuth()
    const [responsibilities, setResponsibilities] = useState<Responsibility[]>([])
    const [responsibilityGroups, setResponsibilityGroups] = useState<ResponsibilityGroup[]>([])
    const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([])
    const [departments, setDepartments] = useState<Department[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [assignDialogOpen, setAssignDialogOpen] = useState(false)
    const [assigningResponsibility, setAssigningResponsibility] = useState<Responsibility | null>(null)
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("")
    const [isAssigning, setIsAssigning] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedFilterDept, setSelectedFilterDept] = useState<string>("all")
    const [selectedFilterSubDept, setSelectedFilterSubDept] = useState<string>("all")
    const [selectedFilterCycle, setSelectedFilterCycle] = useState<string>("all")
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [isCreating, setIsCreating] = useState(false)

    // Edit state
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [editingResponsibility, setEditingResponsibility] = useState<Responsibility | null>(null)
    const [isEditing, setIsEditing] = useState(false)

    // Expanded rows for viewing details
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)

    // View mode: all, individual, grouped
    const [viewMode, setViewMode] = useState<"all" | "individual" | "grouped">("all")

    // Form state - matches schema exactly
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [cycle, setCycle] = useState("")
    const [selectedSubDepartment, setSelectedSubDepartment] = useState("")
    const [startDate, setStartDate] = useState<Date | undefined>(undefined)
    const [endDate, setEndDate] = useState<Date | undefined>(undefined)

    useEffect(() => {
        fetchData()
        // Auto-generate cycle from current month
        const now = new Date()
        setCycle(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    }, [])

    async function fetchData() {
        try {
            const fetchGroupsSafe = async () => {
                try {
                    return await api.responsibilityGroups.getAll()
                } catch (error: any) {
                    if (error?.status === 404 || error?.response?.status === 404) return []
                    console.error("Failed to fetch responsibility groups:", error)
                    return []
                }
            }

            const [responsibilitiesData, subDepartmentsData, departmentsData, groupsData, employeesData] = await Promise.all([
                api.responsibilities.getAll({ includeRelations: true }),
                api.subDepartments.getAll(),
                api.departments.getAll(),
                fetchGroupsSafe(),
                api.employees.getAll()
            ])
            setResponsibilities(responsibilitiesData)
            setSubDepartments(subDepartmentsData)
            setDepartments(departmentsData)
            setResponsibilityGroups(groupsData)
            setEmployees(employeesData)
        } catch (error) {
            console.error("Failed to fetch data:", error)
        } finally {
            setIsLoading(false)
        }
    }

    // Get unique cycles from responsibilities
    const uniqueCycles = Array.from(new Set(responsibilities.map(r => r.cycle).filter(Boolean))).sort().reverse()

    // Filter sub-departments based on selected department for the filter
    const filteredSubDepartmentsForFilter = selectedFilterDept === "all"
        ? subDepartments
        : subDepartments.filter(sd => sd.departmentId === selectedFilterDept)

    const filteredResponsibilities = responsibilities.filter(r => {
        // Search filter
        const matchesSearch = searchQuery === "" ||
            r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.description?.toLowerCase().includes(searchQuery.toLowerCase())

        // Department filter (check via subDepartment's departmentId)
        const matchesDept = selectedFilterDept === "all" ||
            r.subDepartment?.departmentId === selectedFilterDept ||
            subDepartments.find(sd => sd.id === r.subDepartmentId)?.departmentId === selectedFilterDept

        // Sub-department filter
        const matchesSubDept = selectedFilterSubDept === "all" ||
            r.subDepartmentId === selectedFilterSubDept ||
            r.subDepartment?.id === selectedFilterSubDept

        // Cycle filter
        const matchesCycle = selectedFilterCycle === "all" || r.cycle === selectedFilterCycle

        return matchesSearch && matchesDept && matchesSubDept && matchesCycle
    })

    // Build a map of responsibility ID → group names from the fetched groups
    const responsibilityToGroupsMap = useMemo(() => {
        const map = new Map<string, { groupId: string; groupName: string }[]>()
        for (const group of responsibilityGroups) {
            if (!group.items) continue
            for (const item of group.items) {
                const respId = String(item.responsibilityId)
                if (!map.has(respId)) {
                    map.set(respId, [])
                }
                map.get(respId)!.push({
                    groupId: group.id,
                    groupName: group.name,
                })
            }
        }
        return map
    }, [responsibilityGroups])

    // Apply view mode filter
    const viewFilteredResponsibilities = filteredResponsibilities.filter(r => {
        if (viewMode === "all") return true
        const groups = responsibilityToGroupsMap.get(String(r.id))
        if (viewMode === "grouped") return !!groups && groups.length > 0
        if (viewMode === "individual") return !groups || groups.length === 0
        return true
    })

    // Counts for tab badges
    const individualCount = filteredResponsibilities.filter(r => {
        const groups = responsibilityToGroupsMap.get(String(r.id))
        return !groups || groups.length === 0
    }).length
    const groupedCount = filteredResponsibilities.filter(r => {
        const groups = responsibilityToGroupsMap.get(String(r.id))
        return !!groups && groups.length > 0
    }).length

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery, selectedFilterDept, selectedFilterSubDept, selectedFilterCycle, viewMode])

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(viewFilteredResponsibilities.length / itemsPerPage))
    const paginatedResponsibilities = viewFilteredResponsibilities.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )
    // Helper to get group names for a responsibility
    function getGroupNames(resp: Responsibility): string[] {
        const groups = responsibilityToGroupsMap.get(String(resp.id))
        if (!groups) return []
        return groups.map(g => g.groupName).filter(Boolean)
    }
    async function handleCreate() {
        if (!title.trim()) {
            toast.error("Title is required")
            return
        }
        if (!cycle.trim() || !/^\d{4}-\d{2}$/.test(cycle)) {
            toast.error("Cycle must be in YYYY-MM format")
            return
        }
        if (!selectedSubDepartment) {
            toast.error("Sub-department is required")
            return
        }
        if (!user?.id) {
            toast.error("User authentication required")
            return
        }
        if (startDate && endDate && startDate > endDate) {
            toast.error("Start date must be before end date")
            return
        }

        setIsCreating(true)
        try {
            const payload: CreateResponsibilityDto = {
                title: title.trim(),
                cycle: cycle.trim(),
                createdBy: { connect: { id: parseInt(user.id) } },
                subDepartment: { connect: { id: parseInt(selectedSubDepartment) } },
                description: description.trim() || undefined,
                startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
                endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
            }

            await api.responsibilities.create(payload)
            toast.success("Responsibility created successfully")
            setCreateDialogOpen(false)
            resetForm()
            fetchData()
        } catch (error: any) {
            console.error("Failed to create responsibility:", error)
            toast.error(error.message || "Failed to create responsibility")
        } finally {
            setIsCreating(false)
        }
    }

    function resetForm() {
        setTitle("")
        setDescription("")
        const now = new Date()
        setCycle(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
        setSelectedSubDepartment("")
        setStartDate(undefined)
        setEndDate(undefined)
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure you want to delete this responsibility?")) return

        try {
            await api.responsibilities.delete(id)
            toast.success("Responsibility deleted")
            fetchData()
        } catch (error) {
            console.error("Failed to delete responsibility:", error)
            toast.error("Failed to delete responsibility")
        }
    }

    // Open edit dialog with responsibility data
    function openEditDialog(resp: Responsibility) {
        setEditingResponsibility(resp)
        setTitle(resp.title || "")
        setDescription(resp.description || "")
        setCycle(resp.cycle || "")
        setSelectedSubDepartment(resp.subDepartmentId || "")
        setStartDate(parseLogicalDate(resp.startDate))
        setEndDate(parseLogicalDate(resp.endDate))
        setEditDialogOpen(true)
    }

    // Handle edit submit
    async function handleEdit() {
        if (!editingResponsibility) return

        if (!title.trim()) {
            toast.error("Title is required")
            return
        }
        if (!cycle.trim() || !/^\d{4}-\d{2}$/.test(cycle)) {
            toast.error("Cycle must be in YYYY-MM format")
            return
        }
        if (startDate && endDate && startDate > endDate) {
            toast.error("Start date must be before end date")
            return
        }

        setIsEditing(true)
        try {
            const payload: UpdateResponsibilityDto = {
                title: title.trim(),
                cycle: cycle.trim(),
                description: description.trim() || undefined,
                startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
                endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
            }

            await api.responsibilities.update(editingResponsibility.id, payload)
            toast.success("Responsibility updated successfully")
            setEditDialogOpen(false)
            setEditingResponsibility(null)
            resetForm()
            fetchData()
        } catch (error: any) {
            console.error("Failed to update responsibility:", error)
            toast.error(error.message || "Failed to update responsibility")
        } finally {
            setIsEditing(false)
        }
    }

    // Toggle row expansion
    function toggleRowExpansion(id: string) {
        const newSet = new Set(expandedRows)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setExpandedRows(newSet)
    }

    async function handleAssign() {
        if (!assigningResponsibility || !selectedEmployeeId) return
        
        setIsAssigning(true)
        try {
            await api.assignments.create({
                responsibility: { connect: { id: parseInt(assigningResponsibility.id) } },
                staff: { connect: { id: parseInt(selectedEmployeeId) } }
            })
            toast.success("Responsibility assigned successfully")
            setAssignDialogOpen(false)
            setSelectedEmployeeId("")
            fetchData()
        } catch (error: any) {
            console.error("Failed to assign:", error)
            toast.error(error.message || "Failed to assign responsibility")
        } finally {
            setIsAssigning(false)
        }
    }

    async function handleUnassign(assignmentId: string) {
        try {
            await api.assignments.delete(assignmentId)
            toast.success("Staff unassigned successfully")
            fetchData()
        } catch (error: any) {
            console.error("Failed to unassign:", error)
            toast.error(error.message || "Failed to unassign staff")
        }
    }

    // Helper to get sub-department name by ID
    function getSubDepartmentName(subDeptId?: string): string {
        if (!subDeptId) return 'N/A'
        const subDept = subDepartments.find(sd => sd.id === subDeptId)
        return subDept?.name || 'N/A'
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
                    <h1 className="text-3xl  tracking-tight">Responsibilities</h1>
                    <p className="text-muted-foreground">
                        Manage work responsibilities across all sub-departments
                    </p>
                </div>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" /> Create Responsibility
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Create Responsibility</DialogTitle>
                            <DialogDescription>
                                Create a new responsibility and assign it to a sub-department
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            {/* Title */}
                            <div className="space-y-2">
                                <Label htmlFor="title">
                                    Title <span className="text-foreground">*</span>
                                </Label>
                                <Input
                                    id="title"
                                    placeholder="Enter responsibility title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>

                            {/* Cycle */}
                            <div className="space-y-2">
                                <Label htmlFor="cycle">
                                    Cycle (YYYY-MM) <span className="text-foreground">*</span>
                                </Label>
                                <Input
                                    id="cycle"
                                    value={cycle}
                                    onChange={(e) => setCycle(e.target.value)}
                                    placeholder="e.g., 2026-01"
                                    pattern="\d{4}-\d{2}"
                                />
                                <p className="text-xs text-muted-foreground">
                                    The work cycle this responsibility belongs to
                                </p>
                            </div>

                            {/* Sub-Department */}
                            <div className="space-y-2">
                                <Label>
                                    Sub-Department <span className="text-foreground">*</span>
                                </Label>
                                <Select value={selectedSubDepartment} onValueChange={setSelectedSubDepartment}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a sub-department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {subDepartments.map((sd) => (
                                            <SelectItem key={sd.id} value={sd.id}>
                                                {sd.name} {sd.department?.name ? `(${sd.department.name})` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Start Date */}
                            <div className="space-y-2">
                                <Label>Start Date (Optional)</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !startDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {startDate ? format(startDate, "PPP") : "Select start date"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={startDate}
                                            onSelect={setStartDate}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* End Date */}
                            <div className="space-y-2">
                                <Label>End Date (Optional)</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !endDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {endDate ? format(endDate, "PPP") : "Select end date"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={endDate}
                                            onSelect={setEndDate}
                                            disabled={(date) => startDate ? date < startDate : false}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <Label htmlFor="description">Description (Optional)</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Describe the responsibility..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreate} disabled={isCreating}>
                                {isCreating ? "Creating..." : "Create Responsibility"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search and Filters */}
            <div className="flex gap-3 flex-wrap">
                {/* Search Input */}
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search responsibilities..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Department Filter */}
                <Select value={selectedFilterDept} onValueChange={(v) => {
                    setSelectedFilterDept(v)
                    setSelectedFilterSubDept("all") // Reset sub-department when department changes
                }}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Sub-Department Filter */}
                <Select value={selectedFilterSubDept} onValueChange={setSelectedFilterSubDept}>
                    <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="All Sub-Departments" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Sub-Departments</SelectItem>
                        {filteredSubDepartmentsForFilter.map((sd) => (
                            <SelectItem key={sd.id} value={sd.id}>
                                {sd.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Cycle Filter */}
                <Select value={selectedFilterCycle} onValueChange={setSelectedFilterCycle}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All Cycles" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Cycles</SelectItem>
                        {uniqueCycles.map((cycle) => (
                            <SelectItem key={cycle} value={cycle}>
                                {cycle}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* View Mode Tabs */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "all" | "individual" | "grouped")}>
                <TabsList>
                    <TabsTrigger value="all" className="gap-2">
                        <FolderOpen className="h-4 w-4" />
                        All
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{filteredResponsibilities.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="individual" className="gap-2">
                        <User className="h-4 w-4" />
                        Individual
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{individualCount}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="grouped" className="gap-2">
                        <Layers className="h-4 w-4" />
                        Grouped
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{groupedCount}</Badge>
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Responsibilities List */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>
                            {viewMode === "all" ? "All Responsibilities" : viewMode === "individual" ? "Individual Responsibilities" : "Grouped Responsibilities"}
                        </CardTitle>
                        <CardDescription>
                            {viewFilteredResponsibilities.length} responsibilit{viewFilteredResponsibilities.length !== 1 ? 'ies' : 'y'}
                            {viewFilteredResponsibilities.length > itemsPerPage && (
                                <span> · Page {currentPage} of {totalPages}</span>
                            )}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Per page:</span>
                        <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1) }}>
                            <SelectTrigger className="w-[70px] h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="5">5</SelectItem>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="20">20</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {viewFilteredResponsibilities.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            {viewMode === "grouped"
                                ? "No grouped responsibilities found"
                                : viewMode === "individual"
                                    ? "No individual responsibilities found"
                                    : "No responsibilities found"
                            }
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {paginatedResponsibilities.map((resp) => {
                                const isExpanded = expandedRows.has(resp.id)
                                const groupNames = getGroupNames(resp)
                                const assignments = (resp as any).assignments || []
                                const isGrouped = groupNames.length > 0

                                return (
                                    <Collapsible
                                        key={resp.id}
                                        open={isExpanded}
                                        onOpenChange={() => toggleRowExpansion(resp.id)}
                                    >
                                        <div className={cn("border rounded-none", isGrouped && "border-l-4 border-gray-600 dark:border-gray-600")}>
                                            <div className="flex items-center gap-3 p-4">
                                                <CollapsibleTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        {isExpanded ? (
                                                            <ChevronDown className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </CollapsibleTrigger>

                                                <div className="flex-1">
                                                    {/* <div className="flex items-center gap-2">
                                                        <h3 className="font-semibold">{resp.title}</h3>
                                                        {isGrouped ? (
                                                            <Badge variant="default" className=" text-xs gap-1">
                                                                <Layers className="h-3 w-3" />
                                                                Grouped
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-xs gap-1">
                                                                <User className="h-3 w-3" />
                                                                Individual
                                                            </Badge>
                                                        )}
                                                    </div> */}
                                                    {/* Group name badges */}
                                                  
                                                         <h3 className="">{resp.title}</h3>
                                                
                                                    {groupNames.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {groupNames.map((name, idx) => (
                                                                <Badge key={idx} variant="secondary" className="text-xs gap-1 bg-gray-700 text-white dark:bg-white dark:text-black">
                                                                    <Layers className="h-2.5 w-2.5" />
                                                                    {name}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-1">
                                                        <span className="flex items-center gap-1">
                                                            <Building className="h-3 w-3" />
                                                            {resp.subDepartment?.name || getSubDepartmentName(resp.subDepartmentId)}
                                                        </span>
                                                        {resp.cycle && (
                                                            <>
                                                                <span>•</span>
                                                                <Badge variant="outline">{resp.cycle}</Badge>
                                                            </>
                                                        )}
                                                        {assignments.length > 0 && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="flex items-center gap-1">
                                                                    <Users className="h-3 w-3" />
                                                                    {assignments.length} staff assigned
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {resp.startDate && resp.endDate ? (
                                                        <Badge variant="secondary" className="text-xs">
                                                            {format(parseLogicalDate(resp.startDate)!, "MMM d")} - {format(parseLogicalDate(resp.endDate)!, "MMM d")}
                                                        </Badge>
                                                    ) : null}
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            openEditDialog(resp)
                                                        }}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleDelete(resp.id)
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <CollapsibleContent>
                                                <div className="border-t px-4 pb-4 pt-4 space-y-4">
                                                    {/* Description */}
                                                    {resp.description && (
                                                        <div>
                                                            <h4 className="text-sm font-medium mb-1">Description</h4>
                                                            <p className="text-sm text-muted-foreground">{resp.description}</p>
                                                        </div>
                                                    )}

                                                    {/* Date Range Details */}
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <h4 className="text-sm font-medium mb-1">Start Date</h4>
                                                            <p className="text-sm text-muted-foreground">
                                                                {resp.startDate ? format(parseLogicalDate(resp.startDate)!, "PPP") : "Not set"}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-medium mb-1">End Date</h4>
                                                            <p className="text-sm text-muted-foreground">
                                                                {resp.endDate ? format(parseLogicalDate(resp.endDate)!, "PPP") : "Not set"}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Groups this responsibility belongs to */}
                                                    {groupNames.length > 0 && (
                                                        <div className="pt-4 border-t">
                                                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                                                <FolderOpen className="h-4 w-4" />
                                                                Responsibility Groups
                                                            </h4>
                                                            <div className="flex flex-wrap gap-2">
                                                                {groupNames.map((name, idx) => (
                                                                    <Badge key={idx} variant="secondary">
                                                                        {name}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Assigned Staff */}
                                                    <div className="pt-4 border-t">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h4 className="text-sm font-medium flex items-center gap-2">
                                                                <Users className="h-4 w-4" />
                                                                Assigned Staff
                                                            </h4>
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                onClick={() => {
                                                                    setAssigningResponsibility(resp)
                                                                    setAssignDialogOpen(true)
                                                                }}
                                                            >
                                                                <Plus className="h-4 w-4 mr-1" />
                                                                Assign Staff
                                                            </Button>
                                                        </div>
                                                        {assignments.length > 0 ? (
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead>Name</TableHead>
                                                                        <TableHead>Status</TableHead>
                                                                        <TableHead>Assigned At</TableHead>
                                                                        <TableHead className="text-right">Actions</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {assignments.map((assignment: any) => (
                                                                        <TableRow key={assignment.id}>
                                                                            <TableCell>
                                                                                <p className="font-medium">
                                                                                    {assignment.staff?.name || 'Unknown'}
                                                                                </p>
                                                                                <p className="text-xs text-muted-foreground">
                                                                                    {assignment.staff?.email}
                                                                                </p>
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <Badge variant={
                                                                                    assignment.status === 'VERIFIED' ? 'default' :
                                                                                    assignment.status === 'SUBMITTED' ? 'secondary' :
                                                                                    assignment.status === 'REJECTED' ? 'destructive' :
                                                                                    'outline'
                                                                                }>
                                                                                    {assignment.status}
                                                                                </Badge>
                                                                            </TableCell>
                                                                            <TableCell className="text-muted-foreground">
                                                                                {assignment.assignedAt 
                                                                                    ? format(new Date(assignment.assignedAt), "MMM d, yyyy")
                                                                                    : 'N/A'}
                                                                            </TableCell>
                                                                            <TableCell className="text-right">
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    onClick={() => handleUnassign(assignment.id)}
                                                                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                                >
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </Button>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        ) : (
                                                            <p className="text-sm text-muted-foreground text-center py-2">
                                                                No staff assigned yet
                                                            </p>
                                                        )}
                                                    </div>

                                                    {groupNames.length === 0 && !resp.description && (
                                                        <p className="text-sm text-muted-foreground text-center pt-4">
                                                            No other details available
                                                        </p>
                                                    )}
                                                </div>
                                            </CollapsibleContent>
                                        </div>
                                    </Collapsible>
                                )
                            })}
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {viewFilteredResponsibilities.length > itemsPerPage && (
                        <div className="flex items-center justify-between pt-4 border-t mt-4">
                            <p className="text-sm text-muted-foreground">
                                Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, viewFilteredResponsibilities.length)} of {viewFilteredResponsibilities.length}
                            </p>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronsLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(page => {
                                        if (totalPages <= 5) return true
                                        if (page === 1 || page === totalPages) return true
                                        return Math.abs(page - currentPage) <= 1
                                    })
                                    .map((page, idx, arr) => (
                                        <span key={page} className="flex items-center">
                                            {idx > 0 && arr[idx - 1] !== page - 1 && (
                                                <span className="px-1 text-muted-foreground">…</span>
                                            )}
                                            <Button
                                                variant={currentPage === page ? "default" : "outline"}
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => setCurrentPage(page)}
                                            >
                                                {page}
                                            </Button>
                                        </span>
                                    ))
                                }
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                >
                                    <ChevronsRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Responsibility</DialogTitle>
                        <DialogDescription>
                            Update the responsibility details
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Title */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-title">
                                Title <span className="text-foreground">*</span>
                            </Label>
                            <Input
                                id="edit-title"
                                placeholder="Enter responsibility title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>

                        {/* Cycle */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-cycle">
                                Cycle (YYYY-MM) <span className="text-foreground">*</span>
                            </Label>
                            <Input
                                id="edit-cycle"
                                value={cycle}
                                onChange={(e) => setCycle(e.target.value)}
                                placeholder="e.g., 2026-01"
                                pattern="\d{4}-\d{2}"
                            />
                        </div>

                        {/* Start Date */}
                        <div className="space-y-2">
                            <Label>Start Date (Optional)</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !startDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? format(startDate, "PPP") : "Select start date"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={startDate}
                                        onSelect={setStartDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* End Date */}
                        <div className="space-y-2">
                            <Label>End Date (Optional)</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !endDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {endDate ? format(endDate, "PPP") : "Select end date"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={endDate}
                                        onSelect={setEndDate}
                                        disabled={(date) => startDate ? date < startDate : false}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-description">Description (Optional)</Label>
                            <Textarea
                                id="edit-description"
                                placeholder="Describe the responsibility..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setEditDialogOpen(false)
                            setEditingResponsibility(null)
                            resetForm()
                        }}>
                            Cancel
                        </Button>
                        <Button onClick={handleEdit} disabled={isEditing}>
                            {isEditing ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Assign Staff Dialog */}
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Responsibility</DialogTitle>
                        <DialogDescription>
                            Assign setting this responsibility to an employee. They will need to submit proof of work.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Employee</Label>
                            <Select 
                                value={selectedEmployeeId} 
                                onValueChange={setSelectedEmployeeId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an employee..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees
                                        // Optional: filter out already assigned users
                                        .filter(emp => !assigningResponsibility?.assignments?.some((a: Assignment) => a.staffId === emp.id))
                                        .map(employee => (
                                        <SelectItem key={employee.id} value={employee.id}>
                                            {employee.name} ({employee.email}) - {employee.role}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {employees.length > 0 && employees.filter(emp => !assigningResponsibility?.assignments?.some((a: Assignment) => a.staffId === emp.id)).length === 0 && (
                                <p className="text-sm text-muted-foreground">All employees are already assigned to this responsibility.</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setAssignDialogOpen(false)
                            setSelectedEmployeeId("")
                        }}>Cancel</Button>
                        <Button onClick={handleAssign} disabled={!selectedEmployeeId || isAssigning}>
                            {isAssigning ? "Assigning..." : "Assign"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
