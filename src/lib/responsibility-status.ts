/**
 * Shared Responsibility Status Utility
 * 
 * CRITICAL: Responsibility status must be DATE-SPECIFIC.
 * A responsibility that was VERIFIED or SUBMITTED on a previous day
 * must appear as PENDING on subsequent days until submitted again.
 * 
 * This utility provides a single source of truth for status derivation
 * across all components (Work Calendar, Staff Dashboard, Manager Dashboard, etc.)
 */

import { format } from "date-fns"
import { Assignment, WorkSubmission, DayStatus, SubmissionStatus } from "@/types/cir"

/**
 * Get the status of a responsibility/assignment for a specific date.
 * 
 * @param assignment - The assignment containing workSubmissions
 * @param targetDate - The date to check status for
 * @param allSubmissions - Optional: all submissions (fallback lookup)
 * @returns The date-specific status ('PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED')
 */
export function getAssignmentStatusForDate(
    assignment: Assignment,
    targetDate: Date,
    allSubmissions?: WorkSubmission[]
): SubmissionStatus {
    const targetDateStr = format(targetDate, 'yyyy-MM-dd')
    
    // First, check in assignment.workSubmissions
    let submission = assignment.workSubmissions?.find(s => {
        const workDate = new Date((s as any).workDate || s.submittedAt)
        return format(workDate, 'yyyy-MM-dd') === targetDateStr
    })
    
    // Fallback: check in allSubmissions if provided
    if (!submission && allSubmissions) {
        const assignmentId = typeof assignment.id === 'string' 
            ? parseInt(assignment.id) 
            : assignment.id
            
        submission = allSubmissions.find(s => {
            const workDate = new Date((s as any).workDate || s.submittedAt)
            const subAssignmentId = typeof s.assignmentId === 'string' 
                ? parseInt(s.assignmentId) 
                : s.assignmentId
            return format(workDate, 'yyyy-MM-dd') === targetDateStr && 
                   subAssignmentId === assignmentId
        })
    }
    
    // If no submission for this date, status is PENDING
    if (!submission) {
        return 'PENDING'
    }
    
    // Return the submission's status for this date
    // Note: WorkSubmission itself may not have status, check both patterns
    return (submission.status || 
            submission.assignment?.status || 
            'SUBMITTED') as SubmissionStatus
}

/**
 * Find the submission for a specific date from an assignment
 */
export function getSubmissionForDate(
    assignment: Assignment,
    targetDate: Date,
    allSubmissions?: WorkSubmission[]
): WorkSubmission | null {
    const targetDateStr = format(targetDate, 'yyyy-MM-dd')
    
    // First, check in assignment.workSubmissions
    let submission = assignment.workSubmissions?.find(s => {
        const workDate = new Date((s as any).workDate || s.submittedAt)
        return format(workDate, 'yyyy-MM-dd') === targetDateStr
    })
    
    // Fallback: check in allSubmissions
    if (!submission && allSubmissions) {
        const assignmentId = typeof assignment.id === 'string' 
            ? parseInt(assignment.id) 
            : assignment.id
            
        submission = allSubmissions.find(s => {
            const workDate = new Date((s as any).workDate || s.submittedAt)
            const subAssignmentId = typeof s.assignmentId === 'string' 
                ? parseInt(s.assignmentId) 
                : s.assignmentId
            return format(workDate, 'yyyy-MM-dd') === targetDateStr && 
                   subAssignmentId === assignmentId
        })
    }
    
    return submission || null
}

/**
 * Check if an assignment has been submitted for a specific date
 */
export function hasSubmissionForDate(
    assignment: Assignment,
    targetDate: Date,
    allSubmissions?: WorkSubmission[]
): boolean {
    return getSubmissionForDate(assignment, targetDate, allSubmissions) !== null
}

/**
 * Get the effective status of a submission
 * PRIORITY: submission.status > assignment.status > 'SUBMITTED'
 * This is critical for per-day status accuracy
 */
export function getSubmissionEffectiveStatus(submission: WorkSubmission): string {
    return submission.status || submission.assignment?.status || 'SUBMITTED'
}

/**
 * Calculate the day status based on submissions for that specific date
 */
export function getDayStatus(submissions: WorkSubmission[]): DayStatus {
    if (submissions.length === 0) {
        return 'NOT_SUBMITTED'
    }
    
    // Use submission.status as the primary source of truth (per-submission status)
    const hasVerified = submissions.some(s => getSubmissionEffectiveStatus(s) === 'VERIFIED')
    const hasSubmitted = submissions.some(s => getSubmissionEffectiveStatus(s) === 'SUBMITTED')
    const hasRejected = submissions.some(s => getSubmissionEffectiveStatus(s) === 'REJECTED')
    const hasPending = submissions.some(s => getSubmissionEffectiveStatus(s) === 'PENDING')
    
    // All verified = VERIFIED
    if (hasVerified && !hasSubmitted && !hasRejected && !hasPending) {
        return 'VERIFIED'
    }
    
    // All rejected = REJECTED
    if (hasRejected && !hasVerified && !hasSubmitted && !hasPending) {
        return 'REJECTED'
    }
    
    // Mix of statuses = PARTIAL
    if ((hasVerified || hasSubmitted) && hasRejected) {
        return 'PARTIAL'
    }
    
    // Has submitted work = SUBMITTED
    if (hasSubmitted || hasVerified || hasPending) {
        return 'SUBMITTED'
    }
    
    return 'NOT_SUBMITTED'
}

