import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { SubmissionStatus, AssignmentStatus, DayStatus } from "@/types/cir"

const statusBadgeVariants = cva(
    "inline-flex items-center rounded-md border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            status: {
                PENDING: "",
                SUBMITTED: "",
                VERIFIED: "",
                REJECTED: "",
                IN_PROGRESS: "",
                COMPLETED: "",
                OVERDUE: "",
                NOT_SUBMITTED: "",
                PARTIAL: "",
            },
        },
        defaultVariants: {
            status: "PENDING",
        },
    }
)

const statusIcons: Record<string, string> = {
    PENDING: "",
    SUBMITTED: "",
    VERIFIED: "",
    REJECTED: "",
    IN_PROGRESS: "",
    COMPLETED: "",
    OVERDUE: "",
    NOT_SUBMITTED: "",
    PARTIAL: "",
}

const statusLabels: Record<string, string> = {
    PENDING: "Pending",
    SUBMITTED: "Submitted",
    VERIFIED: "Verified",
    REJECTED: "Rejected",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    OVERDUE: "Overdue",
    NOT_SUBMITTED: "Not Submitted",
    PARTIAL: "Partial",
}

export interface StatusBadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
    showIcon?: boolean
}

function StatusBadge({
    className,
    status,
    showIcon = true,
    children,
    ...props
}: StatusBadgeProps) {
    const statusKey = status || "PENDING"

    return (
        <div className={cn(statusBadgeVariants({ status }), className)} {...props}>
            {showIcon && <span className="mr-1">{statusIcons[statusKey]}</span>}
            {children || statusLabels[statusKey]}
        </div>
    )
}

// Convenience components for specific status types
interface SubmissionStatusBadgeProps extends Omit<StatusBadgeProps, 'status'> {
    status: SubmissionStatus
}

function SubmissionStatusBadge({ status, ...props }: SubmissionStatusBadgeProps) {
    return <StatusBadge status={status} {...props} />
}

interface AssignmentStatusBadgeProps extends Omit<StatusBadgeProps, 'status'> {
    status: AssignmentStatus
}

function AssignmentStatusBadge({ status, ...props }: AssignmentStatusBadgeProps) {
    return <StatusBadge status={status} {...props} />
}

// Day status badge for calendar view
interface DayStatusBadgeProps extends Omit<StatusBadgeProps, 'status'> {
    status: DayStatus
}

function DayStatusBadge({ status, ...props }: DayStatusBadgeProps) {
    return <StatusBadge status={status} {...props} />
}

// Priority badge for responsibilities
const priorityBadgeVariants = cva(
    "inline-flex items-center rounded-md border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground shadow-sm transition-colors",
    {
        variants: {
            priority: {
                LOW: "",
                MEDIUM: "",
                HIGH: "",
                CRITICAL: "",
            },
        },
        defaultVariants: {
            priority: "MEDIUM",
        },
    }
)

interface PriorityBadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof priorityBadgeVariants> { }

function PriorityBadge({ className, priority, ...props }: PriorityBadgeProps) {
    return (
        <div className={cn(priorityBadgeVariants({ priority }), className)} {...props}>
            {priority}
        </div>
    )
}

// Role badge
const roleBadgeVariants = cva(
    "inline-flex items-center rounded-md border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground shadow-sm transition-colors",
    {
        variants: {
            role: {
                ADMIN: "",
                MANAGER: "",
                STAFF: "",
            },
        },
        defaultVariants: {
            role: "STAFF",
        },
    }
)

interface RoleBadgeProps
    extends Omit<React.HTMLAttributes<HTMLDivElement>, 'role'>,
    VariantProps<typeof roleBadgeVariants> { }

function RoleBadge({ className, role, ...props }: RoleBadgeProps) {
    return (
        <div className={cn(roleBadgeVariants({ role }), className)} {...props}>
            {role}
        </div>
    )
}

export {
    StatusBadge,
    SubmissionStatusBadge,
    AssignmentStatusBadge,
    DayStatusBadge,
    PriorityBadge,
    RoleBadge,
    statusBadgeVariants,
    priorityBadgeVariants,
    roleBadgeVariants,
}
