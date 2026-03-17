"use client"

import { useState } from "react"
import { ClassroomBooking, Role } from "@/types/cir"
import { useAuth } from "@/components/providers/auth-context"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
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
import { Search, X, Calendar, Clock, Repeat, Lock } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
interface BookingTableProps {
    bookings: ClassroomBooking[]
    isLoading: boolean
    userRole: Role
    onCancel: (id: number) => Promise<void>
}

export default function BookingTable({
    bookings,
    isLoading,
    userRole,
    onCancel
}: BookingTableProps) {
    const { user } = useAuth()
    const [searchQuery, setSearchQuery] = useState("")
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
    const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null)
    const [isCanceling, setIsCanceling] = useState(false)

    /**
     * Determine if the current user can cancel a booking
     * Rules:
     * - ADMIN can cancel any booking
     * - MANAGER can cancel only their own bookings
     * - STAFF can cancel only their own bookings
     */
    const canCancelBooking = (booking: ClassroomBooking): boolean => {
        if (!user) return false
        
        // ADMIN can cancel any booking
        if (userRole === "ADMIN") return true
        
        // MANAGER and STAFF can only cancel their own bookings
        // Compare bookedBy.id with user.id (handle string/number conversion)
        const bookingOwnerId = booking.bookedBy?.id
        const currentUserId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id
        
        return bookingOwnerId === currentUserId
    }

    const filteredBookings = bookings.filter(booking =>
        booking.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.classroom?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.bookedBy?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleCancelClick = (id: number) => {
        setSelectedBookingId(id)
        setCancelDialogOpen(true)
    }

    const handleConfirmCancel = async () => {
        if (selectedBookingId === null) return

        setIsCanceling(true)
        try {
            await onCancel(selectedBookingId)
            setCancelDialogOpen(false)
            setSelectedBookingId(null)
        } finally {
            setIsCanceling(false)
        }
    }

    const formatTime = (isoString: string) => {
        try {
            return format(new Date(isoString), "hh:mm a")
        } catch {
            return isoString
        }
    }

    const formatDate = (dateStr: string) => {
        try {
            return format(new Date(dateStr), "MMM dd, yyyy")
        } catch {
            return dateStr
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by title, classroom or user..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            {/* Table */}
            {filteredBookings.length === 0 ? (
                <div className="text-center py-12 border rounded-lg">
                    <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No bookings found</h3>
                    <p className="text-muted-foreground">
                        {searchQuery
                            ? "Try adjusting your search"
                            : "Select a classroom and date to view bookings"}
                    </p>
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead>Booked By</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>Recurrence</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredBookings.map((booking) => (
                                <TableRow key={booking.id}>
                                    <TableCell className="font-medium">
                                        {booking.title}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-medium">
                                                {booking.bookedBy?.name ?? "Unknown User"}
                                            </span>
                                            {booking.bookedBy?.role && (
                                                <span className="text-xs text-muted-foreground">
                                                    {booking.bookedBy.role}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(booking.bookingDate)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 text-sm">
                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                            {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {booking.isRecurring ? (
                                            <div className="flex flex-col gap-1">
                                                <Badge variant="secondary" className="gap-1 w-fit">
                                                    <Repeat className="h-3 w-3" />
                                                    Recurring
                                                </Badge>
                                                {booking.recurrenceRule && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {booking.recurrenceRule}
                                                        {booking.recurrenceEnd && ` until ${formatDate(booking.recurrenceEnd)}`}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {canCancelBooking(booking) ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleCancelClick(booking.id)}
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                title="Cancel this booking"
                                            >
                                                {/* <X className="h-4 w-4" /> */}
                                                Cancel Booking
                                            </Button>
                                        ) : (
                                            <div 
                                                className="text-muted-foreground cursor-not-allowed"
                                                title="You don't have permission to cancel this booking"
                                            >
                                                <Lock className="h-4 w-4" />
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Cancel Confirmation Dialog */}
            <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to cancel this booking? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isCanceling}>
                            No, keep it
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmCancel}
                            disabled={isCanceling}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isCanceling ? "Cancelling..." : "Yes, cancel booking"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
