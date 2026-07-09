"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { SubmissionStatusBadge } from "@/components/ui/status-badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Clock, FileText, Link2, Upload, Lock, User, Building } from "lucide-react"
import { Assignment, WorkSubmission } from "@/types/cir"

export type WorkProofType = 'TEXT' | 'FILE' | 'URL'

export interface DailyWorkEntry {
    assignmentId: number
    responsibilityTitle: string
    responsibilityDescription?: string
    isStaffCreated: boolean
    hoursWorked: number
    workDescription: string
    workProofType: WorkProofType
    workProofText: string
    workProofUrl: string
    existingSubmission?: WorkSubmission
}

interface DailyWorkCardProps {
    entry: DailyWorkEntry
    isLocked: boolean
    onChange: (assignmentId: number, field: keyof DailyWorkEntry, value: string | number) => void
}

export function DailyWorkCard({ entry, isLocked, onChange }: DailyWorkCardProps) {
    const isSubmitted = !!entry.existingSubmission
    const submissionStatus = entry.existingSubmission?.assignment?.status

    return (
        <Card className={`transition-all ${isLocked ? 'opacity-75' : ''} ${
            submissionStatus === 'VERIFIED' ? 'border-green-200 dark:border-green-800' :
            submissionStatus === 'REJECTED' ? 'border-red-200 dark:border-red-800' :
            isSubmitted ? 'border-blue-200 dark:border-blue-800' : ''
        }`}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                            {entry.responsibilityTitle}
                            {entry.isStaffCreated && (
                                <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                                    Self-added
                                </span>
                            )}
                        </CardTitle>
                        {entry.responsibilityDescription && (
                            <p className="text-sm text-muted-foreground mt-1">
                                {entry.responsibilityDescription}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {isLocked && <Lock className="h-4 w-4 text-muted-foreground" />}
                        {isSubmitted && submissionStatus && (
                            <SubmissionStatusBadge status={submissionStatus as any} />
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Hours Input */}
                <div className="space-y-2">
                    <Label htmlFor={`hours-${entry.assignmentId}`} className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Hours Worked
                    </Label>
                    <Input
                        id={`hours-${entry.assignmentId}`}
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        value={entry.hoursWorked || ''}
                        onChange={(e) => onChange(entry.assignmentId, 'hoursWorked', parseFloat(e.target.value) || 0)}
                        disabled={isLocked}
                        placeholder="0"
                        className="w-32"
                    />
                </div>

                {/* Work Description */}
                <div className="space-y-2">
                    <Label htmlFor={`desc-${entry.assignmentId}`} className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Work Description
                    </Label>
                    <Textarea
                        id={`desc-${entry.assignmentId}`}
                        value={entry.workDescription}
                        onChange={(e) => onChange(entry.assignmentId, 'workDescription', e.target.value)}
                        disabled={isLocked}
                        placeholder="Describe the work you did..."
                        rows={3}
                    />
                </div>

                {/* Work Proof */}
                <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Work Proof (Optional)
                    </Label>
                    <div className="flex gap-2">
                        <Select
                            value={entry.workProofType}
                            onValueChange={(value) => onChange(entry.assignmentId, 'workProofType', value)}
                            disabled={isLocked}
                        >
                            <SelectTrigger className="w-32">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="TEXT">Text</SelectItem>
                                <SelectItem value="URL">URL</SelectItem>
                                <SelectItem value="FILE">File</SelectItem>
                            </SelectContent>
                        </Select>

                        {entry.workProofType === 'TEXT' && (
                            <Textarea
                                value={entry.workProofText}
                                onChange={(e) => onChange(entry.assignmentId, 'workProofText', e.target.value)}
                                disabled={isLocked}
                                placeholder="Enter proof details..."
                                className="flex-1"
                                rows={2}
                            />
                        )}

                        {entry.workProofType === 'URL' && (
                            <Input
                                type="url"
                                value={entry.workProofUrl}
                                onChange={(e) => onChange(entry.assignmentId, 'workProofUrl', e.target.value)}
                                disabled={isLocked}
                                placeholder="https://..."
                                className="flex-1"
                            />
                        )}

                        {entry.workProofType === 'FILE' && (
                            <div className="flex-1">
                                <Input
                                    type="file"
                                    disabled={isLocked}
                                    accept=".pdf,.png,.jpg,.jpeg"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Accepted: PDF, PNG, JPG (max 5MB)
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Rejection Reason if rejected */}
                {submissionStatus === 'REJECTED' && entry.existingSubmission?.rejectionReason && (
                    <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="text-sm font-medium text-red-700 dark:text-red-400">Rejection Reason:</p>
                        <p className="text-sm text-foreground dark:text-red-400 mt-1">
                            {entry.existingSubmission.rejectionReason}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
