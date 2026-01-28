"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useAuth } from "@/components/providers/auth-context"
import { api } from "@/lib/api"
import { Assignment, WorkSubmission, ResubmitWorkSubmissionDto } from "@/types/cir"
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

export default function StaffWorkCalendarPage() {
    const { user } = useAuth()
    const [isLoading, setIsLoading] = useState(true)
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [allSubmissions, setAllSubmissions] = useState<WorkSubmission[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [resubmitDialogOpen, setResubmitDialogOpen] = useState(false)
    const [resubmitSubmission, setResubmitSubmission] = useState<WorkSubmission | null>(null)
    const [isResubmitting, setIsResubmitting] = useState(false)
    const [resubmitData, setResubmitData] = useState({
        hoursWorked: '',
        staffComment: '',
        workProofType: 'TEXT' as 'TEXT' | 'PDF' | 'IMAGE',
        workProofText: '',
        workProofUrl: ''
    })


    
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
        fetchData()
    }, [])

    async function fetchData() {
        setIsLoading(true)
        try {
            const [assignmentsData, submissionsData] = await Promise.all([
                api.assignments.getAll(),
                api.workSubmissions.getAll(),
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
     const rejectedSubmissions = useMemo(() => {
        if (!user?.id) return []
        return allSubmissions.filter(s => 
            s.staffId === user.id && 
            s.status === 'REJECTED'
        )
    }, [allSubmissions, user?.id])

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

function openResubmitDialog(submission: WorkSubmission) {
    setResubmitSubmission(submission)
    setResubmitData({
        hoursWorked: String(submission.hoursWorked || ''),
        staffComment: submission.staffComment || '',
        workProofType: (submission.workProofType || 'TEXT') as 'TEXT' | 'PDF' | 'IMAGE',
        workProofText: submission.workProofText || '',
        workProofUrl: submission.workProofUrl || ''
    })
    setResubmitDialogOpen(true)
}


    // Handle resubmission of rejected work
    async function handleResubmit() {
        if (!resubmitSubmission) return

        const hours = parseFloat(resubmitData.hoursWorked)
        if (isNaN(hours) || hours <= 0) {
            toast.error("Please enter valid hours")
            return
        }

        if (hours > 24) {
            toast.error("Hours cannot exceed 24")
            return
        }

        setIsResubmitting(true)
        try {
            const submitData: ResubmitWorkSubmissionDto = {
                hoursWorked: hours,
                staffComment: resubmitData.staffComment || undefined,
                workProofType: resubmitData.workProofType,
            }

            if (resubmitData.workProofType === 'TEXT') {
                submitData.workProofText = resubmitData.workProofText || undefined
            } else {
                submitData.workProofUrl = resubmitData.workProofUrl || undefined
            }

            await api.workSubmissions.resubmit(resubmitSubmission.id, submitData)
            
            toast.success("Work resubmitted successfully!")
            setResubmitDialogOpen(false)
            setResubmitSubmission(null)
            await fetchData()
        } catch (error: any) {
            console.error("Failed to resubmit:", error)
            toast.error(error.message || "Failed to resubmit work")
        } finally {
            setIsResubmitting(false)
        }
    }

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
            {/* <DashboardHeader/> */}
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
                        {rejectedSubmissions.length > 0 && (
                             <Card className="border-2 border-black bg-background dark:border-white">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                        
                            Rejected Submissions - Action Required ({rejectedSubmissions.length})
                        </CardTitle>
                        <CardDescription className="text-black dark:text-white">
                            The following submissions were rejected by your manager. Please review the feedback and resubmit.
                        </CardDescription>
                    </CardHeader>
                   
                </Card>
                        )}

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Calendar - Left Side */}
           <Card className="border border-foreground/10 overflow-hidden">
  {/* Header */}
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3">
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={() => navigateMonth("prev")}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <h2 className="text-lg font-semibold">
        {format(currentMonth, "MMMM yyyy")}
      </h2>
      <Button variant="ghost" size="icon" onClick={() => navigateMonth("next")}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>

    <span className="text-sm text-muted-foreground hidden sm:block">
      {assignments.length} responsibilities
    </span>
  </div>

  {/* Day Headers – hidden on mobile */}
  <div className="hidden sm:grid grid-cols-7 bg-black text-white text-sm font-medium">
    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
      <div key={day} className="py-2 text-center">
        {day}
      </div>
    ))}
  </div>

  {/* Calendar Grid */}
  <div className="grid grid-cols-2 sm:grid-cols-7 border-t border-foreground/10">
    {/* Empty cells (desktop only) */}
    <div className="hidden sm:block col-span-full">
      <div className="grid grid-cols-7">
        {Array.from({ length: calendarDays[0]?.getDay() || 0 }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="min-h-[110px] border border-foreground/10"
          />
        ))}
      </div>
    </div>

    {calendarDays.map(date => {
      const dateStr = format(date, "yyyy-MM-dd")
      const isSelected = isSameDay(date, selectedDate)
      const isTodayDate = isDateToday(date)
      const dayData = dayDataMap.get(dateStr)

      return (
        <div
          key={dateStr}
          onClick={() => setSelectedDate(date)}
          className={cn(
            "border border-foreground/10 p-2 cursor-pointer transition",
            "min-h-[90px] sm:min-h-[120px]",
            isSelected && "bg-blue-50 dark:bg-blue-950/30",
            isTodayDate && "ring-2 ring-blue-500 ring-inset"
          )}
        >
          {/* Date */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">
              {format(date, "d")}
            </span>
            {(dayData?.totalHours ?? 0) > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {(dayData?.totalHours ?? 0)}h
              </span>
            )}
          </div>

          {/* Events */}
          <div className="space-y-1">
            {dayData?.submissions.slice(0, 3).map(submission => (
              <div
                key={submission.id}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded truncate text-white",
                  submission.status === "VERIFIED" && "bg-green-600",
                  submission.status === "SUBMITTED" && "bg-blue-600",
                  submission.status === "REJECTED" && "bg-red-600"
                )}
                title={submission.assignment?.responsibility?.title}
              >
                {submission.assignment?.responsibility?.title || "Work"}
              </div>
            ))}

            {dayData && dayData.submissions.length > 3 && (
              <div className="text-[10px] text-muted-foreground">
                +{dayData.submissions.length - 3} more
              </div>
            )}
          </div>
        </div>
      )
    })}
  </div>
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
                                                        {todayUnsubmittedAssignments.length} Pending Responsibility{todayUnsubmittedAssignments.length !== 1 ? 'ies' : 'y'}
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


                            {rejectedSubmissions.length > 0 && (
  <Card className="border border-black bg-background dark:border-white">
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-black dark:text-white">
        <RotateCcw className="h-5 w-5" />
        Rejected Work – Resubmission Required
      </CardTitle>
      <CardDescription className="text-black dark:text-white">
        Fix the issues mentioned by your manager and resubmit.
      </CardDescription>
    </CardHeader>

    <CardContent className="space-y-3">
      {todaySubmittedAssignments
        .filter(assignment => {
          const status =
            assignment.submissionForDate?.status ||
            assignment.submissionForDate?.assignment?.status ||
            'SUBMITTED'
          return status === 'REJECTED'
        })
        .map(assignment => {
          const submission = assignment.submissionForDate

          return (
            <div
              key={assignment.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3
                         rounded-lg border border-black dark:border-white bg-background p-4"
            >
              {/* Left: Info */}
              <div className="space-y-1">
                <p className="font-medium text-sm">
                  {assignment.responsibility?.title || 'Untitled Responsibility'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {submission?.hoursWorked || 0} hours submitted
                </p>
                 <p className="text-sm text-muted-foreground">
                                    Originally submitted: {format(new Date(submission?.submittedAt), "PPP")}
                 </p>
              </div>

              {/* Right: Status + Action */}
              <div className="flex items-center gap-3">
                <div
                  className="border-black/50 text-black dark:border-white dark:text-white "
                >
                  Rejected |
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => submission && openResubmitDialog(submission)}
                  className="border-black/40 text-black dark:border-white dark:text-white
                              "
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Resubmit
                </Button>
              </div>
            </div>
          )
        })}
    </CardContent>
  </Card>
)}



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
                   

                    {/* PAST DATE VIEW - Read Only */}
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
                                    <div className="space-y-2">
                                        {previousDaySubmissions.map(submission => {
                                            const status = submission.status || 
                                                           submission.assignment?.status || 
                                                           'SUBMITTED'
                                            return (
                                                <div 
                                                    key={submission.id} 
                                                    className="flex items-center justify-between p-3 border border-foreground/10 rounded-lg"
                                                >
                                                    <div>
                                                        <p className="font-medium text-sm">
                                                            {submission.assignment?.responsibility?.title || 'Work Submission'}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {(submission as any).hoursWorked || 0}h
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
            {/* ✅ NEW: Resubmit Dialog */}
            <Dialog open={resubmitDialogOpen} onOpenChange={setResubmitDialogOpen}>
                <DialogContent className="max-w-2xl bg-background border-foreground/20">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Resubmit Work</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Update your submission based on manager's feedback
                        </DialogDescription>
                    </DialogHeader>

                    {resubmitSubmission && (
                        <div className="space-y-4 py-4">
                            {/* Responsibility Title */}
                            <div>
                                <h4 className="font-semibold text-lg text-foreground">
                                    {resubmitSubmission.assignment?.responsibility?.title || 'Work Submission'}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                    Originally submitted: {format(new Date(resubmitSubmission.submittedAt), "PPP")}
                                </p>
                            </div>

                            {/* Manager's Feedback */}
                            {resubmitSubmission.managerComment && (
                                <div className="p-4 bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800 rounded-lg">
                                    <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        Manager's Feedback:
                                    </p>
                                    <p className="text-red-600 dark:text-red-300">
                                        {resubmitSubmission.managerComment}
                                    </p>
                                </div>
                            )}

                            <div className="border-t border-foreground/10 pt-4 space-y-4">
                                {/* Hours Worked */}
                                <div className="space-y-2">
                                    <Label className="text-foreground">Hours Worked *</Label>
                                    <Input
                                        type="number"
                                        min="0.5"
                                        max="24"
                                        step="0.5"
                                        placeholder="e.g., 2.5"
                                        value={resubmitData.hoursWorked}
                                        onChange={(e) => setResubmitData({ ...resubmitData, hoursWorked: e.target.value })}
                                        className="border-foreground/20 bg-background"
                                    />
                                </div>

                                {/* Proof Type */}
                                <div className="space-y-2">
                                    <Label className="text-foreground">Proof Type</Label>
                                    <Select 
                                        value={resubmitData.workProofType} 
                                        onValueChange={(v: "TEXT" | "PDF" | "IMAGE") => 
                                            setResubmitData({ ...resubmitData, workProofType: v })
                                        }
                                    >
                                        <SelectTrigger className="border-foreground/20 bg-background">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-background border-foreground/20">
                                            <SelectItem value="TEXT">Text</SelectItem>
                                            <SelectItem value="PDF">PDF URL</SelectItem>
                                            <SelectItem value="IMAGE">Image URL</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Work Description */}
                                <div className="space-y-2">
                                    <Label className="text-foreground">Updated Work Description</Label>
                                    <Textarea
                                        placeholder="Explain what you've updated or changed..."
                                        value={resubmitData.staffComment}
                                        onChange={(e) => setResubmitData({ ...resubmitData, staffComment: e.target.value })}
                                        rows={4}
                                        className="resize-none border-foreground/20 bg-background"
                                    />
                                </div>

                                {/* Work Proof */}
                                {resubmitData.workProofType === 'TEXT' ? (
                                    <div className="space-y-2">
                                        <Label className="text-foreground">Work Proof Details</Label>
                                        <Textarea
                                            placeholder="Provide updated proof of your work..."
                                            value={resubmitData.workProofText}
                                            onChange={(e) => setResubmitData({ ...resubmitData, workProofText: e.target.value })}
                                            rows={4}
                                            className="resize-none border-foreground/20 bg-background"
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label className="text-foreground">{resubmitData.workProofType} URL</Label>
                                        <Input
                                            type="url"
                                            placeholder="https://..."
                                            value={resubmitData.workProofUrl}
                                            onChange={(e) => setResubmitData({ ...resubmitData, workProofUrl: e.target.value })}
                                            className="border-foreground/20 bg-background"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="border-t border-foreground/10 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => setResubmitDialogOpen(false)}
                            disabled={isResubmitting}
                            className="border-foreground/20"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleResubmit}
                            disabled={isResubmitting}
                            className="bg-foreground text-background hover:bg-foreground/90"
                        >
                            {isResubmitting ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Resubmitting...
                                </>
                            ) : (
                                <>
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Resubmit Work
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
        </div>
    )
}
