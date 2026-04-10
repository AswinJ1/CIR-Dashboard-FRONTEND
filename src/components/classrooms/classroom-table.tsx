"use client"

import { useState } from "react"
import { Classroom, Role } from "@/types/cir"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Search, Ban, CheckCircle, FolderOpen, Trash2, Check, MoreHorizontal } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { on } from "events"
import { se } from "date-fns/locale"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ClassroomTableProps {
    classrooms: Classroom[]
    isLoading: boolean
    userRole: Role
    onDisable?: (id: number) => Promise<void>
    onEnable?: (id: number) => Promise<void>
    onDelete?: (id: number) => Promise<void>
    onBook: (classroom: Classroom) => void
}

export default function ClassroomTable({
    classrooms,
    isLoading,
    userRole,
    onDisable,
    onEnable,
    onDelete,
    onBook
}: ClassroomTableProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [disableDialogOpen, setDisableDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [enableDialogOpen, setEnableDialogOpen] = useState(false)
    const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const filteredClassrooms = classrooms.filter(classroom => {
        const matchesSearch = classroom.name.toLowerCase().includes(searchQuery.toLowerCase())
        // If Admin, show everything. Otherwise, only show if NOT false.
        const isVisible = userRole === "ADMIN" ? true : classroom.isActive !== false
        return matchesSearch && isVisible
    })

    const handleDisableClick = (classroom: Classroom) => {
        setSelectedClassroom(classroom)
        setDisableDialogOpen(true)
    }
    const handleEnableClick = (classroom: Classroom) => {
        setSelectedClassroom(classroom)
        setEnableDialogOpen(true)
    }
    const handleDeleteClick = (classroom: Classroom) => {
        setSelectedClassroom(classroom)
        setDeleteDialogOpen(true)
    }
    // const handleDeleteClick = async (classroom: Classroom) => {
    //     if (!onDelete) return
    //     try {
    //         await onDelete(classroom.id)
    
    //     } catch (error) {
    //         console.error("Error deleting classroom:", error)
    //     }
    // }
    // const handleEnableClick = async (classroom: Classroom) => {
    //     if (!onEnable) return
    //     setIsSubmitting(true)
    //     try {
    //         await onEnable(classroom.id)
    //     } catch (error) {
    //         console.error("Error enabling classroom:", error)
    //     } finally {
    //         setIsSubmitting(false)
    //     }
    // }
    const handleDisableConfirm = async () => {
        if (!selectedClassroom || !onDisable) return

        setIsSubmitting(true)
        try {
            await onDisable(selectedClassroom.id)
            setDisableDialogOpen(false)
            setSelectedClassroom(null)
        } finally {
            setIsSubmitting(false)
        }
    }
    const handleEnableConfirm = async () => {
        if (!selectedClassroom || !onEnable) return
        setIsSubmitting(true)
        try {
            await onEnable(selectedClassroom.id)
            setEnableDialogOpen(false)
            setSelectedClassroom(null)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteConfirm = async () => {
        if (!selectedClassroom || !onDelete) return
        setIsSubmitting(true)
        try {
            await onDelete(selectedClassroom.id)
            setDeleteDialogOpen(false)
            setSelectedClassroom(null)
        } finally {
            setIsSubmitting(false)
        }
    }

    const getStatusBadge = (classroom: Classroom) => {
        if (classroom.isActive== false) {
            return <Badge variant="outline" className="bg-red-700 text-white border rounded-none">Disabled</Badge>
        }
        return <Badge variant="outline" className="bg-green-700 text-white border rounded-none">Active</Badge>
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex items-center gap-2">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search classrooms by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Table */}
            {filteredClassrooms.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No classrooms found</p>
                </div>
            ) : (
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Classroom Name</TableHead>
                                {userRole === "ADMIN" && <TableHead>Status</TableHead>}
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredClassrooms.map((classroom) => (
                                <TableRow key={classroom.id}>
                                    <TableCell className="font-medium">{classroom.name}</TableCell>
                                    {userRole === "ADMIN" && <TableCell>{getStatusBadge(classroom)}</TableCell>}
                                    <TableCell>
                                        {userRole === "ADMIN" ? (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    
                                                    {/* If Active, allow Booking */}
                                                    {classroom.isActive !== false && (
                                                        <DropdownMenuItem onClick={() => onBook(classroom)}>
                                                            <CheckCircle className="w-4 h-4 mr-2" />
                                                            Book Classroom
                                                        </DropdownMenuItem>
                                                    )}

                                                    {/* If Active, allow Disabling */}
                                                    {onDisable && classroom.isActive !== false && (
                                                        <DropdownMenuItem 
                                                            onClick={() => handleDisableClick(classroom)}
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <Ban className="w-4 h-4 mr-2" />
                                                            Disable
                                                        </DropdownMenuItem>
                                                    )}

                                                    {/* If INACTIVE (false), allow Enabling */}
                                                    {onEnable && classroom.isActive === false && (
                                                        <DropdownMenuItem 
                                                            onClick={() => handleEnableClick(classroom)}
                                                        >
                                                            {/* <Check className="w-4 h-4 mr-2" /> */}
                                                            Enable
                                                        </DropdownMenuItem>
                                                    )}

                                                    {/* Both Active and Inactive can be Deleted */}
                                                    {onDelete && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem 
                                                                onClick={() => handleDeleteClick(classroom)}
                                                                className="text-destructive focus:text-destructive"
                                                            >
                                                                <Trash2 className="w-4 h-4 mr-2" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : (
                                            <Button size="sm" onClick={() => onBook(classroom)}>
                                                Book
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Disable Confirmation Dialog */}
            <AlertDialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Disable Classroom</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to disable &quot;{selectedClassroom?.name}&quot;?
                            Disabled classrooms cannot be booked.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDisableConfirm}
                            disabled={isSubmitting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isSubmitting ? "Disabling..." : "Disable"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            
            {/* Enaable Confirmation Dialog */}
            <AlertDialog open={enableDialogOpen} onOpenChange={setEnableDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Enable Classroom</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to enable &quot;{selectedClassroom?.name}&quot;?
                            Enabled classrooms can be booked.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleEnableConfirm}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Enabling..." : "Enable"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

               <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Classroom</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{selectedClassroom?.name}&quot;?
                                This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            disabled={isSubmitting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isSubmitting ? "Deleting  ..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
        </div>
    )
}
