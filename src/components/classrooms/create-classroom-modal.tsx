"use client"

import { useState } from "react"
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

interface CreateClassroomModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (data: { name: string }) => Promise<void>
}

export default function CreateClassroomModal({
    open,
    onOpenChange,
    onSubmit
}: CreateClassroomModalProps) {
    const [name, setName] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState("")

    const handleClose = () => {
        if (!isSubmitting) {
            resetForm()
            onOpenChange(false)
        }
    }

    const resetForm = () => {
        setName("")
        setError("")
    }

    const handleSubmit = async () => {
        if (!name.trim()) {
            setError("Classroom name is required")
            return
        }

        setIsSubmitting(true)
        try {
            await onSubmit({ name: name.trim() })
            resetForm()
        } catch (err) {
            console.error("Error creating classroom:", err)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle>Create Classroom</DialogTitle>
                    <DialogDescription>
                        Add a new classroom to the system.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">
                            Classroom Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value)
                                if (error) setError("")
                            }}
                            placeholder="e.g., Room A-101, Lab B-203"
                            disabled={isSubmitting}
                        />
                        {error && (
                            <p className="text-sm text-destructive">{error}</p>
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
                        disabled={isSubmitting || !name.trim()}
                    >
                        {isSubmitting ? "Creating..." : "Create Classroom"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
