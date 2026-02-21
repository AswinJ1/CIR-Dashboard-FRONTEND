"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { FileText } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/components/providers/auth-context"
import { api } from "@/lib/api"
import { SemReportCard } from "@/components/sem-reports/sem-report-card"
import { SemReportDetail } from "@/components/sem-reports/sem-report-detail"
import { ReviewActions } from "@/components/sem-reports/review-actions"
import type { SemReport, Department } from "@/types/cir"

export default function AdminSemReportsPage() {
  const { user } = useAuth()
  const [reports, setReports] = useState<SemReport[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)

  const fetchDepartments = useCallback(async () => {
    try {
      const data = await api.departments.getAll()
      setDepartments(data)
    } catch {
      // non-critical
    }
  }, [])

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.semReports.getAdminReports(selectedDeptId)
      setReports(data)
    } catch (err: any) {
      toast.error(err?.message || "Failed to load reports")
    } finally {
      setLoading(false)
    }
  }, [selectedDeptId])

  useEffect(() => {
    fetchDepartments()
  }, [fetchDepartments])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleApprove = async (reportId: number) => {
    try {
      setReviewLoading(true)
      await api.semReports.adminReview(reportId, { action: "APPROVE" })
      toast.success("Report approved")
      setExpandedId(null)
      fetchReports()
    } catch (err: any) {
      toast.error(err?.message || "Failed to approve report")
    } finally {
      setReviewLoading(false)
    }
  }

  const handleReject = async (reportId: number, reason: string) => {
    try {
      setReviewLoading(true)
      await api.semReports.adminReview(reportId, {
        action: "REJECT",
        rejectionReason: reason,
      })
      toast.success("Report rejected")
      setExpandedId(null)
      fetchReports()
    } catch (err: any) {
      toast.error(err?.message || "Failed to reject report")
    } finally {
      setReviewLoading(false)
    }
  }

  const pendingReports = reports.filter((r) => r.status === "UNDER_ADMIN_REVIEW")
  const otherReports = reports.filter((r) => r.status !== "UNDER_ADMIN_REVIEW")

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Semester Report Reviews</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review and provide final approval for semester reports across all departments.
        </p>
      </div>

      {/* Department Filter */}
      <div className="flex items-end gap-4">
        <div className="space-y-1.5 w-64">
          <Label className="text-sm">Filter by Department</Label>
          <Select
            value={selectedDeptId?.toString() || "all"}
            onValueChange={(val) =>
              setSelectedDeptId(val === "all" ? undefined : parseInt(val))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id.toString()}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending Review ({pendingReports.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All Reports ({otherReports.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pendingReports.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">No Pending Reports</h3>
              <p className="text-muted-foreground text-sm">
                No reports are awaiting your approval at this time.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingReports.map((report) => (
                <div key={report.id} className="space-y-0">
                  <div
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedId(expandedId === report.id ? null : report.id)
                    }
                  >
                    <SemReportCard report={report} showStaffInfo />
                  </div>
                  {expandedId === report.id && (
                    <Card className="border-t-0 rounded-t-none pt-4 p-6">
                      <SemReportDetail report={report}>
                        <ReviewActions
                          onApprove={() => handleApprove(report.id)}
                          onReject={(reason) => handleReject(report.id, reason)}
                          isLoading={reviewLoading}
                        />
                      </SemReportDetail>
                    </Card>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {otherReports.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">No Other Reports</h3>
              <p className="text-muted-foreground text-sm">
                No other reports found with the selected filter.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {otherReports.map((report) => (
                <div key={report.id} className="space-y-0">
                  <div
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedId(expandedId === report.id ? null : report.id)
                    }
                  >
                    <SemReportCard report={report} showStaffInfo />
                  </div>
                  {expandedId === report.id && (
                    <Card className="border-t-0 rounded-t-none pt-4 p-6">
                      <SemReportDetail report={report} />
                    </Card>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
