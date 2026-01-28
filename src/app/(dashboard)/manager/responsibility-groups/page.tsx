"use client"

import { useEffect, useState, useMemo } from "react"
import { api } from "@/lib/api"
import { Responsibility, ResponsibilityGroup, Employee } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Plus,
    Pencil,
    Trash2,
    Search,
    FolderOpen,
    FolderPlus,
    ChevronDown,
    ChevronRight,
    X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"

export default function ManagerResponsibilityGroupsPage() {
    const [groups, setGroups] = useState<ResponsibilityGroup[]>([])
    const [responsibilities, setResponsibilities] = useState<Responsibility[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")

    // Create group dialog state
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [newGroupName, setNewGroupName] = useState("")
    const [newGroupDescription, setNewGroupDescription] = useState("")
    const [newGroupCycle, setNewGroupCycle] = useState("")
    const [selectedResponsibilityIds, setSelectedResponsibilityIds] = useState<Set<number>>(new Set())

    // Edit group dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [editingGroup, setEditingGroup] = useState<ResponsibilityGroup | null>(null)
    const [editGroupName, setEditGroupName] = useState("")
    const [editGroupDescription, setEditGroupDescription] = useState("")
    const [isUpdating, setIsUpdating] = useState(false)

    // Add responsibilities dialog state
    const [addResponsibilitiesDialogOpen, setAddResponsibilitiesDialogOpen] = useState(false)
    const [addingToGroup, setAddingToGroup] = useState<ResponsibilityGroup | null>(null)
    const [responsibilitiesToAdd, setResponsibilitiesToAdd] = useState<Set<number>>(new Set())
    const [isAddingResponsibilities, setIsAddingResponsibilities] = useState(false)

    // Expanded groups for viewing
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    useEffect(() => {
        fetchData()
        // Auto-generate cycle from current month
        const now = new Date()
        setNewGroupCycle(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    }, [])

    async function fetchData() {
        try {
            const [groupsData, responsibilitiesData] = await Promise.all([
                api.responsibilityGroups.getAll(),
                api.responsibilities.getAll(),
            ])
            setGroups(groupsData)
            setResponsibilities(responsibilitiesData)
        } catch (error) {
            console.error("Failed to fetch data:", error)
            toast.error("Failed to load data")
        } finally {
            setIsLoading(false)
        }
    }

    // Filter groups by search
    const filteredGroups = useMemo(() => {
        return groups.filter(g =>
            g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
    }, [groups, searchQuery])

    // Get responsibilities that match the selected cycle for group creation
    const cycleFilteredResponsibilities = useMemo(() => {
        if (!newGroupCycle || newGroupCycle.length !== 7) return responsibilities
        
        const [yearStr, monthStr] = newGroupCycle.split('-')
        const year = parseInt(yearStr)
        const month = parseInt(monthStr)
        
        if (isNaN(year) || isNaN(month)) return responsibilities
        
        // Create the start and end of the cycle month
        const cycleStart = new Date(year, month - 1, 1) // First day of month
        const cycleEnd = new Date(year, month, 0) // Last day of month
        
        return responsibilities.filter(resp => {
            // If responsibility has a cycle field, match it
            if (resp.cycle === newGroupCycle) return true
            
            // If responsibility has startDate/endDate, check if it falls within the cycle
            if (resp.startDate) {
                const respStart = new Date(resp.startDate)
                const respEnd = resp.endDate ? new Date(resp.endDate) : respStart
                
                // Check if the responsibility's date range overlaps with the cycle month
                return respStart <= cycleEnd && respEnd >= cycleStart
            }
            
            return false
        })
    }, [responsibilities, newGroupCycle])

    // Select all filtered responsibilities
    const handleSelectAll = () => {
        const allIds = cycleFilteredResponsibilities.map(r => parseInt(r.id))
        setSelectedResponsibilityIds(new Set(allIds))
    }

    // Clear all selections
    const handleClearAll = () => {
        setSelectedResponsibilityIds(new Set())
    }

    // Get responsibilities not yet in a specific group
    const getAvailableResponsibilities = (group: ResponsibilityGroup | null) => {
        if (!group) return responsibilities
        const groupRespIds = new Set(group.items?.map(item => String(item.responsibilityId)) || [])
        return responsibilities.filter(r => !groupRespIds.has(String(r.id)))
    }

    // Toggle responsibility selection for create
    const toggleResponsibilitySelection = (id: number) => {
        setSelectedResponsibilityIds(prev => {
            const newSet = new Set(prev)
            if (newSet.has(id)) {
                newSet.delete(id)
            } else {
                newSet.add(id)
            }
            return newSet
        })
    }

    // Toggle responsibility selection for adding to existing group
    const toggleResponsibilityToAdd = (id: number) => {
        setResponsibilitiesToAdd(prev => {
            const newSet = new Set(prev)
            if (newSet.has(id)) {
                newSet.delete(id)
            } else {
                newSet.add(id)
            }
            return newSet
        })
    }

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

    // Create a new group
    async function handleCreateGroup() {
        if (!newGroupName.trim()) {
            toast.error("Group name is required")
            return
        }

        setIsCreating(true)
        try {
            await api.responsibilityGroups.create({
                name: newGroupName.trim(),
                description: newGroupDescription.trim() || undefined,
                cycle: newGroupCycle.trim() || undefined,
                responsibilityIds: Array.from(selectedResponsibilityIds),
            })
            toast.success("Responsibility group created successfully")
            setCreateDialogOpen(false)
            resetCreateForm()
            fetchData()
        } catch (error: any) {
            console.error("Failed to create group:", error)
            toast.error(error.message || "Failed to create group")
        } finally {
            setIsCreating(false)
        }
    }

    function resetCreateForm() {
        setNewGroupName("")
        setNewGroupDescription("")
        setSelectedResponsibilityIds(new Set())
        const now = new Date()
        setNewGroupCycle(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    }

    // Open edit dialog
    function openEditDialog(group: ResponsibilityGroup) {
        setEditingGroup(group)
        setEditGroupName(group.name)
        setEditGroupDescription(group.description || "")
        setEditDialogOpen(true)
    }

    // Update group
    async function handleUpdateGroup() {
        if (!editingGroup) return
        if (!editGroupName.trim()) {
            toast.error("Group name is required")
            return
        }

        setIsUpdating(true)
        try {
            await api.responsibilityGroups.update(editingGroup.id, {
                name: editGroupName.trim(),
                description: editGroupDescription.trim() || undefined,
            })
            toast.success("Group updated successfully")
            setEditDialogOpen(false)
            setEditingGroup(null)
            fetchData()
        } catch (error: any) {
            console.error("Failed to update group:", error)
            toast.error(error.message || "Failed to update group")
        } finally {
            setIsUpdating(false)
        }
    }

    // Delete group
    async function handleDeleteGroup(group: ResponsibilityGroup) {
        if (!confirm(`Are you sure you want to delete the group "${group.name}"? This will NOT delete the responsibilities inside.`)) {
            return
        }

        try {
            await api.responsibilityGroups.delete(group.id)
            toast.success("Group deleted successfully")
            fetchData()
        } catch (error: any) {
            console.error("Failed to delete group:", error)
            toast.error(error.message || "Failed to delete group")
        }
    }

    // Open add responsibilities dialog
    function openAddResponsibilitiesDialog(group: ResponsibilityGroup) {
        setAddingToGroup(group)
        setResponsibilitiesToAdd(new Set())
        setAddResponsibilitiesDialogOpen(true)
    }

    // Add responsibilities to group
    async function handleAddResponsibilities() {
        if (!addingToGroup) return
        if (responsibilitiesToAdd.size === 0) {
            toast.error("Please select at least one responsibility")
            return
        }

        setIsAddingResponsibilities(true)
        try {
            await api.responsibilityGroups.addResponsibilities(addingToGroup.id, {
                responsibilityIds: Array.from(responsibilitiesToAdd),
            })
            toast.success(`Added ${responsibilitiesToAdd.size} responsibilities to the group`)
            setAddResponsibilitiesDialogOpen(false)
            setAddingToGroup(null)
            setResponsibilitiesToAdd(new Set())
            fetchData()
        } catch (error: any) {
            console.error("Failed to add responsibilities:", error)
            toast.error(error.message || "Failed to add responsibilities")
        } finally {
            setIsAddingResponsibilities(false)
        }
    }

    // Remove responsibility from group
    async function handleRemoveResponsibilityFromGroup(groupId: string, responsibilityId: string, responsibilityTitle: string) {
        if (!confirm(`Remove "${responsibilityTitle}" from this group?`)) {
            return
        }

        try {
            await api.responsibilityGroups.removeResponsibility(groupId, responsibilityId)
            toast.success("Responsibility removed from group")
            fetchData()
        } catch (error: any) {
            console.error("Failed to remove responsibility:", error)
            toast.error(error.message || "Failed to remove responsibility")
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
                    <h1 className="text-3xl font-bold tracking-tight">Responsibility Groups</h1>
                    <p className="text-muted-foreground">
                        Create and manage groups of responsibilities for bulk assignment
                    </p>
                </div>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <FolderPlus className="h-4 w-4 mr-2" /> Create Group
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Create Responsibility Group</DialogTitle>
                            <DialogDescription>
                                Create a new group and add responsibilities to it
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            {/* Group Name */}
                            <div className="space-y-2">
                                <Label htmlFor="groupName">
                                    Group Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="groupName"
                                    placeholder="e.g., January Month Responsibilities"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                />
                            </div>

                            {/* Cycle */}
                            <div className="space-y-2">
                                <Label htmlFor="groupCycle">Cycle (YYYY-MM)</Label>
                                <Input
                                    id="groupCycle"
                                    value={newGroupCycle}
                                    onChange={(e) => setNewGroupCycle(e.target.value)}
                                    placeholder="e.g., 2026-01"
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <Label htmlFor="groupDescription">Description</Label>
                                <Textarea
                                    id="groupDescription"
                                    placeholder="Describe this group..."
                                    value={newGroupDescription}
                                    onChange={(e) => setNewGroupDescription(e.target.value)}
                                    rows={2}
                                />
                            </div>

                            {/* Select Responsibilities */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Add Responsibilities to Group</Label>
                                    <div className="flex gap-2">
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="sm"
                                            onClick={handleSelectAll}
                                            disabled={cycleFilteredResponsibilities.length === 0}
                                        >
                                            Select All
                                        </Button>
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="sm"
                                            onClick={handleClearAll}
                                            disabled={selectedResponsibilityIds.size === 0}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {cycleFilteredResponsibilities.length} responsibilities match cycle {newGroupCycle || '(enter cycle)'} ({selectedResponsibilityIds.size} selected)
                                </p>
                                <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                                    {cycleFilteredResponsibilities.length === 0 ? (
                                        <p className="p-4 text-center text-muted-foreground">
                                            No responsibilities available for cycle {newGroupCycle || '(enter cycle)'}. Create some first or change the cycle.
                                        </p>
                                    ) : (
                                        <div className="divide-y">
                                            {cycleFilteredResponsibilities.map((resp) => (
                                                <label
                                                    key={resp.id}
                                                    className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                                                >
                                                    <Checkbox
                                                        checked={selectedResponsibilityIds.has(parseInt(resp.id))}
                                                        onCheckedChange={() => toggleResponsibilitySelection(parseInt(resp.id))}
                                                    />
                                                    <div className="flex-1">
                                                        <p className="font-medium text-sm">{resp.title}</p>
                                                        {resp.description && (
                                                            <p className="text-xs text-muted-foreground line-clamp-1">
                                                                {resp.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {resp.cycle && (
                                                        <Badge variant="outline" className="text-xs">
                                                            {resp.cycle}
                                                        </Badge>
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreateGroup} disabled={isCreating}>
                                {isCreating ? "Creating..." : "Create Group"}
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
                            placeholder="Search groups..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Groups List */}
            <Card>
                <CardHeader>
                    <CardTitle>All Groups</CardTitle>
                    <CardDescription>
                        {filteredGroups.length} group{filteredGroups.length !== 1 ? 's' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredGroups.length === 0 ? (
                        <div className="py-8 text-center">
                            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground">
                                {searchQuery ? "No groups match your search." : "No groups yet. Create one to get started."}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredGroups.map((group) => {
                                const isExpanded = expandedGroups.has(group.id)
                                const itemCount = group._count?.items || group.items?.length || 0

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
                                                    <p className="text-sm text-muted-foreground">
                                                        {itemCount} responsibilit{itemCount !== 1 ? 'ies' : 'y'}
                                                        {group.cycle && ` • Cycle: ${group.cycle}`}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openAddResponsibilitiesDialog(group)}
                                                    >
                                                        <Plus className="h-4 w-4 mr-1" />
                                                        Add
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openEditDialog(group)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={() => handleDeleteGroup(group)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
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
                                                                    <TableHead className="w-[80px]">Actions</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {group.items.map((item) => (
                                                                    <TableRow key={item.id}>
                                                                        <TableCell>
                                                                            <div>
                                                                                <p className="font-medium">
                                                                                    {item.responsibility?.title || 'Untitled'}
                                                                                </p>
                                                                                {item.responsibility?.description && (
                                                                                    <p className="text-sm text-muted-foreground line-clamp-1">
                                                                                        {item.responsibility.description}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <Badge variant="outline">
                                                                                {item.responsibility?.cycle || 'N/A'}
                                                                            </Badge>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                                                onClick={() => handleRemoveResponsibilityFromGroup(
                                                                                    group.id,
                                                                                    item.responsibilityId,
                                                                                    item.responsibility?.title || 'Untitled'
                                                                                )}
                                                                            >
                                                                                <X className="h-4 w-4" />
                                                                            </Button>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    ) : (
                                                        <p className="py-4 text-center text-muted-foreground">
                                                            No responsibilities in this group yet.
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
                </CardContent>
            </Card>

            {/* Edit Group Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Group</DialogTitle>
                        <DialogDescription>
                            Update group details
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="editGroupName">
                                Group Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="editGroupName"
                                value={editGroupName}
                                onChange={(e) => setEditGroupName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="editGroupDescription">Description</Label>
                            <Textarea
                                id="editGroupDescription"
                                value={editGroupDescription}
                                onChange={(e) => setEditGroupDescription(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateGroup} disabled={isUpdating}>
                            {isUpdating ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Responsibilities Dialog */}
            <Dialog open={addResponsibilitiesDialogOpen} onOpenChange={setAddResponsibilitiesDialogOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add Responsibilities</DialogTitle>
                        <DialogDescription>
                            Add responsibilities to "{addingToGroup?.name}"
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm text-muted-foreground">
                                Select responsibilities to add ({responsibilitiesToAdd.size} selected)
                            </p>
                            <div className="flex gap-2">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                        const available = getAvailableResponsibilities(addingToGroup)
                                        setResponsibilitiesToAdd(new Set(available.map(r => parseInt(r.id))))
                                    }}
                                    disabled={getAvailableResponsibilities(addingToGroup).length === 0}
                                >
                                    Select All
                                </Button>
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setResponsibilitiesToAdd(new Set())}
                                    disabled={responsibilitiesToAdd.size === 0}
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>
                        <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                            {getAvailableResponsibilities(addingToGroup).length === 0 ? (
                                <p className="p-4 text-center text-muted-foreground">
                                    All responsibilities are already in this group.
                                </p>
                            ) : (
                                <div className="divide-y">
                                    {getAvailableResponsibilities(addingToGroup).map((resp) => (
                                        <label
                                            key={resp.id}
                                            className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                                        >
                                            <Checkbox
                                                checked={responsibilitiesToAdd.has(parseInt(resp.id))}
                                                onCheckedChange={() => toggleResponsibilityToAdd(parseInt(resp.id))}
                                            />
                                            <div className="flex-1">
                                                <p className="font-medium text-sm">{resp.title}</p>
                                                {resp.description && (
                                                    <p className="text-xs text-muted-foreground line-clamp-1">
                                                        {resp.description}
                                                    </p>
                                                )}
                                            </div>
                                            {resp.cycle && (
                                                <Badge variant="outline" className="text-xs">
                                                    {resp.cycle}
                                                </Badge>
                                            )}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddResponsibilitiesDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleAddResponsibilities} 
                            disabled={isAddingResponsibilities || responsibilitiesToAdd.size === 0}
                        >
                            {isAddingResponsibilities ? "Adding..." : `Add ${responsibilitiesToAdd.size} Responsibilities`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
