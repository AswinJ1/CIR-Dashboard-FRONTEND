"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
import type { SemReport, Department, SubDepartment } from "@/types/cir"
import { useTranslation } from "react-i18next"

// Generate academic year options (e.g., "2025-2026", "2024-2025", ...)
function getAcademicYearOptions(): { label: string; startYear: number }[] {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() // 0-indexed
  // Academic year typically starts in June/July
  const startYear = currentMonth >= 5 ? currentYear : currentYear - 1
  const years: { label: string; startYear: number }[] = []
  for (let y = startYear; y >= startYear - 5; y--) {
    years.push({ label: `${y}-${y + 1}`, startYear: y })
  }
  return years
}

export default function AdminSemReportsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [reports, setReports] = useState<SemReport[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState<number | undefined>()
  const [selectedSubDeptId, setSelectedSubDeptId] = useState<string>("all")
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all")
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)

  const academicYears = useMemo(() => getAcademicYearOptions(), [])

  const fetchDepartments = useCallback(async () => {
    try {
      const data = await api.departments.getAll()
      setDepartments(data)
    } catch {
      // non-critical
    }
  }, [])

  const fetchSubDepartments = useCallback(async () => {
    try {
      const data = await api.subDepartments.getAll()
      setSubDepartments(data)
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
    fetchSubDepartments()
  }, [fetchDepartments, fetchSubDepartments])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  // Reset dependent filters when department changes
  useEffect(() => {
    setSelectedSubDeptId("all")
    setSelectedStaffId("all")
  }, [selectedDeptId])

  // Reset staff filter when sub-department changes
  useEffect(() => {
    setSelectedStaffId("all")
  }, [selectedSubDeptId])

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

  // Filter sub-departments based on selected department
  const filteredSubDepartments = useMemo(() => {
    if (!selectedDeptId) return subDepartments
    return subDepartments.filter((sd) => String(sd.departmentId) === String(selectedDeptId))
  }, [subDepartments, selectedDeptId])

  // Get unique staff from reports, filtered by sub-department
  const staffOptions = useMemo(() => {
    const staffMap = new Map<number, { id: number; name: string; subDepartmentId?: number | null }>()
    reports.forEach((r) => {
      if (r.staff) {
        staffMap.set(r.staff.id, {
          id: r.staff.id,
          name: r.staff.name,
          subDepartmentId: r.staff.subDepartmentId,
        })
      }
    })
    let staffList = Array.from(staffMap.values())
    if (selectedSubDeptId !== "all") {
      staffList = staffList.filter((s) => String(s.subDepartmentId) === selectedSubDeptId)
    }
    return staffList.sort((a, b) => a.name.localeCompare(b.name))
  }, [reports, selectedSubDeptId])

  // Apply all filters to reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      // Sub-department filter
      if (selectedSubDeptId !== "all" && String(r.staff?.subDepartmentId) !== selectedSubDeptId) {
        return false
      }
      // Staff filter
      if (selectedStaffId !== "all" && String(r.staff?.id) !== selectedStaffId) {
        return false
      }
      // Academic year filter
      if (selectedAcademicYear !== "all") {
        const ay = academicYears.find((y) => y.label === selectedAcademicYear)
        if (ay) {
          const reportStart = new Date(r.semesterStartDate)
          const ayStart = new Date(ay.startYear, 5, 1) // June 1
          const ayEnd = new Date(ay.startYear + 1, 4, 31) // May 31
          if (reportStart < ayStart || reportStart > ayEnd) {
            return false
          }
        }
      }
      return true
    })
  }, [reports, selectedSubDeptId, selectedStaffId, selectedAcademicYear, academicYears])

  const pendingReports = filteredReports.filter((r) => r.status === "UNDER_ADMIN_REVIEW")
  const otherReports = filteredReports.filter((r) => r.status !== "UNDER_ADMIN_REVIEW")

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
        <h1 className="text-2xl ">Semester Report Reviews</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review and provide final approval for semester reports across all departments.
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Department Filter */}
        <div className="space-y-1.5 w-full">
          <Label className="text-sm">Department</Label>
          <Select
            value={selectedDeptId?.toString() || "all"}
            onValueChange={(val) =>
              setSelectedDeptId(val === "all" ? undefined : parseInt(val))
            }
          >
            <SelectTrigger className="w-full">
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

        {/* Sub-Department Filter */}
        <div className="space-y-1.5 w-full">
          <Label className="text-sm">Sub Department</Label>
          <Select
            value={selectedSubDeptId}
            onValueChange={setSelectedSubDeptId}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Sub Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sub Departments</SelectItem>
              {filteredSubDepartments.map((sd) => (
                <SelectItem key={sd.id} value={sd.id.toString()}>
                  {sd.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Staff Filter */}
        <div className="space-y-1.5 w-full">
          <Label className="text-sm">Staff</Label>
          <Select
            value={selectedStaffId}
            onValueChange={setSelectedStaffId}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staffOptions.map((s) => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Academic Year Filter */}
        <div className="space-y-1.5 w-48">
          <Label className="text-sm">Academic Year</Label>
          <Select
            value={selectedAcademicYear}
            onValueChange={setSelectedAcademicYear}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {academicYears.map((ay) => (
                <SelectItem key={ay.label} value={ay.label}>
                  {ay.label}
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
                No other reports found with the selected filters.
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