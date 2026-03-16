"use client"

import { format } from "date-fns"
import { Calendar, FileText, Paperclip, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SemReportStatusBadge } from "./sem-report-status-badge"
import { UserAvatar } from "./user-avatar"
import type { SemReport } from "@/types/cir"

interface SemReportCardProps {
  report: SemReport
  onEdit?: (report: SemReport) => void
  onDelete?: (report: SemReport) => void
  onView?: (report: SemReport) => void
  showStaffInfo?: boolean
}

export function SemReportCard({
  report,
  onEdit,
  onDelete,
  onView,
  showStaffInfo = false,
}: SemReportCardProps) {
  const startDate = format(new Date(report.semesterStartDate), "MMM d, yyyy")
  const endDate = format(new Date(report.semesterEndDate), "MMM d, yyyy")
  const batchItems = report.items.filter((i) => i.type === "BATCH")
  const respItems = report.items.filter((i) => i.type === "RESPONSIBILITY")
  const totalAttachments = report.items.reduce((sum, i) => sum + i.attachments.length, 0)
  const canEdit = report.status === "DRAFT" || report.status === "REJECTED"
  const canDelete = report.status === "DRAFT"

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {startDate} — {endDate}
            </CardTitle>
         {showStaffInfo && report.staff && (
  <div className="flex items-center gap-4">
    <UserAvatar
      name={report.staff.name}
      avatarUrl={report.staff.avatarUrl}
     className="h-12 w-12"
    />

    <div className="flex flex-col">
      <span className="text-sm font-semibold text-foreground">
        {report.staff.name}
      </span>

      <span className="text-xs text-muted-foreground">
        {report.staff.department?.name || "No Department"}
      </span>

      {report.staff.subDepartment && (
        <span className="text-xs text-muted-foreground">
          {report.staff.subDepartment.name}
        </span>
      )}
    </div>
  </div>
)}
          </div>
          <SemReportStatusBadge status={report.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {batchItems.length > 0 && (
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {batchItems.length} batch{batchItems.length > 1 ? "es" : ""}: {batchItems.map((b) => b.name).join(", ")}
            </span>
          )}
          {respItems.length > 0 && (
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {respItems.length} responsibility{respItems.length > 1 ? "ies" : "y"}: {respItems.map((r) => r.name).join(", ")}
            </span>
          )}
          {totalAttachments > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" />
              {totalAttachments} attachment{totalAttachments > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {report.status === "REJECTED" && report.rejectionReason && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Rejection Reason:</strong> {report.rejectionReason}
              {report.rejectedBy && (
                <span className="text-xs mt-0.5 opacity-80 flex items-center gap-1">
                  Rejected by
                  {/* <UserAvatar
                    name={report.rejectedBy.name}
                    avatarUrl={report.rejectedBy.avatarUrl}
                    className="h-12 w-12"
                  /> */}
                  {report.rejectedBy.name}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2 pt-1">
          {onView && (
            <Button variant="outline" size="sm" onClick={() => onView(report)}>
              View Details
            </Button>
          )}
          {onEdit && canEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(report)}>
              {report.status === "REJECTED" ? "Edit & Resubmit" : "Edit"}
            </Button>
          )}
          {onDelete && canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(report)}
            >
              Delete
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>Created {format(new Date(report.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
          {report.managerReviewedAt && report.managerReviewedBy && (
            <span className="flex items-center gap-1">
             Approved By : Manager
              {/* <UserAvatar
                name={report.managerReviewedBy.name}
                avatarUrl={report.managerReviewedBy.avatarUrl}
                className="sm"
              /> */}
              {report.managerReviewedBy.name} on {format(new Date(report.managerReviewedAt), "MMM d")}
            </span>
          )}
          {report.adminReviewedAt && report.adminReviewedBy && (
            <span className="flex items-center gap-1">
              • Admin:
              {/* <UserAvatar
                name={report.adminReviewedBy.name}
                avatarUrl={report.adminReviewedBy.avatarUrl}
                size="sm"
              /> */}
              {report.adminReviewedBy.name} on {format(new Date(report.adminReviewedAt), "MMM d")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
