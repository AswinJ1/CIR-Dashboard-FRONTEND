"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { WorkSubmission } from "@/types/cir"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SubmissionStatusBadge } from "@/components/ui/status-badge"
import { Clock, ArrowLeft, Link2, FileText } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

export default function SubmissionDetailsPage({
  params,
}: {
  params: { submissionId: string }  // âœ… CHANGED from assignmentId to submissionId
}) {
  const router = useRouter()
  const submissionId = params.submissionId  // âœ… CHANGED

  const [submission, setSubmission] = useState<WorkSubmission | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSubmission()
  }, [])

  async function fetchSubmission() {
    try {
      const data = await api.workSubmissions.getById(submissionId)  // âœ… Use submissionId
      setSubmission(data)
    } catch {
      toast.error("Failed to load submission")
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (!submission) return <div className="p-6">Submission not found</div>

  return (
    <div className="p-6 space-y-6">
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <h2 className="font-bold">Submission Details #{submission.id}</h2>

      <Card>
        <CardHeader>
          <CardTitle>
            {submission.assignment?.responsibility?.title}
          </CardTitle>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="flex gap-4">
              <span>{submission.staff?.name}</span>
              <span>{format(new Date(submission.submittedAt), "PPP p")}</span>
            </div>

            <SubmissionStatusBadge
              status={submission.status}
              className="border dark:border-white px-3 py-1 w-fit"
            />
          </div>

        </CardHeader>

        <CardContent className="space-y-4">
          {submission.hoursWorked && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {submission.hoursWorked} hours
            </div>
          )}

          <div>
            <p className="font-medium mb-1">Staff Comment</p>
            <p className="bg-muted p-3 rounded">
              {submission.staffComment || "No comments"}
            </p>
          </div>

          {(submission.workProofText || submission.workProofUrl) && (
            <div>
              <p className="font-medium mb-1 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Work Proof
              </p>
              {submission.workProofText && (
                <p className="bg-muted p-3 rounded">
                  {submission.workProofText}
                </p>
              )}
              {submission.workProofUrl && (
                <a
                  href={submission.workProofUrl}
                  target="_blank"
                  className="text-primary flex items-center gap-1 mt-2"
                >
                  <Link2 className="h-4 w-4" /> View attachment
                </a>
              )}
            </div>
          )}

          {/* Verification section removed - Staff cannot verify submissions */}
          {/* Only managers have access to approve/reject from their dashboard */}
        </CardContent>
      </Card>
    </div>
  )
}