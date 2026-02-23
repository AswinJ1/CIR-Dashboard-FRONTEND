"use client"

import { format } from "date-fns"
import { Calendar, ExternalLink, FileText, AlertCircle, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { SemReportStatusBadge } from "./sem-report-status-badge"
import { UserAvatar } from "./user-avatar"
import type { SemReport } from "@/types/cir"

interface SemReportDetailProps {
  report: SemReport
  children?: React.ReactNode // Slot for review actions
}

export function SemReportDetail({ report, children }: SemReportDetailProps) {
  const startDate = format(new Date(report.semesterStartDate), "MMM d, yyyy")
  const endDate = format(new Date(report.semesterEndDate), "MMM d, yyyy")
  const batchItems = report.items.filter((i) => i.type === "BATCH")
  const respItems = report.items.filter((i) => i.type === "RESPONSIBILITY")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            Semester: {startDate} — {endDate}
          </h3>
          {report.staff && (
       <div className="flex items-center gap-4">
  <UserAvatar
    name={report.staff.name}
    avatarUrl={report.staff.avatarUrl}
    className="h-14 w-14"
  />

  <div className="flex flex-col">
    <span className="text-base font-semibold text-foreground">
      {report.staff.name}
    </span>
    <span className="text-sm text-muted-foreground">
      {report.staff.email}
    </span>
  </div>
</div>
          )}
        </div>
        <SemReportStatusBadge status={report.status} />
      </div>

      {/* Rejection Alert */}
      {report.status === "REJECTED" && report.rejectionReason && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Rejection Reason:</strong> {report.rejectionReason}
            {report.rejectedBy && (
              <span className="text-sm mt-1 opacity-80 flex items-center gap-1.5">
                Rejected by
                <UserAvatar
                  name={report.rejectedBy.name}
                  avatarUrl={report.rejectedBy.avatarUrl}
                  size="sm"
                />
                {report.rejectedBy.name}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Review Timeline */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>Created: {format(new Date(report.createdAt), "MMM d, yyyy h:mm a")}</span>
        {report.managerReviewedAt && report.managerReviewedBy && (
          <span className="flex items-center gap-1.5">
           Approved By : Manager:
            {/* <UserAvatar
              name={report.managerReviewedBy.name}
              avatarUrl={report.managerReviewedBy.avatarUrl}
              size="sm"
            /> */}
            {report.managerReviewedBy.name} on {format(new Date(report.managerReviewedAt), "MMM d, yyyy")}
          </span>
        )}
        {report.adminReviewedAt && report.adminReviewedBy && (
          <span className="flex items-center gap-1.5">
            Admin:
            {/* <UserAvatar
              name={report.adminReviewedBy.name}
              avatarUrl={report.adminReviewedBy.avatarUrl}
              size="sm"
            /> */}
            {report.adminReviewedBy.name} on {format(new Date(report.adminReviewedAt), "MMM d, yyyy")}
          </span>
        )}
      </div>

      <Separator />

      {/* Batch Report Items */}
      {batchItems.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Batch Reports ({batchItems.length})
          </h4>
          {batchItems.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    BATCH
                  </Badge>
                  {item.name} Batch Report
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {item.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.description}</p>
                )}
                {item.attachments.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attachments</p>
                    <ul className="space-y-1">
                      {item.attachments.map((att) => (
                        <li key={att.id}>
                          <a
                            href={att.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1.5"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {att.fileName || att.fileUrl}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {item.attachments.length === 0 && !item.description && (
                  <p className="text-sm text-muted-foreground italic">No description or attachments provided.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Responsibility Report Items */}
      {respItems.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Responsibility Reports ({respItems.length})
          </h4>
          {respItems.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    RESPONSIBILITY
                  </Badge>
                  {item.name} Report
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {item.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.description}</p>
                )}
                {item.attachments.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attachments</p>
                    <ul className="space-y-1">
                      {item.attachments.map((att) => (
                        <li key={att.id}>
                          <a
                            href={att.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1.5"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {att.fileName || att.fileUrl}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {item.attachments.length === 0 && !item.description && (
                  <p className="text-sm text-muted-foreground italic">No description or attachments provided.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Actions Slot */}
      {children}
    </div>
  )
}
