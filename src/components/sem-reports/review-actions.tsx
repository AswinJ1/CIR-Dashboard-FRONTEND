"use client"

import { useState } from "react"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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

interface ReviewActionsProps {
  onApprove: () => Promise<void>
  onReject: (reason: string) => Promise<void>
  isLoading?: boolean
}

export function ReviewActions({ onApprove, onReject, isLoading = false }: ReviewActionsProps) {
  const [rejectionReason, setRejectionReason] = useState("")
  const [showRejectForm, setShowRejectForm] = useState(false)

  const handleReject = async () => {
    if (!rejectionReason.trim()) return
    await onReject(rejectionReason.trim())
    setRejectionReason("")
    setShowRejectForm(false)
  }

  return (
    <div className="flex flex-col gap-4 pt-4 border-t">
      <h4 className="font-semibold text-sm">Review Actions</h4>
      <div className="flex items-center gap-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={isLoading} className="bg-green-600 hover:bg-green-700">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Approve
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Approve this report?</AlertDialogTitle>
              <AlertDialogDescription>
                This action will advance the report to the next stage in the review workflow.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onApprove}
                className="bg-green-600 hover:bg-green-700"
              >
                Approve
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          variant="destructive"
          disabled={isLoading}
          onClick={() => setShowRejectForm(!showRejectForm)}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <XCircle className="h-4 w-4 mr-2" />
          )}
          Reject
        </Button>
      </div>

      {showRejectForm && (
        <div className="space-y-3 p-4 border rounded-lg bg-red-50/50">
          <Label htmlFor="rejection-reason" className="text-sm font-medium">
            Rejection Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="rejection-reason"
            placeholder="Please provide a clear reason for rejection..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={!rejectionReason.trim() || isLoading}
              onClick={handleReject}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm Rejection
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowRejectForm(false)
                setRejectionReason("")
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
