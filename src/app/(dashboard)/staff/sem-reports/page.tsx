"use client"

import { useState, useEffect, useCallback } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  Plus,
  ArrowLeft,
  Loader2,
  Save,
  Send,
  Trash2,
  LinkIcon,
  X,
  CalendarIcon,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/providers/auth-context"
import { api } from "@/lib/api"
import { SemReportCard } from "@/components/sem-reports/sem-report-card"
import { SemReportDetail } from "@/components/sem-reports/sem-report-detail"
import { TagInput } from "@/components/sem-reports/tag-input"
import type { SemReport, CreateSemReportItemDto } from "@/types/cir"

// ─── Types for Form State ───
interface ItemFormState {
  type: "BATCH" | "RESPONSIBILITY"
  name: string
  description: string
  urls: string[]
}

type ViewMode = "list" | "create" | "edit" | "view"

export default function StaffSemReportsPage() {
  const { user } = useAuth()

  // ─── State ───
  const [reports, setReports] = useState<SemReport[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [editingReport, setEditingReport] = useState<SemReport | null>(null)
  const [viewingReport, setViewingReport] = useState<SemReport | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  // ─── Form State ───
  const [semesterStartDate, setSemesterStartDate] = useState<Date>()
  const [semesterEndDate, setSemesterEndDate] = useState<Date>()
  const [batchTags, setBatchTags] = useState<string[]>([])
  const [respTags, setRespTags] = useState<string[]>([])
  const [itemForms, setItemForms] = useState<Record<string, ItemFormState>>({})

  // ─── Fetch Reports ───
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.semReports.getMyReports()
      setReports(data)
    } catch (err: any) {
      toast.error(err?.message || "Failed to load reports")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  // ─── Sync itemForms when tags change ───
  useEffect(() => {
    setItemForms((prev) => {
      const next: Record<string, ItemFormState> = {}
      for (const tag of batchTags) {
        const key = `BATCH:${tag}`
        next[key] = prev[key] || { type: "BATCH", name: tag, description: "", urls: [] }
      }
      for (const tag of respTags) {
        const key = `RESPONSIBILITY:${tag}`
        next[key] = prev[key] || { type: "RESPONSIBILITY", name: tag, description: "", urls: [] }
      }
      return next
    })
  }, [batchTags, respTags])

  // ─── Reset Form ───
  const resetForm = () => {
    setSemesterStartDate(undefined)
    setSemesterEndDate(undefined)
    setBatchTags([])
    setRespTags([])
    setItemForms({})
    setEditingReport(null)
  }

  // ─── Populate Form for Edit ───
  const populateForm = (report: SemReport) => {
    setSemesterStartDate(new Date(report.semesterStartDate))
    setSemesterEndDate(new Date(report.semesterEndDate))

    const batches = report.items.filter((i) => i.type === "BATCH").map((i) => i.name)
    const resps = report.items.filter((i) => i.type === "RESPONSIBILITY").map((i) => i.name)
    setBatchTags(batches)
    setRespTags(resps)

    const forms: Record<string, ItemFormState> = {}
    for (const item of report.items) {
      const key = `${item.type}:${item.name}`
      forms[key] = {
        type: item.type,
        name: item.name,
        description: item.description || "",
        urls: item.attachments.map((a) => a.fileUrl),
      }
    }
    setItemForms(forms)
    setEditingReport(report)
  }

  // ─── URL Management ───
  const addUrl = (key: string) => {
    setItemForms((prev) => ({
      ...prev,
      [key]: { ...prev[key], urls: [...prev[key].urls, ""] },
    }))
  }

  const updateUrl = (key: string, idx: number, value: string) => {
    setItemForms((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        urls: prev[key].urls.map((u, i) => (i === idx ? value : u)),
      },
    }))
  }

  const removeUrl = (key: string, idx: number) => {
    setItemForms((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        urls: prev[key].urls.filter((_, i) => i !== idx),
      },
    }))
  }

  const updateDescription = (key: string, desc: string) => {
    setItemForms((prev) => ({
      ...prev,
      [key]: { ...prev[key], description: desc },
    }))
  }

  // ─── Validation ───
  const validateForm = (): string | null => {
    if (!semesterStartDate) return "Semester start date is required"
    if (!semesterEndDate) return "Semester end date is required"
    if (semesterStartDate >= semesterEndDate) return "Start date must be before end date"
    if (batchTags.length === 0 && respTags.length === 0)
      return "At least one batch or responsibility is required"

    // Each batch must have at least one non-empty URL
    for (const tag of batchTags) {
      const key = `BATCH:${tag}`
      const form = itemForms[key]
      const validUrls = form?.urls?.filter((u) => u.trim()) || []
      if (validUrls.length === 0) {
        return `Batch "${tag}" requires at least one attachment URL`
      }
    }
    return null
  }

  // ─── Build DTO ───
  const buildItems = (): CreateSemReportItemDto[] => {
    return Object.values(itemForms).map((form) => ({
      type: form.type,
      name: form.name,
      description: form.description || undefined,
      attachmentUrls: form.urls.filter((u) => u.trim()) || undefined,
    }))
  }

  // ─── Submit ───
  const handleSubmit = async (asDraft: boolean) => {
    const error = asDraft ? null : validateForm()
    // For drafts, minimal validation
    if (!asDraft && error) {
      toast.error(error)
      return
    }
    if (!semesterStartDate || !semesterEndDate) {
      toast.error("Please select semester dates")
      return
    }
    if (batchTags.length === 0 && respTags.length === 0) {
      toast.error("Add at least one batch or responsibility")
      return
    }

    try {
      setSubmitting(true)
      const items = buildItems()
      const payload = {
        semesterStartDate: semesterStartDate.toISOString(),
        semesterEndDate: semesterEndDate.toISOString(),
        items,
        status: asDraft ? ("DRAFT" as const) : ("SUBMITTED" as const),
      }

      if (editingReport) {
        await api.semReports.update(editingReport.id, payload)
        toast.success(asDraft ? "Report saved as draft" : "Report submitted for review")
      } else {
        await api.semReports.create(payload)
        toast.success(asDraft ? "Report saved as draft" : "Report submitted for review")
      }

      resetForm()
      setViewMode("list")
      fetchReports()
    } catch (err: any) {
      toast.error(err?.message || "Failed to save report")
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Delete ───
  const handleDelete = async (report: SemReport) => {
    try {
      setDeleting(report.id)
      await api.semReports.delete(report.id)
      toast.success("Draft report deleted")
      fetchReports()
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete report")
    } finally {
      setDeleting(null)
    }
  }

  // ─── Render: Loading ───
  if (loading && viewMode === "list") {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    )
  }

  // ─── Render: View Detail ───
  if (viewMode === "view" && viewingReport) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Button
          variant="ghost"
          onClick={() => {
            setViewMode("list")
            setViewingReport(null)
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
        </Button>
        <SemReportDetail report={viewingReport} />
      </div>
    )
  }

  // ─── Render: Create / Edit Form ───
  if (viewMode === "create" || viewMode === "edit") {
    const allKeys = [
      ...batchTags.map((t) => `BATCH:${t}`),
      ...respTags.map((t) => `RESPONSIBILITY:${t}`),
    ]

    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => {
              resetForm()
              setViewMode("list")
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <h1 className="text-xl ">
            {viewMode === "edit" ? "Edit Semester Report" : "Create Semester Report"}
          </h1>
        </div>

        {/* Date Pickers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Semester Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date <span className="text-destructive">*</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !semesterStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {semesterStartDate ? format(semesterStartDate, "PPP") : "Select start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={semesterStartDate}
                      onSelect={setSemesterStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date <span className="text-destructive">*</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !semesterEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {semesterEndDate ? format(semesterEndDate, "PPP") : "Select end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={semesterEndDate}
                      onSelect={setSemesterEndDate}
                      disabled={(date) =>
                        semesterStartDate ? date <= semesterStartDate : false
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {semesterStartDate && semesterEndDate && semesterStartDate >= semesterEndDate && (
              <p className="text-sm text-destructive mt-2">Start date must be before end date</p>
            )}
          </CardContent>
        </Card>

        {/* Batches & Responsibilities Tags */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Batches & Responsibilities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>
                Batches Handled <span className="text-destructive">*</span>
              </Label>
              <TagInput
                tags={batchTags}
                onChange={setBatchTags}
                placeholder="e.g. S5CSE, S3CSE — type and press Enter"
                forceUppercase
              />
              <p className="text-xs text-muted-foreground">
                Enter batch names (auto-converted to uppercase). Press Enter or comma to add.
              </p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Additional Responsibilities</Label>
              <TagInput
                tags={respTags}
                onChange={setRespTags}
                placeholder="e.g. SSR, Placement, Attendance — type and press Enter"
              />
              <p className="text-xs text-muted-foreground">
                Optional. Enter any additional responsibilities like SSR, Placement, etc.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Report Sections */}
        {allKeys.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Report Sections</h2>
            {allKeys.map((key) => {
              const form = itemForms[key]
              if (!form) return null
              const isBatch = form.type === "BATCH"
              return (
                <Card key={key} className={cn(
                  "border-l-4",
                  isBatch ? "border-l-blue-500" : "border-l-purple-500"
                )}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Badge variant="outline" className={cn(
                        "text-xs",
                        isBatch
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-purple-50 text-purple-700 border-purple-200"
                      )}>
                        {form.type}
                      </Badge>
                      {form.name} {isBatch ? "Batch" : ""} Report
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Description */}
                    <div className="space-y-2">
                      <Label className="text-sm">Description</Label>
                      <Textarea
                        placeholder={`Describe your work for ${form.name}...`}
                        value={form.description}
                        onChange={(e) => updateDescription(key, e.target.value)}
                        rows={3}
                      />
                    </div>

                    {/* URLs */}
                    <div className="space-y-2">
                      <Label className="text-sm">
                        Attachment URLs
                        {isBatch && <span className="text-destructive"> *</span>}
                      </Label>
                      {form.urls.map((url, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              className="pl-9"
                              placeholder="https://drive.google.com/..."
                              value={url}
                              onChange={(e) => updateUrl(key, idx, e.target.value)}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive shrink-0"
                            onClick={() => removeUrl(key, idx)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addUrl(key)}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add URL
                      </Button>
                      {isBatch && form.urls.filter((u) => u.trim()).length === 0 && (
                        <p className="text-xs text-destructive">
                          At least one attachment URL is required for batch reports.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex items-center gap-3 pt-2 pb-8">
          <Button
            variant="outline"
            disabled={submitting}
            onClick={() => handleSubmit(true)}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save as Draft
          </Button>
          <Button disabled={submitting} onClick={() => handleSubmit(false)}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Submit for Review
          </Button>
        </div>
      </div>
    )
  }

  // ─── Render: Report List ───
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl ">Semester Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create, manage, and track your semester reports.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setViewMode("create") }}>
          <Plus className="h-4 w-4 mr-2" /> New Report
        </Button>
      </div>

      <Separator />

      {/* Reports */}
      {reports.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">No Reports Yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Create your first semester report to get started.
          </p>
          <Button onClick={() => { resetForm(); setViewMode("create") }}>
            <Plus className="h-4 w-4 mr-2" /> Create Report
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <div key={report.id} className="relative">
              {deleting === report.id && (
                <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              <SemReportCard
                report={report}
                onView={(r) => {
                  setViewingReport(r)
                  setViewMode("view")
                }}
                onEdit={(r) => {
                  populateForm(r)
                  setViewMode("edit")
                }}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
