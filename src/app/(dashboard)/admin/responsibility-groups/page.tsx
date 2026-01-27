"use client"

import { useEffect, useState, useMemo } from "react"
import { api } from "@/lib/api"
import { ResponsibilityGroup, SubDepartment, Department } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Search,
    FolderOpen,
    ChevronDown,
    ChevronRight,
    Building2,
    Users,
    Layers,
} from "lucide-react"
import { toast } from "sonner"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"

export default function AdminResponsibilityGroupsPage() {
    const [groups, setGroups] = useState<ResponsibilityGroup[]>([])
    const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([])
    const [departments, setDepartments] = useState<Department[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("all")
    const [selectedSubDepartmentId, setSelectedSubDepartmentId] = useState<string>("all")

    // Expanded groups for viewing
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        try {
            const [groupsData, subDeptsData, deptsData] = await Promise.all([
                api.responsibilityGroups.getAll(),
                api.subDepartments.getAll(),
                api.departments.getAll(),
            ])
            setGroups(groupsData)
            setSubDepartments(subDeptsData)
            setDepartments(deptsData)
        } catch (error) {
            console.error("Failed to fetch data:", error)
            toast.error("Failed to load responsibility groups")
        } finally {
            setIsLoading(false)
        }
    }

    // Filter sub-departments by selected department
    const filteredSubDepartments = useMemo(() => {
        if (selectedDepartmentId === "all") return subDepartments
        return subDepartments.filter(sd => String(sd.departmentId) === selectedDepartmentId)
    }, [subDepartments, selectedDepartmentId])

    // Filter groups by search and filters
    const filteredGroups = useMemo(() => {
        return groups.filter(g => {
            // Search filter
            const matchesSearch = 
                g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                g.description?.toLowerCase().includes(searchQuery.toLowerCase())
            
            if (!matchesSearch) return false

            // Department filter
            if (selectedDepartmentId !== "all") {
                const groupSubDept = subDepartments.find(sd => sd.id === g.subDepartmentId)
                if (!groupSubDept || String(groupSubDept.departmentId) !== selectedDepartmentId) {
                    return false
                }
            }

            // Sub-department filter
            if (selectedSubDepartmentId !== "all") {
                if (String(g.subDepartmentId) !== selectedSubDepartmentId) {
                    return false
                }
            }

            return true
        })
    }, [groups, searchQuery, selectedDepartmentId, selectedSubDepartmentId, subDepartments])

    // Toggle group expansion
    const toggleGroupExpansion = (groupId: string) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev)
            if (newSet.has(groupId)) {
                newSet.delete(groupId)
            } else {
                newSet.add(groupId)
            }
            return newSet
        })
    }

    // Helper to get department name for a sub-department
    const getDepartmentName = (subDeptId?: string) => {
        if (!subDeptId) return 'N/A'
        const subDept = subDepartments.find(sd => sd.id === subDeptId)
        if (!subDept) return 'N/A'
        const dept = departments.find(d => d.id === subDept.departmentId)
        return dept?.name || 'N/A'
    }

    // Helper to get sub-department name
    const getSubDepartmentName = (subDeptId?: string) => {
        if (!subDeptId) return 'N/A'
        const subDept = subDepartments.find(sd => sd.id === subDeptId)
        return subDept?.name || 'N/A'
    }

    // Reset sub-department filter when department changes
    useEffect(() => {
        setSelectedSubDepartmentId("all")
    }, [selectedDepartmentId])

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
                <h1 className="text-3xl font-bold tracking-tight">Responsibility Groups</h1>
                <p className="text-muted-foreground">
                    View all responsibility groups across sub-departments
                </p>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search groups..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                            <SelectTrigger className="w-[200px]">
                                <Building2 className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter by department" />
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
                        <Select value={selectedSubDepartmentId} onValueChange={setSelectedSubDepartmentId}>
                            <SelectTrigger className="w-[200px]">
                                <Layers className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter by sub-dept" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sub-Departments</SelectItem>
                                {filteredSubDepartments.map((sd) => (
                                    <SelectItem key={sd.id} value={sd.id}>
                                        {sd.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Groups List */}
            <Card>
                <CardHeader>
                    <CardTitle>All Groups</CardTitle>
                    <CardDescription>
                        {filteredGroups.length} group{filteredGroups.length !== 1 ? 's' : ''} found
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredGroups.length === 0 ? (
                        <div className="py-8 text-center">
                            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground">
                                {searchQuery || selectedDepartmentId !== "all" || selectedSubDepartmentId !== "all" 
                                    ? "No groups match your filters." 
                                    : "No responsibility groups have been created yet."}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredGroups.map((group) => {
                                const isExpanded = expandedGroups.has(group.id)
                                const itemCount = (group as any)._count?.items || group.items?.length || 0
                                const assignedStaffCount = (group as any)._count?.groupAssignments || 
                                    (group as any).groupAssignments?.length || 0

                                return (
                                    <Collapsible
                                        key={group.id}
                                        open={isExpanded}
                                        onOpenChange={() => toggleGroupExpansion(group.id)}
                                    >
                                        <div className="border rounded-lg">
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

                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <FolderOpen className="h-5 w-5 text-primary" />
                                                </div>

                                                <div className="flex-1">
                                                    <h3 className="font-semibold">{group.name}</h3>
                                                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                                        <span>{itemCount} responsibilit{itemCount !== 1 ? 'ies' : 'y'}</span>
                                                        {group.cycle && (
                                                            <>
                                                                <span>•</span>
                                                                <span>Cycle: {group.cycle}</span>
                                                            </>
                                                        )}
                                                        {assignedStaffCount > 0 && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="flex items-center gap-1">
                                                                    <Users className="h-3 w-3" />
                                                                    {assignedStaffCount} staff assigned
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end gap-1">
                                                    <Badge variant="secondary" className="gap-1">
                                                        <Building2 className="h-3 w-3" />
                                                        {getDepartmentName(group.subDepartmentId)}
                                                    </Badge>
                                                    <Badge variant="outline" className="gap-1">
                                                        <Layers className="h-3 w-3" />
                                                        {getSubDepartmentName(group.subDepartmentId)}
                                                    </Badge>
                                                </div>
                                            </div>

                                            <CollapsibleContent>
                                                <div className="border-t px-4 pb-4">
                                                    {group.items && group.items.length > 0 ? (
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>Responsibility</TableHead>
                                                                    <TableHead>Cycle</TableHead>
                                                                    <TableHead>Description</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {group.items.map((item: any) => (
                                                                    <TableRow key={item.id}>
                                                                        <TableCell>
                                                                            <p className="font-medium">
                                                                                {item.responsibility?.title || 'Untitled'}
                                                                            </p>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <Badge variant="outline">
                                                                                {item.responsibility?.cycle || 'N/A'}
                                                                            </Badge>
                                                                        </TableCell>
                                                                        <TableCell className="text-muted-foreground max-w-[300px] truncate">
                                                                            {item.responsibility?.description || '-'}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    ) : (
                                                        <p className="py-4 text-center text-muted-foreground">
                                                            This group has no responsibilities yet.
                                                        </p>
                                                    )}

                                                    {/* Show assigned staff */}
                                                    {(group as any).groupAssignments && (group as any).groupAssignments.length > 0 && (
                                                        <div className="mt-4 pt-4 border-t">
                                                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                                                <Users className="h-4 w-4" />
                                                                Assigned Staff
                                                            </h4>
                                                            <div className="flex flex-wrap gap-2">
                                                                {(group as any).groupAssignments.map((assignment: any) => (
                                                                    <Badge key={assignment.id} variant="secondary">
                                                                        {assignment.staff?.name || 'Unknown'}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </CollapsibleContent>
                                        </div>
                                    </Collapsible>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
