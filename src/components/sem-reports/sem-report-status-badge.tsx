"use client"

import { Badge } from "@/components/ui/badge"
import type { SemReportStatus } from "@/types/cir"

const statusConfig: Record<SemReportStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  DRAFT: {
    label: "Draft",
    variant: "secondary",
    className: "bg-gray-100 text-gray-700 border-gray-300",
  },
  UNDER_MANAGER_REVIEW: {
    label: "Under Manager Review",
    variant: "outline",
    className: "rounded-none",
  },
  UNDER_ADMIN_REVIEW: {
    label: "Under Admin Review",
    variant: "outline",
    className: "rounded-none",
  },
  APPROVED: {
    label: "Approved",
    variant: "default",
    className: "rounded-none",
  },
  REJECTED: {
    label: "Rejected",
    variant: "destructive",
    className: "bg-red-50 text-red-700 border-red-300 rounded-none",
  },
}

export function SemReportStatusBadge({ status }: { status: SemReportStatus }) {
  const config = statusConfig[status]
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}
