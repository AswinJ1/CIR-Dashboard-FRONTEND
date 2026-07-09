"use client"

import { useState } from "react"
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
import { Plus, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface AddResponsibilityDialogProps {
    isToday: boolean
    onAdd: (title: string, description: string) => Promise<void>
}

export function AddResponsibilityDialog({ isToday, onAdd }: AddResponsibilityDialogProps) {
    const [open, setOpen] = useState(false)
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!title.trim()) {
            toast.error("Please enter a responsibility title")
            return
        }

        setIsSubmitting(true)
        try {
            await onAdd(title.trim(), description.trim())
            setTitle("")
            setDescription("")
            setOpen(false)
            toast.success("Responsibility added for today")
        } catch (error) {
            console.error("Failed to add responsibility:", error)
            toast.error("Failed to add responsibility")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isToday) {
        return null
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Responsibility
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Responsibility for Today</DialogTitle>
                    <DialogDescription>
                        Create a self-assigned responsibility for today's work. This will only apply to the current day.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Responsibility Title *</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Special project work, Training session..."
                        />
                    </div>

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

                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                        <AlertCircle className="h-5 w-5 text-foreground dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-700 dark:text-amber-300">
                            <p className="font-medium">Note:</p>
                            <p>Self-added responsibilities are for today only and will be included in your daily submission.</p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !title.trim()}>
                        {isSubmitting ? "Adding..." : "Add Responsibility"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