/**
 * Get submissions for a specific date from all submissions
 */
export function getSubmissionsForDate(
    allSubmissions: WorkSubmission[],
    targetDate: Date
): WorkSubmission[] {
    const targetDateStr = format(targetDate, 'yyyy-MM-dd')
    
    return allSubmissions.filter(s => {
        const workDate = new Date((s as any).workDate || s.submittedAt)
        return format(workDate, 'yyyy-MM-dd') === targetDateStr
    })
}

/**
 * Filter assignments to show only those:
 * 1. That are active for the current date (within start/end date)
 * 2. That have NOT been submitted for the current date
 */
export function getActiveUnsubmittedAssignments(
    assignments: Assignment[],
    targetDate: Date,
    allSubmissions?: WorkSubmission[]
): Assignment[] {
    const targetDateStr = format(targetDate, 'yyyy-MM-dd')
    const targetDateObj = new Date(targetDate)
    targetDateObj.setHours(0, 0, 0, 0)
    
    return assignments.filter(assignment => {
        // Check if responsibility is active for this date
        const resp = assignment.responsibility
        if (resp) {
            // Check start date
            if (resp.startDate) {
                const startDate = new Date(resp.startDate)
                startDate.setHours(0, 0, 0, 0)
                if (targetDateObj < startDate) return false
            }
            
            // Check end date
            if (resp.endDate) {
                const endDate = new Date(resp.endDate)
                endDate.setHours(23, 59, 59, 999)
                if (targetDateObj > endDate) return false
            }
        }
        
        // Check if already submitted for this date
        const hasSubmission = hasSubmissionForDate(assignment, targetDate, allSubmissions)
        return !hasSubmission
    })
}

/**
 * Get assignments that have been submitted for a specific date
 */
export function getSubmittedAssignmentsForDate(
    assignments: Assignment[],
    targetDate: Date,
    allSubmissions?: WorkSubmission[]
): (Assignment & { submissionForDate: WorkSubmission })[] {
    return assignments
        .map(assignment => {
            const submission = getSubmissionForDate(assignment, targetDate, allSubmissions)
            return submission ? { ...assignment, submissionForDate: submission } : null
        })
        .filter((a): a is (Assignment & { submissionForDate: WorkSubmission }) => a !== null)
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const compareDate = new Date(date)
    compareDate.setHours(0, 0, 0, 0)
    return today.getTime() === compareDate.getTime()
}

/**
 * Check if a date is in the past (before today)
 */
export function isPastDate(date: Date): boolean {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const compareDate = new Date(date)
    compareDate.setHours(0, 0, 0, 0)
    return compareDate.getTime() < today.getTime()
}

/**
 * Check if a date is in the future (after today)
 */
export function isFutureDate(date: Date): boolean {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const compareDate = new Date(date)
    compareDate.setHours(0, 0, 0, 0)
    return compareDate.getTime() > today.getTime()
}

/**
 * Get today's date with time zeroed
 */
export function getToday(): Date {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
}

/**
 * Interface for inline responsibility form data
 */
export interface InlineResponsibilityFormData {
    id: string // Temporary ID for tracking in UI
    title: string
    description: string
    hoursWorked: string
    workDescription: string
    workProofType: 'NONE' | 'TEXT' | 'PDF' | 'IMAGE'
    workProofText: string
    workProofUrl: string
    isNew: boolean // True if this is a new responsibility being created
}

/**
 * Create empty form data for a new inline responsibility
 */
export function createEmptyInlineForm(): InlineResponsibilityFormData {
    return {
        id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: '',
        description: '',
        hoursWorked: '',
        workDescription: '',
        workProofType: 'NONE',
        workProofText: '',
        workProofUrl: '',
        isNew: true,
    }
}

/**
 * Interface for assignment with inline form data
 */
export interface AssignmentWithFormData extends Assignment {
    formData: {
        hoursWorked: string
        workDescription: string
        workProofType: 'NONE' | 'TEXT' | 'PDF' | 'IMAGE'
        workProofText: string
        workProofUrl: string
    }
    submissionForDate: WorkSubmission | null
}

/**
 * Convert assignment to assignment with form data
 */
export function assignmentToFormData(
    assignment: Assignment,
    targetDate: Date,
    allSubmissions?: WorkSubmission[]
): AssignmentWithFormData {
    return {
        ...assignment,
        formData: {
            hoursWorked: '',
            workDescription: '',
            workProofType: 'NONE',
            workProofText: '',
            workProofUrl: '',
        },
        submissionForDate: getSubmissionForDate(assignment, targetDate, allSubmissions),
    }
}
