"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/providers/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { Plus, FolderOpen, Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { Classroom, ClassroomBooking, Role } from "@/types/cir"
import ClassroomTable from "@/components/classrooms/classroom-table"
import BookingTable from "@/components/classrooms/booking-table"
import CreateClassroomModal from "@/components/classrooms/create-classroom-modal"
import BookClassroomModal from "@/components/classrooms/book-classroom-modal"
import { classroomApi, bookingApi } from "@/lib/api"
import { toast } from "sonner"

export default function ClassroomManagementPage() {
    const { user } = useAuth()
    const userRole = user?.role as Role

    // Debug: Log role for verification
    useEffect(() => {
        if (userRole) {
            console.log('📋 Classroom Management - User Role:', userRole)
        }
    }, [userRole])

    const [classrooms, setClassrooms] = useState<Classroom[]>([])
    const [bookings, setBookings] = useState<ClassroomBooking[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isLoadingBookings, setIsLoadingBookings] = useState(false)

    const [createModalOpen, setCreateModalOpen] = useState(false)
    const [bookModalOpen, setBookModalOpen] = useState(false)
    const [preselectedClassroom, setPreselectedClassroom] = useState<Classroom | null>(null)

    // Booking filter state
    const [selectedClassroomId, setSelectedClassroomId] = useState<string>("")
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())

    // Check permissions
    const allowedRoles: Role[] = ["ADMIN", "MANAGER", "STAFF"]
    const hasPageAccess = userRole && allowedRoles.includes(userRole)

    const canCreateClassroom = userRole === "ADMIN"
    const canDisableClassroom = userRole === "ADMIN" || userRole === "MANAGER"

    // If role not loaded or no access, show loading/error
    if (!userRole || !hasPageAccess) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        )
    }

    // Fetch classrooms on mount
    useEffect(() => {
        fetchClassrooms()
    }, [userRole])

    const fetchClassrooms = async () => {
        setIsLoading(true)
        try {
            const data = await classroomApi.getAll()
            setClassrooms(data)
        } catch (error: any) {
            handleApiError(error, "Failed to load classrooms")
        } finally {
            setIsLoading(false)
        }
    }

    const fetchBookings = async () => {
        if (!selectedClassroomId) return

        setIsLoadingBookings(true)
        try {
            const dateStr = format(selectedDate, "yyyy-MM-dd")
            const data = await bookingApi.getByClassroomAndDate(
                Number(selectedClassroomId),
                dateStr
            )
            setBookings(data)
        } catch (error: any) {
            handleApiError(error, "Failed to load bookings")
        } finally {
            setIsLoadingBookings(false)
        }
    }

    // Fetch bookings when classroom or date changes
    useEffect(() => {
        if (selectedClassroomId) {
            fetchBookings()
        } else {
            setBookings([])
        }
    }, [selectedClassroomId, selectedDate])

    const handleApiError = (error: any, fallback: string) => {
        const status = error?.statusCode
        if (status === 403) {
            toast.error("Permission denied. You do not have access to this action.")
        } else if (status === 400) {
            toast.error(error.message || "Validation error. Please check your input.")
        } else if (status === 500) {
            toast.error("An unexpected server error occurred. Please try again later.")
        } else {
            toast.error(error.message || fallback)
        }
    }

    const handleCreateClassroom = async (data: { name: string }) => {
        try {
            await classroomApi.create(data)
            setCreateModalOpen(false)
            toast.success("Classroom created successfully")
            fetchClassrooms()
        } catch (error: any) {
            handleApiError(error, "Failed to create classroom")
            throw error
        }
    }

    const handleDisableClassroom = async (id: number) => {
        try {
            await classroomApi.disable(id)
            toast.success("Classroom disabled successfully")
            fetchClassrooms()
        } catch (error: any) {
            handleApiError(error, "Failed to disable classroom")
            throw error
        }
    }

    const handleBookClassroom = (classroom: Classroom) => {
        setPreselectedClassroom(classroom)
        setBookModalOpen(true)
    }

    const handleCreateBooking = async (data: {
        title: string
        description?: string
        classroomId: number
        bookingDate: string
        startTime: string
        endTime: string
        isRecurring: boolean
        recurrenceRule?: string
        recurrenceEnd?: string
    }) => {
        try {
            await bookingApi.create(data)
            setBookModalOpen(false)
            setPreselectedClassroom(null)
            toast.success("Classroom booked successfully")
            // Refresh bookings if viewing the same classroom/date
            if (String(data.classroomId) === selectedClassroomId) {
                fetchBookings()
            }
        } catch (error: any) {
            handleApiError(error, "Classroom already booked")
            throw error
        }
    }

    const handleCancelBooking = async (id: number) => {
        try {
            await bookingApi.cancel(id)
            toast.success("Booking cancelled successfully")
            fetchBookings()
        } catch (error: any) {
            handleApiError(error, "Failed to cancel booking")
            throw error
        }
    }

    // Filter out disabled classrooms for the booking selector
    const activeClassrooms = classrooms.filter(c => !c.isDisabled)

    return (
        <div className="space-y-6 p-6">
            {/* Header Section */}
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <FolderOpen className="w-8 h-8 text-primary" />
                        <h1 className="text-3xl font-bold tracking-tight">Classroom Management</h1>
                    </div>
                    <p className="text-muted-foreground">
                        {userRole === "ADMIN" && "Manage all classrooms and bookings across departments"}
                        {userRole === "MANAGER" && "Manage classrooms and bookings for your department"}
                        {userRole === "STAFF" && "View classrooms and create bookings"}
                    </p>
                </div>
                {canCreateClassroom && (
                    <Button onClick={() => setCreateModalOpen(true)} size="lg">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Classroom
                    </Button>
                )}
            </div>

            {/* Tabs Section */}
            <Tabs defaultValue="classrooms" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="classrooms">
                        <FolderOpen className="w-4 h-4 mr-2" />
                        Classrooms
                    </TabsTrigger>
                    <TabsTrigger value="bookings">
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        Bookings
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="classrooms" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>All Classrooms</CardTitle>
                            <CardDescription>
                                {userRole === "STAFF"
                                    ? "View available classrooms and create bookings"
                                    : "View and manage classroom resources"
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ClassroomTable
                                classrooms={classrooms}
                                isLoading={isLoading}
                                userRole={userRole}
                                onDisable={canDisableClassroom ? handleDisableClassroom : undefined}
                                onBook={handleBookClassroom}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="bookings" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Classroom Bookings</CardTitle>
                            <CardDescription>
                                Select a classroom and date to view bookings
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Classroom + Date Selector */}
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="flex-1">
                                    <Select
                                        value={selectedClassroomId}
                                        onValueChange={setSelectedClassroomId}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a classroom" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {activeClassrooms.map((c) => (
                                                <SelectItem key={c.id} value={String(c.id)}>
                                                    {c.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-[240px] justify-start text-left font-normal",
                                                !selectedDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {format(selectedDate, "PPP")}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={(d) => d && setSelectedDate(d)}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Bookings Table */}
                            {selectedClassroomId ? (
                                <BookingTable
                                    bookings={bookings}
                                    isLoading={isLoadingBookings}
                                    userRole={userRole}
                                    onCancel={handleCancelBooking}
                                />
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>Select a classroom above to view its bookings</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Modals */}
            {canCreateClassroom && (
                <CreateClassroomModal
                    open={createModalOpen}
                    onOpenChange={setCreateModalOpen}
                    onSubmit={handleCreateClassroom}
                />
            )}

            <BookClassroomModal
                open={bookModalOpen}
                onOpenChange={setBookModalOpen}
                classrooms={activeClassrooms}
                preselectedClassroom={preselectedClassroom}
                onSubmit={handleCreateBooking}
            />
        </div>
    )
}
