"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useAuth } from "@/components/providers/auth-context"
import { api } from "@/lib/api"
import { Assignment, WorkSubmission, ResponsibilityGroup } from "@/types/cir"
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
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { toast } from "sonner"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday as isDateToday, startOfToday } from "date-fns"
import {
    Calendar,
    Clock,
    CheckCircle,
    AlertCircle,
    Send,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    FileText,
    Lock,
    Plus,
    Trash2,
    FolderOpen,
    ChevronDown,
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

interface DayData {
    date: Date
    submissions: WorkSubmission[]
    totalHours: number
    hasVerified: boolean
    hasSubmitted: boolean
    hasRejected: boolean
    hasPending: boolean
}

interface AssignmentFormData {
    assignmentId: string | number
    hoursWorked: string
    workDescription: string
    workProofType: "TEXT" | "PDF" | "IMAGE"
    workProofText: string
    workProofUrl: string
}

// Group assignments by their responsibility group
interface GroupedAssignment {
    groupId: string | null
    groupName: string
    assignments: Assignment[]
    isExpanded?: boolean
}

export default function StaffWorkCalendarPage() {
    const { user } = useAuth()
    const [isLoading, setIsLoading] = useState(true)
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [allSubmissions, setAllSubmissions] = useState<WorkSubmission[]>([])
    const [responsibilityGroups, setResponsibilityGroups] = useState<ResponsibilityGroup[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    
    // Form data for existing assignments - PERSISTED across modal open/close
    const [assignmentForms, setAssignmentForms] = useState<Map<string, AssignmentFormData>>(new Map())
    
    // New responsibilities (not yet submitted) - PERSISTED across modal open/close
    const [newResponsibilities, setNewResponsibilities] = useState<InlineResponsibilityFormData[]>([])
    
    // Track if today's work was submitted successfully
    const [todaySubmitted, setTodaySubmitted] = useState(false)
    
    // Track expanded groups in the modal
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    // Resubmit modal state
    const [isResubmitModalOpen, setIsResubmitModalOpen] = useState(false)
    const [resubmitSubmission, setResubmitSubmission] = useState<WorkSubmission | null>(null)
    const [resubmitForm, setResubmitForm] = useState({
        hoursWorked: '',
        staffComment: '',
        workProofType: 'TEXT' as 'TEXT' | 'PDF' | 'IMAGE',
        workProofText: '',
        workProofUrl: '',
    })

    const today = useMemo(() => startOfToday(), [])

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setIsLoading(true)
        try {
            const [assignmentsData, submissionsData, groupsData] = await Promise.all([
                api.assignments.getAll(),
                api.workSubmissions.getAll(),
                api.responsibilityGroups.getAll().catch(() => []), // Handle if groups API not available
            ])
            setAssignments(assignmentsData)
            setAllSubmissions(submissionsData)
            setResponsibilityGroups(groupsData)
            
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

    // Generate calendar days for current month
    const calendarDays = useMemo(() => {
        const start = startOfMonth(currentMonth)
        const end = endOfMonth(currentMonth)
        return eachDayOfInterval({ start, end })
    }, [currentMonth])

    // Map submissions by date for calendar display
    const dayDataMap = useMemo(() => {
        const map = new Map<string, DayData>()

        calendarDays.forEach(date => {
            const dateStr = format(date, 'yyyy-MM-dd')
            const daySubmissions = getSubmissionsForDate(allSubmissions, date)

            const totalHours = daySubmissions.reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)
            const dayStatus = getDayStatus(daySubmissions)

            map.set(dateStr, {
                date,
                submissions: daySubmissions,
                totalHours,
                hasVerified: dayStatus === 'VERIFIED',
                hasSubmitted: dayStatus === 'SUBMITTED',
                hasRejected: dayStatus === 'REJECTED',
                hasPending: daySubmissions.some(s => s.status === 'PENDING' || s.assignment?.status === 'PENDING'),
            })
        })

        return map
    }, [calendarDays, allSubmissions])

    // Get today's unsubmitted assignments
    const todayUnsubmittedAssignments = useMemo(() => {
        return getActiveUnsubmittedAssignments(assignments, today, allSubmissions)
    }, [assignments, today, allSubmissions])

    // Get today's submitted assignments
    const todaySubmittedAssignments = useMemo(() => {
        return getSubmittedAssignmentsForDate(assignments, today, allSubmissions)
    }, [assignments, today, allSubmissions])

    // Group unsubmitted assignments by responsibility groups
    const groupedUnsubmittedAssignments = useMemo(() => {
        const grouped: GroupedAssignment[] = []
        const assignedToGroup = new Set<string>()

        // First, find assignments that belong to groups
        for (const group of responsibilityGroups) {
            if (!group.items) continue
            
            const groupAssignments: Assignment[] = []
            for (const item of group.items) {
                const assignment = todayUnsubmittedAssignments.find(
                    a => a.responsibilityId === item.responsibilityId || 
                         a.responsibility?.id === item.responsibilityId
                )
                if (assignment) {
                    groupAssignments.push(assignment)
                    assignedToGroup.add(String(assignment.id))
                }
            }
            
            if (groupAssignments.length > 0) {
                grouped.push({
                    groupId: group.id,
                    groupName: group.name,
                    assignments: groupAssignments,
                })
            }
        }

        // Then, collect ungrouped assignments
        const ungroupedAssignments = todayUnsubmittedAssignments.filter(
            a => !assignedToGroup.has(String(a.id))
        )
        
        if (ungroupedAssignments.length > 0) {
            grouped.push({
                groupId: null,
                groupName: "Individual Responsibilities",
                assignments: ungroupedAssignments,
            })
        }

        return grouped
    }, [todayUnsubmittedAssignments, responsibilityGroups])

    // Toggle group expansion
    const toggleGroupExpansion = useCallback((groupId: string) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev)
            if (newSet.has(groupId)) {
                newSet.delete(groupId)
            } else {
                newSet.add(groupId)
            }
            return newSet
        })
    }, [])

    // Get previous day's submitted assignments (for view only)
    const previousDaySubmissions = useMemo(() => {
        if (isToday(selectedDate)) return []
        if (!isPastDate(selectedDate)) return []
        return getSubmissionsForDate(allSubmissions, selectedDate)
    }, [selectedDate, allSubmissions])

    const isSelectedDateToday = useMemo(() => isToday(selectedDate), [selectedDate])
    const isSelectedDateLocked = useMemo(() => isPastDate(selectedDate), [selectedDate])

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
            workProofType: 'TEXT',
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
                workProofType: 'TEXT' as const,
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

                        await api.workSubmissions.create({
                            assignment: { connect: { id: assignmentId } },
                            staff: { connect: { id: parseInt(user.id) } },
                            hoursWorked: hours,
                            staffComment: formData.workDescription || undefined,
                            workProofType: formData.workProofType,
                            workProofText: formData.workProofType === 'TEXT' ? formData.workProofText : undefined,
                            workProofUrl: formData.workProofType !== 'TEXT' ? formData.workProofUrl : undefined,
                        })
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

                        await api.workSubmissions.create({
                            assignment: { connect: { id: assignmentId } },
                            staff: { connect: { id: parseInt(user.id) } },
                            hoursWorked: hours,
                            staffComment: newResp.workDescription || undefined,
                            workProofType: newResp.workProofType,
                            workProofText: newResp.workProofType === 'TEXT' ? newResp.workProofText : undefined,
                            workProofUrl: newResp.workProofType !== 'TEXT' ? newResp.workProofUrl : undefined,
                        })
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

    function getDayStatusColor(dateStr: string) {
        const dayData = dayDataMap.get(dateStr)
        if (!dayData || dayData.submissions.length === 0) return ""

        if (dayData.hasRejected && !dayData.hasVerified && !dayData.hasSubmitted) {
            return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
        }
        if (dayData.hasVerified && !dayData.hasSubmitted && !dayData.hasRejected) {
            return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
        }
        if (dayData.hasSubmitted) {
            return "bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
        }
        return "bg-neutral-100 dark:bg-neutral-800"
    }

    // Open resubmit modal for a rejected submission
    function openResubmitModal(submission: WorkSubmission) {
        setResubmitSubmission(submission)
        setResubmitForm({
            hoursWorked: String((submission as any).hoursWorked || 0),
            staffComment: '',
            workProofType: (submission as any).workProofType || 'TEXT',
            workProofText: (submission as any).workProofText || '',
            workProofUrl: (submission as any).workProofUrl || '',
        })
        setIsResubmitModalOpen(true)
    }

    // Handle resubmit form submission
    async function handleResubmit() {
        if (!resubmitSubmission) return

        setIsSubmitting(true)
        try {
            const hours = parseFloat(resubmitForm.hoursWorked)
            if (isNaN(hours) || hours <= 0) {
                toast.error("Please enter valid hours worked")
                return
            }

            await api.workSubmissions.resubmit(String(resubmitSubmission.id), {
                hoursWorked: hours,
                staffComment: resubmitForm.staffComment || undefined,
                workProofType: resubmitForm.workProofType as 'PDF' | 'IMAGE' | 'TEXT',
                workProofText: resubmitForm.workProofType === 'TEXT' ? resubmitForm.workProofText : undefined,
                workProofUrl: resubmitForm.workProofType !== 'TEXT' ? resubmitForm.workProofUrl : undefined,
            })

            toast.success("Work resubmitted successfully!")
            setIsResubmitModalOpen(false)
            setResubmitSubmission(null)
            await fetchData()
        } catch (error: any) {
            console.error("Failed to resubmit work:", error)
            toast.error(error.message || "Failed to resubmit work")
        } finally {
            setIsSubmitting(false)
        }
    }

    function navigateMonth(direction: 'prev' | 'next') {
        const newMonth = new Date(currentMonth)
        if (direction === 'prev') {
            newMonth.setMonth(newMonth.getMonth() - 1)
        } else {
            newMonth.setMonth(newMonth.getMonth() + 1)
        }
        setCurrentMonth(newMonth)
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
            <DashboardHeader/>
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Work Calendar</h1>
                    <p className="text-muted-foreground">
                        View your assignments and submit daily work
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} className="border-foreground/20">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Calendar - Left Side */}
                <Card className="lg:col-span-1 border-foreground/10">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => navigateMonth('prev')}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => navigateMonth('next')}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-7 gap-1 text-center text-sm">
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                <div key={day} className="p-2 font-medium text-muted-foreground">
                                    {day}
                                </div>
                            ))}
                            {Array.from({ length: calendarDays[0]?.getDay() || 0 }).map((_, i) => (
                                <div key={`empty-${i}`} className="p-2" />
                            ))}
                            {calendarDays.map(date => {
                                const dateStr = format(date, 'yyyy-MM-dd')
                                const isSelected = isSameDay(date, selectedDate)
                                const isTodayDate = isDateToday(date)
                                const statusColor = getDayStatusColor(dateStr)
                                const dayData = dayDataMap.get(dateStr)

                                return (
                                    <button
                                        key={dateStr}
                                        onClick={() => setSelectedDate(date)}
                                        className={cn(
                                            "p-2 rounded-lg transition-all hover:bg-foreground/10 relative",
                                            isSelected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                                            isTodayDate && "font-bold",
                                            statusColor
                                        )}
                                    >
                                        {date.getDate()}
                                        {dayData && dayData.totalHours > 0 && (
                                            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[10px]">
                                                {dayData.totalHours}h
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Legend */}
                        <div className="mt-4 pt-4 border-t border-foreground/10 space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded bg-green-500" />
                                <span>Verified</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded bg-neutral-400" />
                                <span>Submitted</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded bg-red-500" />
                                <span>Rejected</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Right Side - Date Info & Action */}
                <div className="lg:col-span-2 space-y-4">
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
                            {(hasTodaySubmissions || todaySubmitted) && (
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
                            )}

                            {/* Pending Assignments Count - Show as groups */}
                            {todayUnsubmittedAssignments.length > 0 && (
                                <Card className="border-foreground/10">
                                    <CardContent className="py-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-full bg-foreground/5 flex items-center justify-center">
                                                    <FileText className="h-6 w-6 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-lg">
                                                        {todayUnsubmittedAssignments.length} Pending Responsibilit{todayUnsubmittedAssignments.length !== 1 ? 'ies' : 'y'}
                                                    </h3>
                                                    <p className="text-muted-foreground text-sm">
                                                        {groupedUnsubmittedAssignments.filter(g => g.groupId).length > 0 
                                                            ? `In ${groupedUnsubmittedAssignments.filter(g => g.groupId).length} group${groupedUnsubmittedAssignments.filter(g => g.groupId).length !== 1 ? 's' : ''}`
                                                            : 'Ready for submission'
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Show groups preview */}
                                        <div className="space-y-2">
                                            {groupedUnsubmittedAssignments.map(group => (
                                                <div 
                                                    key={group.groupId || 'ungrouped'} 
                                                    className="flex items-center gap-3 p-3 bg-foreground/5 rounded-lg"
                                                >
                                                    {group.groupId ? (
                                                        <FolderOpen className="h-5 w-5 text-muted-foreground" />
                                                    ) : (
                                                        <FileText className="h-5 w-5 text-muted-foreground" />
                                                    )}
                                                    <div className="flex-1">
                                                        <p className="font-medium text-sm">{group.groupName}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {group.assignments.length} responsibilit{group.assignments.length !== 1 ? 'ies' : 'y'}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
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

                            {/* Rejected Submissions - Show with Resubmit option */}
                            {(() => {
                                const todaySubmissions = getSubmissionsForDate(allSubmissions, today)
                                const rejectedSubmissions = todaySubmissions.filter(s => s.status === 'REJECTED')
                                
                                if (rejectedSubmissions.length === 0) return null
                                
                                return (
                                    <Card className="border-red-500/30 bg-red-50/30 dark:bg-red-900/10">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base flex items-center gap-2 text-red-600 dark:text-red-400">
                                                <AlertCircle className="h-4 w-4" />
                                                Rejected Submissions ({rejectedSubmissions.length})
                                            </CardTitle>
                                            <CardDescription className="text-red-600/70 dark:text-red-400/70">
                                                These submissions were rejected and need your attention
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {rejectedSubmissions.map(submission => {
                                                const rejectionReason = (submission as any).rejectionReason || 
                                                                        (submission as any).managerComment
                                                return (
                                                    <div 
                                                        key={submission.id} 
                                                        className="p-3 border border-red-500/30 rounded-lg bg-background"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="font-medium text-sm">
                                                                    {submission.assignment?.responsibility?.title || 'Work Submission'}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {(submission as any).hoursWorked || 0}h worked
                                                                </p>
                                                            </div>
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline"
                                                                onClick={() => openResubmitModal(submission)}
                                                                className="text-xs border-red-500/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                            >
                                                                <RefreshCw className="h-3 w-3 mr-1" />
                                                                Resubmit
                                                            </Button>
                                                        </div>
                                                        
                                                        {rejectionReason && (
                                                            <div className="mt-2 pt-2 border-t border-red-500/20">
                                                                <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                                                                    Rejection Reason:
                                                                </p>
                                                                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                                                    {rejectionReason}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </CardContent>
                                    </Card>
                                )
                            })()}
                        </>
                    )}

                    {/* PAST DATE VIEW - Read Only (but allows resubmit for rejected) */}
                    {isSelectedDateLocked && (
                        <Card className="border-foreground/10">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Lock className="h-4 w-4 text-muted-foreground" />
                                    Submissions for {format(selectedDate, 'MMMM d, yyyy')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {previousDaySubmissions.length === 0 ? (
                                    <div className="py-8 text-center">
                                        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                        <p className="text-muted-foreground">
                                            No submissions were made for this date.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {previousDaySubmissions.map(submission => {
                                            const status = submission.status || 
                                                           submission.assignment?.status || 
                                                           'SUBMITTED'
                                            const isRejected = status === 'REJECTED'
                                            const rejectionReason = (submission as any).rejectionReason || 
                                                                    (submission as any).managerComment
                                            return (
                                                <div 
                                                    key={submission.id} 
                                                    className={cn(
                                                        "p-3 border rounded-lg",
                                                        isRejected 
                                                            ? "border-red-500/30 bg-red-50/50 dark:bg-red-900/10" 
                                                            : "border-foreground/10"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-medium text-sm">
                                                                {submission.assignment?.responsibility?.title || 'Work Submission'}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {(submission as any).hoursWorked || 0}h worked
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className={cn(
                                                                "border-foreground/20",
                                                                status === 'VERIFIED' && "border-green-500/50 text-green-600 dark:text-green-400",
                                                                isRejected && "border-red-500/50 text-red-600 dark:text-red-400"
                                                            )}>
                                                                {status}
                                                            </Badge>
                                                            {isRejected && (
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="outline"
                                                                    onClick={() => openResubmitModal(submission)}
                                                                    className="text-xs"
                                                                >
                                                                    <RefreshCw className="h-3 w-3 mr-1" />
                                                                    Resubmit
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Show rejection reason */}
                                                    {isRejected && rejectionReason && (
                                                        <div className="mt-2 pt-2 border-t border-red-500/20">
                                                            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                                                                Rejection Reason:
                                                            </p>
                                                            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                                                {rejectionReason}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* FUTURE DATE VIEW */}
                    {!isSelectedDateToday && !isSelectedDateLocked && (
                        <Card className="border-foreground/10">
                            <CardContent className="py-12 text-center">
                                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground">
                                    This is a future date. You can submit work when this date arrives.
                                </p>
                            </CardContent>
                        </Card>
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
                        {/* Grouped Assignments */}
                        {groupedUnsubmittedAssignments.length > 0 && (
                            <div className="space-y-4">
                                {groupedUnsubmittedAssignments.map(group => {
                                    const groupKey = group.groupId || 'ungrouped'
                                    const isExpanded = expandedGroups.has(groupKey)
                                    
                                    return (
                                        <Collapsible 
                                            key={groupKey} 
                                            open={isExpanded} 
                                            onOpenChange={() => toggleGroupExpansion(groupKey)}
                                        >
                                            <CollapsibleTrigger asChild>
                                                <button className="w-full flex items-center gap-3 p-3 bg-foreground/5 hover:bg-foreground/10 rounded-lg transition-colors">
                                                    <div className="h-10 w-10 rounded-full bg-foreground/10 flex items-center justify-center">
                                                        {group.groupId ? (
                                                            <FolderOpen className="h-5 w-5 text-foreground" />
                                                        ) : (
                                                            <FileText className="h-5 w-5 text-foreground" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 text-left">
                                                        <p className="font-semibold text-foreground">{group.groupName}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {group.assignments.length} responsibilit{group.assignments.length !== 1 ? 'ies' : 'y'}
                                                        </p>
                                                    </div>
                                                    <ChevronDown className={cn(
                                                        "h-5 w-5 text-muted-foreground transition-transform",
                                                        isExpanded && "transform rotate-180"
                                                    )} />
                                                </button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="mt-2 space-y-3 pl-2 border-l-2 border-foreground/10 ml-5">
                                                {group.assignments.map(assignment => {
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
                                                                    <Label className="text-xs text-foreground">Hours Worked *</Label>
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
                                                                        onValueChange={(v: "TEXT" | "PDF" | "IMAGE") => 
                                                                            updateFormData(assignment.id, { workProofType: v })
                                                                        }
                                                                    >
                                                                        <SelectTrigger className="h-9 border-foreground/20 bg-background">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="bg-background border-foreground/20">
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
                                                            
                                                            {formData.workProofType === 'TEXT' ? (
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
                                                            ) : (
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
                                            </CollapsibleContent>
                                        </Collapsible>
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
                                            <Label className="text-xs text-foreground">Description</Label>
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
                                                <Label className="text-xs text-foreground">Hours Worked *</Label>
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
                                                <Label className="text-xs text-foreground">Proof Type</Label>
                                                <Select 
                                                    value={newResp.workProofType} 
                                                    onValueChange={(v: "TEXT" | "PDF" | "IMAGE") => 
                                                        updateNewResponsibility(newResp.id, { workProofType: v })
                                                    }
                                                >
                                                    <SelectTrigger className="h-9 border-foreground/20 bg-background">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-background border-foreground/20">
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
                                        
                                        {newResp.workProofType === 'TEXT' ? (
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
                                        ) : (
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
                        {groupedUnsubmittedAssignments.length === 0 && newResponsibilities.length === 0 && (
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

            {/* Resubmit Work Modal */}
            <Dialog open={isResubmitModalOpen} onOpenChange={setIsResubmitModalOpen}>
                <DialogContent className="max-w-lg bg-background border-foreground/20">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Resubmit Rejected Work</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Update your submission with corrected details and resubmit for review.
                        </DialogDescription>
                    </DialogHeader>

                    {resubmitSubmission && (
                        <div className="space-y-4 py-4">
                            {/* Responsibility Title */}
                            <div className="p-3 bg-foreground/5 rounded-lg">
                                <p className="font-medium text-sm">
                                    {resubmitSubmission.assignment?.responsibility?.title || 'Work Submission'}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Originally submitted: {(resubmitSubmission as any).hoursWorked || 0}h
                                </p>
                            </div>

                            {/* Show Rejection Reason */}
                            {((resubmitSubmission as any).rejectionReason || (resubmitSubmission as any).managerComment) && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-500/30 rounded-lg">
                                    <p className="text-xs font-medium text-red-600 dark:text-red-400">
                                        Rejection Reason:
                                    </p>
                                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                        {(resubmitSubmission as any).rejectionReason || (resubmitSubmission as any).managerComment}
                                    </p>
                                </div>
                            )}

                            {/* Hours Worked */}
                            <div className="space-y-1">
                                <Label className="text-xs text-foreground">Hours Worked *</Label>
                                <Input
                                    type="number"
                                    min="0.25"
                                    step="0.25"
                                    value={resubmitForm.hoursWorked}
                                    onChange={(e) => setResubmitForm(prev => ({ ...prev, hoursWorked: e.target.value }))}
                                    className="border-foreground/20 bg-background"
                                    placeholder="e.g., 2.5"
                                />
                            </div>

                            {/* Staff Comment / Reply */}
                            <div className="space-y-1">
                                <Label className="text-xs text-foreground">Your Reply / Explanation</Label>
                                <Textarea
                                    value={resubmitForm.staffComment}
                                    onChange={(e) => setResubmitForm(prev => ({ ...prev, staffComment: e.target.value }))}
                                    className="min-h-[80px] border-foreground/20 bg-background"
                                    placeholder="Explain the corrections or provide additional context..."
                                />
                            </div>

                            {/* Proof Type */}
                            <div className="space-y-1">
                                <Label className="text-xs text-foreground">Proof Type</Label>
                                <Select
                                    value={resubmitForm.workProofType}
                                    onValueChange={(value: 'TEXT' | 'PDF' | 'IMAGE') => 
                                        setResubmitForm(prev => ({ ...prev, workProofType: value }))
                                    }
                                >
                                    <SelectTrigger className="border-foreground/20 bg-background">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TEXT">Text Description</SelectItem>
                                        <SelectItem value="PDF">PDF Document</SelectItem>
                                        <SelectItem value="IMAGE">Image</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Proof Content */}
                            {resubmitForm.workProofType === 'TEXT' ? (
                                <div className="space-y-1">
                                    <Label className="text-xs text-foreground">Work Details</Label>
                                    <Textarea
                                        value={resubmitForm.workProofText}
                                        onChange={(e) => setResubmitForm(prev => ({ ...prev, workProofText: e.target.value }))}
                                        className="min-h-[80px] border-foreground/20 bg-background"
                                        placeholder="Describe the work completed..."
                                    />
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <Label className="text-xs text-foreground">{resubmitForm.workProofType} URL</Label>
                                    <Input
                                        type="url"
                                        value={resubmitForm.workProofUrl}
                                        onChange={(e) => setResubmitForm(prev => ({ ...prev, workProofUrl: e.target.value }))}
                                        className="border-foreground/20 bg-background"
                                        placeholder="https://..."
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="border-t border-foreground/10 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsResubmitModalOpen(false)
                                setResubmitSubmission(null)
                            }}
                            className="border-foreground/20"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleResubmit}
                            disabled={isSubmitting || !resubmitForm.hoursWorked}
                            className="bg-foreground text-background hover:bg-foreground/90"
                        >
                            {isSubmitting ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Resubmitting...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4 mr-2" />
                                    Resubmit
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
