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
    className: "bg-yellow-50 text-yellow-700 border-yellow-300",
  },
  UNDER_ADMIN_REVIEW: {
    label: "Under Admin Review",
    variant: "outline",
    className: "bg-blue-50 text-blue-700 border-blue-300",
  },
  APPROVED: {
    label: "Approved",
    variant: "default",
    className: "bg-green-50 text-green-700 border-green-300",
  },
  REJECTED: {
    label: "Rejected",
    variant: "destructive",
    className: "bg-red-50 text-red-700 border-red-300",
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
