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
import { Search, Ban, CheckCircle, FolderOpen } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface ClassroomTableProps {
    classrooms: Classroom[]
    isLoading: boolean
    userRole: Role
    onDisable?: (id: number) => Promise<void>
    onBook: (classroom: Classroom) => void
}

export default function ClassroomTable({
    classrooms,
    isLoading,
    userRole,
    onDisable,
    onBook
}: ClassroomTableProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [disableDialogOpen, setDisableDialogOpen] = useState(false)
    const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const filteredClassrooms = classrooms.filter(classroom =>
        classroom.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleDisableClick = (classroom: Classroom) => {
        setSelectedClassroom(classroom)
        setDisableDialogOpen(true)
    }

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

    const getStatusBadge = (classroom: Classroom) => {
        if (classroom.isDisabled) {
            return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Disabled</Badge>
        }
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
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
                <div className="relative flex-1">
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
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredClassrooms.map((classroom) => (
                                <TableRow key={classroom.id}>
                                    <TableCell className="font-medium">{classroom.name}</TableCell>
                                    <TableCell>{getStatusBadge(classroom)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {!classroom.isDisabled && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => onBook(classroom)}
                                                >
                                                    <CheckCircle className="w-4 h-4 mr-1" />
                                                    Book
                                                </Button>
                                            )}
                                            {onDisable && !classroom.isDisabled && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDisableClick(classroom)}
                                                >
                                                    <Ban className="w-4 h-4 mr-1 text-destructive" />
                                                    Disable
                                                </Button>
                                            )}
                                        </div>
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
        </div>
    )
}
