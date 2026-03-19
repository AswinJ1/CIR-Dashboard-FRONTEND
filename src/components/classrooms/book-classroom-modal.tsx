"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { Classroom } from "@/types/cir"

interface BookClassroomModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    classrooms: Classroom[]
    preselectedClassroom?: Classroom | null
    onSubmit: (data: {
        title: string
        description?: string
        classroomId: number
        bookingDate: string
        startTime: string
        endTime: string
        isRecurring: boolean
        recurrenceRule?: string
        recurrenceEnd?: string
    }) => Promise<void>
}

export default function BookClassroomModal({
    open,
    onOpenChange,
    classrooms,
    preselectedClassroom,
    onSubmit
}: BookClassroomModalProps) {
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [selectedClassroomId, setSelectedClassroomId] = useState<string>("")
    const [bookingDate, setBookingDate] = useState<Date>()
    const [startTime, setStartTime] = useState("")
    const [endTime, setEndTime] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isRecurring, setIsRecurring] = useState(false)
    const [recurrenceRule, setRecurrenceRule] = useState<string>("WEEKLY")
    const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date>()

    // Pre-fill classroom when opening with a preselected classroom
    useEffect(() => {
        if (open && preselectedClassroom) {
            setSelectedClassroomId(String(preselectedClassroom.id))
        }
    }, [open, preselectedClassroom])

    // Set default date when opening
    useEffect(() => {
        if (open && !bookingDate) {
            setBookingDate(new Date())
        }
    }, [open])

    const handleClose = () => {
        if (!isSubmitting) {
            resetForm()
            onOpenChange(false)
        }
    }

    const resetForm = () => {
        setTitle("")
        setDescription("")
        setSelectedClassroomId("")
        setBookingDate(undefined)
        setStartTime("")
        setEndTime("")
        setIsRecurring(false)
        setRecurrenceRule("WEEKLY")
        setRecurrenceEndDate(undefined)
        setErrors({})
    }

    const validateForm = () => {
        const newErrors: Record<string, string> = {}

        if (!title.trim()) newErrors.title = "Title is required"
        if (!selectedClassroomId) newErrors.classroom = "Please select a classroom"
        if (!bookingDate) newErrors.bookingDate = "Date is required"
        if (!startTime) newErrors.startTime = "Start time is required"
        if (!endTime) newErrors.endTime = "End time is required"
        if (startTime && endTime && startTime >= endTime) {
            newErrors.endTime = "End time must be after start time"
        }
        if (isRecurring) {
            if (!recurrenceEndDate) newErrors.recurrenceEnd = "Recurrence end date is required"
            if (recurrenceEndDate && bookingDate && recurrenceEndDate <= bookingDate) {
                newErrors.recurrenceEnd = "Recurrence end date must be after the booking date"
            }
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async () => {
        if (!validateForm()) return

        setIsSubmitting(true)
        try {
            const dateStr = format(bookingDate!, "yyyy-MM-dd")
            // Build ISO 8601 date-time strings by combining date + time
            const startISO = new Date(`${dateStr}T${startTime}:00`).toISOString()
            const endISO = new Date(`${dateStr}T${endTime}:00`).toISOString()

            await onSubmit({
                title: title.trim(),
                description: description.trim() || undefined,
                classroomId: Number(selectedClassroomId),
                bookingDate: dateStr,
                startTime: startISO,
                endTime: endISO,
                isRecurring,
                ...(isRecurring && {
                    recurrenceRule,
                    recurrenceEnd: format(recurrenceEndDate!, "yyyy-MM-dd"),
                }),
            })
            resetForm()
        } catch (error) {
            console.error("Error creating booking:", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    // Filter to only show active (non-disabled) classrooms
    const availableClassrooms = classrooms.filter(c => c.isActive !== false)

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Book Classroom</DialogTitle>
                    <DialogDescription>
                        Fill in the details to create a classroom booking.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="booking-title">
                            Title <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="booking-title"
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value)
                                if (errors.title) setErrors({ ...errors, title: "" })
                            }}
                            placeholder="e.g., Team Meeting, Lecture, Workshop"
                            disabled={isSubmitting}
                        />
                        {errors.title && (
                            <p className="text-sm text-destructive">{errors.title}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="booking-description">Description</Label>
                        <Textarea
                            id="booking-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional details about the booking"
                            rows={2}
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Classroom Selector */}
                    <div className="space-y-2">
                        <Label>
                            Classroom <span className="text-destructive">*</span>
                        </Label>
                        <Select
                            value={selectedClassroomId}
                            onValueChange={(val) => {
                                setSelectedClassroomId(val)
                                if (errors.classroom) setErrors({ ...errors, classroom: "" })
                            }}
                            disabled={isSubmitting}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a classroom" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableClassrooms.map((c) => (
                                    <SelectItem key={c.id} value={String(c.id)}>
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.classroom && (
                            <p className="text-sm text-destructive">{errors.classroom}</p>
                        )}
                    </div>

                    {/* Booking Date */}
                    <div className="space-y-2">
                        <Label>
                            Date <span className="text-destructive">*</span>
                        </Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !bookingDate && "text-muted-foreground"
                                    )}
                                    disabled={isSubmitting}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {bookingDate ? format(bookingDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={bookingDate}
                                    onSelect={(newDate) => {
                                        setBookingDate(newDate)
                                        if (errors.bookingDate) setErrors({ ...errors, bookingDate: "" })
                                    }}
                                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                        {errors.bookingDate && (
                            <p className="text-sm text-destructive">{errors.bookingDate}</p>
                        )}
                    </div>

                    {/* Time Slots */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startTime">
                                Start Time <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="startTime"
                                type="time"
                                value={startTime}
                                onChange={(e) => {
                                    setStartTime(e.target.value)
                                    if (errors.startTime) setErrors({ ...errors, startTime: "" })
                                }}
                                disabled={isSubmitting}
                            />
                            {errors.startTime && (
                                <p className="text-sm text-destructive">{errors.startTime}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="endTime">
                                End Time <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="endTime"
                                type="time"
                                value={endTime}
                                onChange={(e) => {
                                    setEndTime(e.target.value)
                                    if (errors.endTime) setErrors({ ...errors, endTime: "" })
                                }}
                                disabled={isSubmitting}
                            />
                            {errors.endTime && (
                                <p className="text-sm text-destructive">{errors.endTime}</p>
                            )}
                        </div>
                    </div>

                    {/* Recurrence Section */}
                    <div className="space-y-3 rounded-md border p-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="recurring"
                                checked={isRecurring}
                                onCheckedChange={(checked) => {
                                    setIsRecurring(checked === true)
                                    if (!checked) {
                                        setRecurrenceEndDate(undefined)
                                        setErrors((prev) => {
                                            const { recurrenceEnd, ...rest } = prev
                                            return rest
                                        })
                                    }
                                }}
                                disabled={isSubmitting}
                            />
                            <Label htmlFor="recurring" className="text-sm font-medium cursor-pointer">
                                Recurring Booking
                            </Label>
                        </div>

                        {isRecurring && (
                            <div className="space-y-3 pl-6">
                                {/* Recurrence Rule */}
                                <div className="space-y-2">
                                    <Label>Recurrence Rule</Label>
                                    <Select
                                        value={recurrenceRule}
                                        onValueChange={setRecurrenceRule}
                                        disabled={isSubmitting}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select recurrence" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="WEEKLY">Weekly</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Recurrence End Date */}
                                <div className="space-y-2">
                                    <Label>
                                        Recurrence End Date <span className="text-destructive">*</span>
                                    </Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !recurrenceEndDate && "text-muted-foreground"
                                                )}
                                                disabled={isSubmitting}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {recurrenceEndDate ? format(recurrenceEndDate, "PPP") : <span>Pick an end date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={recurrenceEndDate}
                                                onSelect={(newDate) => {
                                                    setRecurrenceEndDate(newDate)
                                                    if (errors.recurrenceEnd) setErrors({ ...errors, recurrenceEnd: "" })
                                                }}
                                                disabled={(date) => {
                                                    const minDate = bookingDate || new Date()
                                                    return date <= minDate
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    {errors.recurrenceEnd && (
                                        <p className="text-sm text-destructive">{errors.recurrenceEnd}</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Booking..." : "Confirm Booking"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
