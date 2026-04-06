"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useAuth } from "@/components/providers/auth-context"
import { api } from "@/lib/api"
import { Assignment, WorkSubmission } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { format, startOfToday } from "date-fns"
import {
    Calendar,
    Clock,
    CheckCircle,
    AlertCircle,
    Send,
    RefreshCw,
    FileText,
    Lock,
    Plus,
    Trash2,
    AlertTriangle,
    RotateCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import DashboardHeader from "@/components/dashboard-header"
import {
    getSubmissionsForDate,
    getDayStatus,
    getActiveUnsubmittedAssignments,
    getSubmittedAssignmentsForDate,
    isToday,
    isPastDate,
    createEmptyInlineForm,
    InlineResponsibilityFormData,
} from "@/lib/responsibility-status"



interface AssignmentFormData {
    assignmentId: string | number
    hoursWorked: string
    workDescription: string
    workProofType: "NONE" | "TEXT" | "PDF" | "IMAGE"
    workProofText: string
    workProofUrl: string
}

export default function ManagerWorkCalendarPage() {
    const { user } = useAuth()
    const [isLoading, setIsLoading] = useState(true)
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [allSubmissions, setAllSubmissions] = useState<WorkSubmission[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)

    // selectedDate is now effectively always today for this view
    const selectedDate = useMemo(() => new Date(), [])

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)

    // Form data for existing assignments - PERSISTED across modal open/close
    const [assignmentForms, setAssignmentForms] = useState<Map<string, AssignmentFormData>>(new Map())

    // New responsibilities (not yet submitted) - PERSISTED across modal open/close
    const [newResponsibilities, setNewResponsibilities] = useState<InlineResponsibilityFormData[]>([])

    // Track if today's work was submitted successfully
    const [todaySubmitted, setTodaySubmitted] = useState(false)

    const today = useMemo(() => startOfToday(), [])

    useEffect(() => {
        if (user?.id) {
            fetchData()
        }
    }, [user?.id])

    async function fetchData() {
        if (!user?.id) return
        setIsLoading(true)
        try {
            const [assignmentsData, submissionsData] = await Promise.all([
                api.assignments.getAll({ staffId: String(user.id) }),
                api.workSubmissions.getAll({ staffId: String(user.id) }),
            ])
            setAssignments(assignmentsData)
            setAllSubmissions(submissionsData)

            // Check if today's work was already submitted
            const todaySubmissions = getSubmissionsForDate(submissionsData, new Date())
            if (todaySubmissions.length > 0) {
                setTodaySubmitted(true)
            }
        } catch (error) {
            console.error("Failed to fetch data:", error)
            toast.error("Failed to load data")
        } finally {
            setIsLoading(false)
        }
    }
    // Get today's unsubmitted assignments
    const todayUnsubmittedAssignments = useMemo(() => {
        return getActiveUnsubmittedAssignments(assignments, today, allSubmissions)
    }, [assignments, today, allSubmissions])

    // Get today's submitted assignments
    const todaySubmittedAssignments = useMemo(() => {
        return getSubmittedAssignmentsForDate(assignments, today, allSubmissions)
    }, [assignments, today, allSubmissions])

    const isSelectedDateToday = true
    const isSelectedDateLocked = false

    // Initialize form data for an assignment
    const getFormData = useCallback((assignmentId: string | number): AssignmentFormData => {
        const key = String(assignmentId)
        if (assignmentForms.has(key)) {
            return assignmentForms.get(key)!
        }
        return {
            assignmentId,
            hoursWorked: '',
            workDescription: '',
            workProofType: 'NONE',
            workProofText: '',
            workProofUrl: '',
        }
    }, [assignmentForms])

    // Update form data for an assignment
    const updateFormData = useCallback((assignmentId: string | number, updates: Partial<AssignmentFormData>) => {
        const key = String(assignmentId)
        setAssignmentForms(prev => {
            const newMap = new Map(prev)
            const existing = prev.get(key) || {
                assignmentId,
                hoursWorked: '',
                workDescription: '',
                workProofType: 'NONE' as const,
                workProofText: '',
                workProofUrl: '',
            }
            newMap.set(key, { ...existing, ...updates })
            return newMap
        })
    }, [])

    // Add new responsibility (no API call - just adds form section)
    const handleAddResponsibility = useCallback(() => {
        setNewResponsibilities(prev => [...prev, createEmptyInlineForm()])
    }, [])

    // Remove new responsibility
    const handleRemoveNewResponsibility = useCallback((id: string) => {
        setNewResponsibilities(prev => prev.filter(r => r.id !== id))
    }, [])

    // Update new responsibility form data
    const updateNewResponsibility = useCallback((id: string, updates: Partial<InlineResponsibilityFormData>) => {
        setNewResponsibilities(prev =>
            prev.map(r => r.id === id ? { ...r, ...updates } : r)
        )
    }, [])

    // Submit all work for today
    async function handleSubmitTodaysWork() {
        if (!user?.id) {
            toast.error("User information is missing. Please log in again.")
            return
        }

        // Client-side validation
        const validationErrors: string[] = []

        for (const assignment of todayUnsubmittedAssignments) {
            const formData = getFormData(assignment.id)
            const hours = parseFloat(formData.hoursWorked)
            const title = assignment.responsibility?.title || 'Untitled'

            if (!isNaN(hours) && hours > 0) {
                if (hours > 24) {
                    validationErrors.push(`${title}: Hours cannot exceed 24`)
                }
                // Validate proof content when proof type is selected
                if (formData.workProofType === 'TEXT' && !formData.workProofText.trim()) {
                    validationErrors.push(`${title}: Proof text is required when proof type is Text`)
                }
                if ((formData.workProofType === 'PDF' || formData.workProofType === 'IMAGE') && !formData.workProofUrl.trim()) {
                    validationErrors.push(`${title}: ${formData.workProofType} URL is required when proof type is ${formData.workProofType}`)
                }
            }
        }

        for (const newResp of newResponsibilities) {
            const hours = parseFloat(newResp.hoursWorked)
            if (newResp.title.trim()) {
                if (isNaN(hours) || hours <= 0) {
                    validationErrors.push(`${newResp.title}: Hours worked is required`)
                } else if (hours > 24) {
                    validationErrors.push(`${newResp.title}: Hours cannot exceed 24`)
                }
                if (newResp.workProofType === 'TEXT' && !newResp.workProofText.trim()) {
                    validationErrors.push(`${newResp.title}: Proof text is required when proof type is Text`)
                }
                if ((newResp.workProofType === 'PDF' || newResp.workProofType === 'IMAGE') && !newResp.workProofUrl.trim()) {
                    validationErrors.push(`${newResp.title}: ${newResp.workProofType} URL is required when proof type is ${newResp.workProofType}`)
                }
            }
        }

        if (validationErrors.length > 0) {
            toast.error(validationErrors[0])
            return
        }

        setIsSubmitting(true)
        const errors: string[] = []
        let successCount = 0

        try {
            // 1. Submit work for existing assignments
            for (const assignment of todayUnsubmittedAssignments) {
                const formData = getFormData(assignment.id)
                const hours = parseFloat(formData.hoursWorked)

                if (!isNaN(hours) && hours > 0) {
                    if (hours > 24) {
                        errors.push(`${assignment.responsibility?.title}: Hours cannot exceed 24`)
                        continue
                    }

                    try {
                        const assignmentId = typeof assignment.id === 'string'
                            ? parseInt(assignment.id)
                            : assignment.id as number

                        const payload: any = {
                            assignment: { connect: { id: assignmentId } },
                            staff: { connect: { id: parseInt(user.id) } },
                            hoursWorked: hours,
                            staffComment: formData.workDescription || undefined,
                        }

                        // Only include proof fields when a real proof type is selected with content
                        if (formData.workProofType !== 'NONE') {
                            payload.workProofType = formData.workProofType
                            if (formData.workProofType === 'TEXT' && formData.workProofText.trim()) {
                                payload.workProofText = formData.workProofText.trim()
                            } else if (formData.workProofType !== 'TEXT' && formData.workProofUrl.trim()) {
                                payload.workProofUrl = formData.workProofUrl.trim()
                            }
                        }

                        await api.workSubmissions.create(payload)
                        successCount++
                    } catch (error: any) {
                        errors.push(`${assignment.responsibility?.title}: ${error.message || 'Failed to submit'}`)
                    }
                }
            }

            // 2. Create new responsibilities and submit work for them
            for (const newResp of newResponsibilities) {
                if (!newResp.title.trim()) {
                    errors.push('New responsibility: Title is required')
                    continue
                }

                const hours = parseFloat(newResp.hoursWorked)
                if (isNaN(hours) || hours <= 0) {
                    errors.push(`${newResp.title}: Valid hours are required`)
                    continue
                }

                if (hours > 24) {
                    errors.push(`${newResp.title}: Hours cannot exceed 24`)
                    continue
                }

                if (!user.subDepartmentId) {
                    errors.push(`${newResp.title}: User sub-department is missing`)
                    continue
                }

                try {
                    // Get current cycle
                    const now = new Date()
                    const cycle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

                    // Create responsibility (auto-assigns to staff)
                    const result: any = await api.responsibilities.create({
                        title: newResp.title.trim(),
                        description: newResp.description.trim() || undefined,
                        cycle,
                        createdBy: { connect: { id: parseInt(user.id) } },
                        subDepartment: { connect: { id: parseInt(user.subDepartmentId) } },
                        isStaffCreated: true,
                    })

                    // Submit work for the new responsibility
                    if (result.assignments && result.assignments.length > 0) {
                        const assignmentId = typeof result.assignments[0].id === 'string'
                            ? parseInt(result.assignments[0].id)
                            : result.assignments[0].id

                        const newPayload: any = {
                            assignment: { connect: { id: assignmentId } },
                            staff: { connect: { id: parseInt(user.id) } },
                            hoursWorked: hours,
                            staffComment: newResp.workDescription || undefined,
                        }

                        // Only include proof fields when a real proof type is selected with content
                        if (newResp.workProofType !== 'NONE') {
                            newPayload.workProofType = newResp.workProofType
                            if (newResp.workProofType === 'TEXT' && newResp.workProofText.trim()) {
                                newPayload.workProofText = newResp.workProofText.trim()
                            } else if (newResp.workProofType !== 'TEXT' && newResp.workProofUrl.trim()) {
                                newPayload.workProofUrl = newResp.workProofUrl.trim()
                            }
                        }

                        await api.workSubmissions.create(newPayload)
                        successCount++
                    }
                } catch (error: any) {
                    errors.push(`${newResp.title}: ${error.message || 'Failed to create/submit'}`)
                }
            }

            // Show results
            if (successCount > 0) {
                toast.success("Today's work submitted successfully!")
                setTodaySubmitted(true)
                // Clear form data after successful submission
                setAssignmentForms(new Map())
                setNewResponsibilities([])
                setIsModalOpen(false)
            }

            if (errors.length > 0) {
                toast.error(`${errors.length} error${errors.length > 1 ? 's' : ''}: ${errors[0]}`)
            }

            // Refresh data
            await fetchData()
        } catch (error: any) {
            console.error("Failed to submit work:", error)
            toast.error(error.message || "Failed to submit work")
        } finally {
            setIsSubmitting(false)
        }
    }



    // Check if there's any work to submit
    const hasWorkToSubmit = useMemo(() => {
        // Check existing assignments
        for (const assignment of todayUnsubmittedAssignments) {
            const formData = getFormData(assignment.id)
            const hours = parseFloat(formData.hoursWorked)
            if (!isNaN(hours) && hours > 0) return true
        }

        // Check new responsibilities
        for (const newResp of newResponsibilities) {
            const hours = parseFloat(newResp.hoursWorked)
            if (newResp.title.trim() && !isNaN(hours) && hours > 0) return true
        }

        return false
    }, [todayUnsubmittedAssignments, getFormData, newResponsibilities])

    // Check if today already has submissions
    const hasTodaySubmissions = useMemo(() => {
        return todaySubmittedAssignments.length > 0
    }, [todaySubmittedAssignments])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-foreground border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* <DashboardHeader/> */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Submit Work </h1>
                    <p className="text-muted-foreground">
                        Submit daily work and track your responsibilities
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} className="border-foreground/20">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>


            <div className="space-y-6">
                {/* Right Side - Date Info & Action */}
                <div className="space-y-4">
                    {/* Date Header */}
                    <Card className="border-foreground/10">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Calendar className="h-5 w-5" />
                                        {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                                        {isSelectedDateToday && (
                                            <Badge variant="secondary" className="bg-foreground/10 text-foreground">Today</Badge>
                                        )}
                                    </CardTitle>
                                    <CardDescription className="flex items-center gap-2 mt-1">
                                        {isSelectedDateLocked ? (
                                            <>
                                                <Lock className="h-4 w-4" />
                                                This date is locked - view only
                                            </>
                                        ) : isSelectedDateToday ? (
                                            <>
                                                <Clock className="h-4 w-4" />
                                                Submit work for today's responsibilities
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle className="h-4 w-4" />
                                                Future date - cannot submit yet
                                            </>
                                        )}
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>

                    {/* TODAY'S VIEW */}
                    {isSelectedDateToday && (
                        <>
                            {/* Success Message if submitted */}
                            {/* {(hasTodaySubmissions || todaySubmitted) && (
                                <Card className="border-foreground/20 bg-foreground/5">
                                    <CardContent className="py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-full bg-foreground/10 flex items-center justify-center">
                                                <CheckCircle className="h-6 w-6 text-foreground" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-lg">
                                                    Today's work submitted successfully
                                                </h3>
                                                <p className="text-muted-foreground text-sm">
                                                    {todaySubmittedAssignments.length} submission{todaySubmittedAssignments.length !== 1 ? 's' : ''} recorded for today
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )} */}

                            {/* Pending Assignments Count */}
                            {todayUnsubmittedAssignments.length > 0 && (
                                <Card className="border-foreground/10">
                                    <CardContent className="py-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-full bg-foreground/5 flex items-center justify-center">
                                                    <FileText className="h-6 w-6 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-lg">
                                                        {todayUnsubmittedAssignments.length} Pending Responsibilit{todayUnsubmittedAssignments.length !== 1 ? 'ies' : 'y'}
                                                    </h3>
                                                    <p className="text-muted-foreground text-sm">
                                                        Ready for submission
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Submit Today's Work Button */}
                            <Card className="border-2 border-foreground/20">
                                <CardContent className="py-8">
                                    <div className="text-center space-y-4">
                                        <div className="h-16 w-16 rounded-full bg-foreground/5 flex items-center justify-center mx-auto">
                                            <Send className="h-8 w-8 text-foreground" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-xl">Submit Today's Work</h3>
                                            <p className="text-muted-foreground">
                                                Record your work hours and add new responsibilities
                                            </p>
                                        </div>
                                        <Button
                                            size="lg"
                                            onClick={() => setIsModalOpen(true)}
                                            className="bg-foreground text-background hover:bg-foreground/90"
                                        >
                                            <Send className="h-4 w-4 mr-2" />
                                            Submit Today's Work
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>



                            {/* Already Submitted Today - Summary */}
                            {/* {todaySubmittedAssignments.length > 0 && (
                                <Card className="border-foreground/10">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4" />
                                            Submitted Today ({todaySubmittedAssignments.length})
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {todaySubmittedAssignments.map(assignment => {
                                            const status = assignment.submissionForDate?.status || 
                                                           assignment.submissionForDate?.assignment?.status || 
                                                           'SUBMITTED'
                                            return (
                                                <div 
                                                    key={assignment.id} 
                                                    className="flex items-center justify-between p-3 border border-foreground/10 rounded-lg"
                                                >
                                                    <div>
                                                        <p className="font-medium text-sm">
                                                            {assignment.responsibility?.title || 'Untitled'}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {(assignment.submissionForDate as any)?.hoursWorked || 0}h
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline" className={cn(
                                                        "border-foreground/20",
                                                        status === 'VERIFIED' && "border-green-500/50 text-green-600 dark:text-green-400",
                                                        status === 'REJECTED' && "border-red-500/50 text-red-600 dark:text-red-400"
                                                    )}>
                                                        {status}
                                                    </Badge>
                                                </div>
                                            )
                                        })}
                                    </CardContent>
                                </Card>
                            )} */}
                        </>
                    )}



                </div>
            </div>

            {/* Submit Work Modal - Black & White Styling */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background border-foreground/20">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Submit Today's Work</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Record your work hours for today. Add new responsibilities if needed.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Existing Assignments */}
                        {todayUnsubmittedAssignments.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="font-medium text-sm text-foreground border-b border-foreground/10 pb-2">
                                    Assigned Responsibilities ({todayUnsubmittedAssignments.length})
                                </h3>
                                {todayUnsubmittedAssignments.map(assignment => {
                                    const formData = getFormData(assignment.id)
                                    return (
                                        <div key={assignment.id} className="border border-foreground/20 rounded-lg p-4 space-y-3">
                                            <div>
                                                <h4 className="font-medium text-foreground">
                                                    {assignment.responsibility?.title || 'Untitled Responsibility'}
                                                </h4>
                                                {assignment.responsibility?.description && (
                                                    <p className="text-sm text-muted-foreground">
                                                        {assignment.responsibility.description}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-foreground">Hours Worked <span className="text-red-500">*</span></Label>
                                                    <Input
                                                        type="number"
                                                        min="0.5"
                                                        max="24"
                                                        step="0.5"
                                                        placeholder="e.g., 2.5"
                                                        value={formData.hoursWorked}
                                                        onChange={(e) => updateFormData(assignment.id, { hoursWorked: e.target.value })}
                                                        className="h-9 border-foreground/20 bg-background"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-foreground">Proof Type</Label>
                                                    <Select
                                                        value={formData.workProofType}
                                                        onValueChange={(v: "NONE" | "TEXT" | "PDF" | "IMAGE") =>
                                                            updateFormData(assignment.id, { workProofType: v, workProofText: '', workProofUrl: '' })
                                                        }
                                                    >
                                                        <SelectTrigger className="h-9 border-foreground/20 bg-background">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-background border-foreground/20">
                                                            <SelectItem value="NONE">None</SelectItem>
                                                            <SelectItem value="TEXT">Text</SelectItem>
                                                            <SelectItem value="PDF">PDF URL</SelectItem>
                                                            <SelectItem value="IMAGE">Image URL</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <Label className="text-xs text-foreground">Work Description</Label>
                                                <Textarea
                                                    placeholder="What did you accomplish?"
                                                    value={formData.workDescription}
                                                    onChange={(e) => updateFormData(assignment.id, { workDescription: e.target.value })}
                                                    rows={2}
                                                    className="resize-none border-foreground/20 bg-background"
                                                />
                                            </div>

                                            {formData.workProofType === 'TEXT' && (
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-foreground">Proof Details</Label>
                                                    <Textarea
                                                        placeholder="Provide proof of your work..."
                                                        value={formData.workProofText}
                                                        onChange={(e) => updateFormData(assignment.id, { workProofText: e.target.value })}
                                                        rows={2}
                                                        className="resize-none border-foreground/20 bg-background"
                                                    />
                                                </div>
                                            )}
                                            {(formData.workProofType === 'PDF' || formData.workProofType === 'IMAGE') && (
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-foreground">{formData.workProofType} URL</Label>
                                                    <Input
                                                        type="url"
                                                        placeholder="https://..."
                                                        value={formData.workProofUrl}
                                                        onChange={(e) => updateFormData(assignment.id, { workProofUrl: e.target.value })}
                                                        className="h-9 border-foreground/20 bg-background"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* New Responsibilities */}
                        {newResponsibilities.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="font-medium text-sm text-foreground border-b border-foreground/10 pb-2">
                                    New Responsibilities ({newResponsibilities.length})
                                </h3>
                                {newResponsibilities.map(newResp => (
                                    <div key={newResp.id} className="border border-foreground/20 rounded-lg p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 space-y-1">
                                                <Label className="text-xs text-foreground">Title *</Label>
                                                <Input
                                                    placeholder="e.g., Weekly Report Compilation"
                                                    value={newResp.title}
                                                    onChange={(e) => updateNewResponsibility(newResp.id, { title: e.target.value })}
                                                    className="h-9 border-foreground/20 bg-background"
                                                />
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="mt-5 text-muted-foreground hover:text-foreground"
                                                onClick={() => handleRemoveNewResponsibility(newResp.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs text-foreground">Description </Label>
                                            <Textarea
                                                placeholder="Describe the responsibility..."
                                                value={newResp.description}
                                                onChange={(e) => updateNewResponsibility(newResp.id, { description: e.target.value })}
                                                rows={2}
                                                className="resize-none border-foreground/20 bg-background"
                                            />
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="space-y-1">
                                                <Label className="text-xs text-foreground">Hours Worked <span className="text-red-500">*</span></Label>
                                                <Input
                                                    type="number"
                                                    min="0.5"
                                                    max="24"
                                                    step="0.5"
                                                    placeholder="e.g., 2.5"
                                                    value={newResp.hoursWorked}
                                                    onChange={(e) => updateNewResponsibility(newResp.id, { hoursWorked: e.target.value })}
                                                    className="h-9 border-foreground/20 bg-background"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-foreground">Proof Type </Label>
                                                <Select
                                                    value={newResp.workProofType}
                                                    onValueChange={(v: "NONE" | "TEXT" | "PDF" | "IMAGE") =>
                                                        updateNewResponsibility(newResp.id, { workProofType: v, workProofText: '', workProofUrl: '' })
                                                    }
                                                >
                                                    <SelectTrigger className="h-9 border-foreground/20 bg-background">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-background border-foreground/20">
                                                        <SelectItem value="NONE">None</SelectItem>
                                                        <SelectItem value="TEXT">Text</SelectItem>
                                                        <SelectItem value="PDF">PDF URL</SelectItem>
                                                        <SelectItem value="IMAGE">Image URL</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs text-foreground">Work Description</Label>
                                            <Textarea
                                                placeholder="What did you accomplish?"
                                                value={newResp.workDescription}
                                                onChange={(e) => updateNewResponsibility(newResp.id, { workDescription: e.target.value })}
                                                rows={2}
                                                className="resize-none border-foreground/20 bg-background"
                                            />
                                        </div>

                                        {newResp.workProofType === 'TEXT' && (
                                            <div className="space-y-1">
                                                <Label className="text-xs text-foreground">Proof Details</Label>
                                                <Textarea
                                                    placeholder="Provide proof of your work..."
                                                    value={newResp.workProofText}
                                                    onChange={(e) => updateNewResponsibility(newResp.id, { workProofText: e.target.value })}
                                                    rows={2}
                                                    className="resize-none border-foreground/20 bg-background"
                                                />
                                            </div>
                                        )}
                                        {(newResp.workProofType === 'PDF' || newResp.workProofType === 'IMAGE') && (
                                            <div className="space-y-1">
                                                <Label className="text-xs text-foreground">{newResp.workProofType} URL</Label>
                                                <Input
                                                    type="url"
                                                    placeholder="https://..."
                                                    value={newResp.workProofUrl}
                                                    onChange={(e) => updateNewResponsibility(newResp.id, { workProofUrl: e.target.value })}
                                                    className="h-9 border-foreground/20 bg-background"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Empty State */}
                        {todayUnsubmittedAssignments.length === 0 && newResponsibilities.length === 0 && (
                            <div className="py-8 text-center border border-dashed border-foreground/20 rounded-lg">
                                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                                <p className="text-muted-foreground mb-4">
                                    No responsibilities to submit. Add a new one to get started.
                                </p>
                            </div>
                        )}

                        {/* Add Responsibility Button */}
                        <Button
                            variant="outline"
                            className="w-full border-foreground/20 text-foreground hover:bg-foreground/5"
                            onClick={handleAddResponsibility}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Responsibility
                        </Button>
                    </div>

                    <DialogFooter className="border-t border-foreground/10 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => setIsModalOpen(false)}
                            className="border-foreground/20"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmitTodaysWork}
                            disabled={isSubmitting || !hasWorkToSubmit}
                            className="bg-foreground text-background hover:bg-foreground/90"
                        >
                            {isSubmitting ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4 mr-2" />
                                    Submit
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}