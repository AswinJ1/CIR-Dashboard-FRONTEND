"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Plus, CalendarIcon } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { useAuth } from "@/components/providers/auth-context"
import { CreateResponsibilityDto } from "@/types/cir"

interface CreateResponsibilityDialogProps {
    onSuccess?: () => void
    triggerButton?: React.ReactNode
}

export function CreateResponsibilityDialog({ onSuccess, triggerButton }: CreateResponsibilityDialogProps) {
    const { user } = useAuth()
    const [open, setOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Form state
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [cycle, setCycle] = useState("")
    const [startDate, setStartDate] = useState<Date | undefined>(undefined)
    const [endDate, setEndDate] = useState<Date | undefined>(undefined)

    // Auto-generate cycle from current month
    useEffect(() => {
        const now = new Date()
        const currentCycle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        setCycle(currentCycle)
    }, [])

    const resetForm = () => {
        setTitle("")
        setDescription("")
        const now = new Date()
        setCycle(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
        setStartDate(undefined)
        setEndDate(undefined)
    }

    const handleSubmit = async () => {
        // Validation
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
        if (!user?.subDepartmentId) {
            toast.error("You must be assigned to a sub-department to create responsibilities")
            return
        }
        if (!user?.id) {
            toast.error("User authentication required")
            return
        }

        setIsSubmitting(true)
        try {
            const payload: CreateResponsibilityDto = {
                title: title.trim(),
                cycle: cycle.trim(),
                createdBy: { connect: { id: parseInt(user.id) } },
                subDepartment: { connect: { id: parseInt(user.subDepartmentId) } },
                description: description.trim() || undefined,
                startDate: startDate ? startDate.toISOString() : undefined,
                endDate: endDate ? endDate.toISOString() : undefined,
            }

            await api.responsibilities.create(payload)
            toast.success("Responsibility created successfully")
            resetForm()
            setOpen(false)
            onSuccess?.()
        } catch (error: any) {
            console.error("Failed to create responsibility:", error)
            toast.error(error.message || "Failed to create responsibility")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {triggerButton || (
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Create Responsibility
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Create New Responsibility</DialogTitle>
                    <DialogDescription>
                        Create a responsibility for your sub-department. Staff members will be assigned to this responsibility.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">
                            Responsibility Name <span className="text-foreground">*</span>
                        </Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Monthly Report Preparation"
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

                    {/* Start Date */}
                    <div className="space-y-2">
                        <Label>
                            Start Date <span className="text-foreground">*</span>
                        </Label>
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
                        <Label>
                            End Date <span className="text-foreground">*</span>
                        </Label>
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
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe what this responsibility entails..."
                            rows={3}
                        />
                    </div>

                    {/* Sub-Department Info */}
                    <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                            <strong>Sub-Department:</strong> This responsibility will be created for your sub-department and only visible to staff within it.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "Creating..." : "Create Responsibility"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
