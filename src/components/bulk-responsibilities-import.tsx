"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
    Loader2,
    Upload,
    CheckCircle2,
    AlertCircle,
    Download,
    FileSpreadsheet,
    Briefcase,
} from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { useAuth } from "@/components/providers/auth-context"
import { format } from "date-fns"
import * as xlsx from "xlsx"

interface ImportedResponsibility {
    title: string
    description?: string
    cycle: string
    startDate?: string
    endDate?: string
}

interface BulkImportResult {
    success: number
    failed: number
    errors: Array<{
        row: number
        title: string
        error: string
    }>
    responsibilities: Array<{
        id: string
        title: string
        cycle: string
    }>
}

interface BulkResponsibilitiesImportProps {
    onSuccess?: () => void
}

export default function BulkResponsibilitiesImport({ onSuccess }: BulkResponsibilitiesImportProps) {
    const { user } = useAuth()
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [importResult, setImportResult] = useState<BulkImportResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [parsedData, setParsedData] = useState<ImportedResponsibility[]>([])
    const [isParsed, setIsParsed] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const downloadTemplate = () => {
        const currentCycle = format(new Date(), "yyyy-MM")
        const data = [
            { title: "Morning Briefing", description: "Daily morning team briefing session", cycle: currentCycle, startDate: "", endDate: "" },
            { title: "Report Submission", description: "Weekly status report submission", cycle: currentCycle, startDate: "2024-01-01", endDate: "2024-12-31" },
            { title: "Client Meetings", description: "Handle client communication and meetings", cycle: currentCycle, startDate: "", endDate: "" },
            { title: "Documentation", description: "Update project documentation", cycle: currentCycle, startDate: "", endDate: "" }
        ]
        
        const ws = xlsx.utils.json_to_sheet(data)
        const wb = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(wb, ws, "Responsibilities")
        xlsx.writeFile(wb, "responsibilities_import_template.xlsx")
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
        const isCsv = file.name.endsWith('.csv')
        
        if (!isExcel && !isCsv) {
            setError('Please upload an Excel (.xlsx) or CSV file')
            return
        }

        setError(null)
        setImportResult(null)
        setParsedData([])
        setIsParsed(false)

        try {
            const buffer = await file.arrayBuffer()
            // cellDates: true converts Excel serial dates to JS Date objects
            const workbook = xlsx.read(buffer, { type: 'array', cellDates: true })
            const sheetName = workbook.SheetNames[0]
            const sheet = workbook.Sheets[sheetName]
            
            // raw json data
            const rawData = xlsx.utils.sheet_to_json<Record<string, any>>(sheet)
            
            if (rawData.length === 0) {
                setError('No valid responsibilities found in file. Make sure it has a header row and data.')
                return
            }

            const responsibilities: ImportedResponsibility[] = []
            
            // Helper to format JS Dates back to YYYY-MM-DD
            const formatDate = (val: any) => {
                if (!val) return ''
                if (val instanceof Date) {
                    return format(val, 'yyyy-MM-dd')
                }
                return String(val).trim()
            }

            // Case-insensitive header matching
            for (const row of rawData) {
                const normalizedRow: Record<string, string> = {}
                for (const key of Object.keys(row)) {
                    normalizedRow[key.trim().toLowerCase()] = formatDate(row[key])
                }

                if (normalizedRow.title) {
                    responsibilities.push({
                        title: normalizedRow.title,
                        description: normalizedRow.description || undefined,
                        cycle: normalizedRow.cycle || format(new Date(), "yyyy-MM"),
                        startDate: normalizedRow.startdate || undefined,
                        endDate: normalizedRow.enddate || undefined,
                    })
                }
            }

            if (responsibilities.length === 0) {
                setError('No valid responsibilities found. The file must have a "title" column.')
                return
            }

            setParsedData(responsibilities)
            setIsParsed(true)
        } catch (err) {
            console.error('Error parsing file:', err)
            setError('Failed to parse file. Make sure it is a valid Excel or CSV file.')
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    /**
     * Retry wrapper: retries a given async operation up to maxRetries times
     * with exponential backoff. Only retries on network/transient errors.
     */
    const withRetry = async <T,>(
        fn: () => Promise<T>,
        maxRetries: number = 4,
    ): Promise<T> => {
        let lastError: any
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn()
            } catch (err: any) {
                lastError = err
                const isNetworkError =
                    err instanceof TypeError || // fetch network failure
                    err?.statusCode === 0 ||
                    err?.statusCode >= 500 ||
                    err?.message?.toLowerCase()?.includes('network') ||
                    err?.message?.toLowerCase()?.includes('fetch')

                if (!isNetworkError || attempt === maxRetries) {
                    throw err
                }

                // Exponential backoff: 500ms, 1s, 2s, 4s
                const delay = 500 * Math.pow(2, attempt)
                await new Promise(resolve => setTimeout(resolve, delay))
            }
        }
        throw lastError
    }

    /**
     * Build a unique signature for a responsibility row so we can detect
     * true duplicates (all columns identical) vs. rows that share a title
     * but differ in other fields.
     */
    const getRowSignature = (item: ImportedResponsibility): string => {
        return [
            item.title.trim().toLowerCase(),
            (item.description || '').trim().toLowerCase(),
            item.cycle.trim(),
            (item.startDate || '').trim(),
            (item.endDate || '').trim(),
        ].join('|||')
    }

    const handleImport = async () => {
        if (!user || parsedData.length === 0) return

        setIsUploading(true)
        setError(null)
        setUploadProgress(0)

        const result: BulkImportResult = {
            success: 0,
            failed: 0,
            errors: [],
            responsibilities: [],
        }

        // 1. Deduplicate rows within the uploaded file by full-row signature.
        //    Keep only the first occurrence of each unique row.
        const seenSignatures = new Set<string>()
        const uniqueRows: { item: ImportedResponsibility; originalIndex: number }[] = []
        const skippedFiledupes: { row: number; title: string }[] = []

        for (let i = 0; i < parsedData.length; i++) {
            const sig = getRowSignature(parsedData[i])
            if (seenSignatures.has(sig)) {
                skippedFiledupes.push({ row: i + 2, title: parsedData[i].title })
            } else {
                seenSignatures.add(sig)
                uniqueRows.push({ item: parsedData[i], originalIndex: i })
            }
        }

        // 2. Pre-fetch existing responsibilities to detect DB-level duplicates.
        //    A row is a "DB duplicate" only if ALL columns match an existing record.
        let existingResponsibilities: Array<{
            title: string
            description?: string | null
            cycle: string
            startDate?: string | null
            endDate?: string | null
        }> = []

        try {
            const fetched = await withRetry(() => api.responsibilities.getAll({ includeExpired: true }))
            existingResponsibilities = fetched.map(r => ({
                title: r.title,
                description: r.description,
                cycle: r.cycle,
                startDate: r.startDate ? r.startDate.toString().split('T')[0] : null,
                endDate: r.endDate ? r.endDate.toString().split('T')[0] : null,
            }))
        } catch {
            // If we can't fetch existing data, proceed without duplicate checking.
            // The backend will reject true duplicates if there are DB constraints.
        }

        const existingSignatures = new Set(
            existingResponsibilities.map(r =>
                [
                    r.title.trim().toLowerCase(),
                    (r.description || '').trim().toLowerCase(),
                    r.cycle.trim(),
                    (r.startDate || '').trim(),
                    (r.endDate || '').trim(),
                ].join('|||')
            )
        )

        // 3. Process each unique row, skipping DB duplicates, retrying on network errors.
        const totalItems = parsedData.length // Use original count for progress
        let processed = skippedFiledupes.length // Count file-dupes as already processed

        // Report file-level duplicates as skipped (not errors)
        for (const dupe of skippedFiledupes) {
            result.failed++
            result.errors.push({
                row: dupe.row,
                title: dupe.title,
                error: 'Duplicate row in file (identical to an earlier row) — skipped',
            })
        }

        for (const { item, originalIndex } of uniqueRows) {
            const sig = getRowSignature(item)

            // Skip if an identical responsibility already exists in the DB
            if (existingSignatures.has(sig)) {
                result.failed++
                result.errors.push({
                    row: originalIndex + 2,
                    title: item.title,
                    error: 'Responsibility with identical title, description, cycle, and dates already exists — skipped',
                })
                processed++
                setUploadProgress(Math.round((processed / totalItems) * 100))
                continue
            }

            try {
                const created = await withRetry(() =>
                    api.responsibilities.create({
                        title: item.title,
                        description: item.description,
                        cycle: item.cycle,
                        startDate: item.startDate,
                        endDate: item.endDate,
                        createdBy: { connect: { id: parseInt(user.id) } },
                        subDepartment: { connect: { id: parseInt(user.subDepartmentId || '0') } },
                    })
                )

                result.success++
                result.responsibilities.push({
                    id: created.id,
                    title: created.title,
                    cycle: created.cycle,
                })

                // Add to existing set so subsequent rows in the same batch
                // don't create duplicates either
                existingSignatures.add(sig)
            } catch (err: any) {
                result.failed++
                result.errors.push({
                    row: originalIndex + 2,
                    title: item.title,
                    error: err.message || 'Failed to create responsibility',
                })
            }

            processed++
            setUploadProgress(Math.round((processed / totalItems) * 100))
        }

        setImportResult(result)
        setIsUploading(false)
        setParsedData([])
        setIsParsed(false)

        if (result.success > 0) {
            toast.success(`Successfully imported ${result.success} responsibilities`)
        }
        if (result.failed > 0) {
            toast.error(`Failed to import ${result.failed} responsibilities`)
        }
    }

    const handleFinish = () => {
        setImportResult(null)
        setParsedData([])
        setIsParsed(false)
        setError(null)
        setUploadProgress(0)
        if (onSuccess) {
            onSuccess()
        }
    }

    const resetState = () => {
        setImportResult(null)
        setParsedData([])
        setIsParsed(false)
        setError(null)
        setUploadProgress(0)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Bulk Import Responsibilities</h3>
            </div>

            {/* Instructions */}
            <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription>
                    <div className="space-y-2">
                        <p className="font-medium">Import Instructions:</p>
                        <ul className="list-disc list-inside text-sm space-y-1">
                            <li><strong>Supported Formats:</strong> Excel (.xlsx, .xls) and CSV (.csv)</li>
                            <li><strong>Required:</strong> title (responsibility name)</li>
                            <li><strong>Optional:</strong> description, cycle (YYYY-MM), startDate, endDate</li>
                            <li>If cycle is not provided, current month will be used</li>
                            <li>Date format: YYYY-MM-DD</li>
                        </ul>
                    </div>
                </AlertDescription>
            </Alert>

            {/* Download Template Button */}
            <div className="flex items-center gap-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={downloadTemplate}
                    className="gap-2"
                >
                    <Download className="h-4 w-4" />
                    Download Sample Excel
                </Button>
            </div>

            {/* File Upload */}
            {!isParsed && !importResult && (
                <div className="space-y-2">
                    <Label htmlFor="responsibilities-upload-file" className="text-base font-medium">
                        Upload Excel or CSV File
                    </Label>
                    <Input
                        ref={fileInputRef}
                        id="responsibilities-upload-file"
                        type="file"
                        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                        onChange={handleFileChange}
                        disabled={isUploading}
                        className="cursor-pointer"
                    />
                </div>
            )}

            {/* Error Message */}
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Parsed Data Preview */}
            {isParsed && parsedData.length > 0 && !importResult && (
                <div className="space-y-4">
                    <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                        <FileSpreadsheet className="h-4 w-4 text-foreground" />
                        <AlertDescription>
                            <div className="font-medium text-blue-900 dark:text-blue-100">
                                Found {parsedData.length} responsibilities to import
                            </div>
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                Review the data below and click "Import All" to proceed.
                            </p>
                        </AlertDescription>
                    </Alert>

                    <ScrollArea className="h-64 rounded-md border">
                        <Table>
                            <TableHeader className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                                <TableRow>
                                    <TableHead className="w-[50px]">#</TableHead>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Cycle</TableHead>
                                    <TableHead>Start Date</TableHead>
                                    <TableHead>End Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {parsedData.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium text-gray-500">
                                            {index + 1}
                                        </TableCell>
                                        <TableCell className="font-medium">{item.title}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                            {item.description || '-'}
                                        </TableCell>
                                        <TableCell>{item.cycle}</TableCell>
                                        <TableCell>{item.startDate || '-'}</TableCell>
                                        <TableCell>{item.endDate || '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={resetState}>
                            Cancel
                        </Button>
                        <Button onClick={handleImport} disabled={isUploading} className="gap-2">
                            {isUploading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Upload className="h-4 w-4" />
                            )}
                            Import All ({parsedData.length})
                        </Button>
                    </div>
                </div>
            )}

            {/* Upload Progress */}
            {isUploading && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Importing responsibilities...</span>
                        <span className="font-medium">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                </div>
            )}

            {/* Import Result */}
            {importResult && (
                <div className="space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-4">
                        <Alert className="bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800">
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertDescription>
                                <div className="font-medium">Successfully Created</div>
                                <div className="text-2xl  mt-1">{importResult.success}</div>
                            </AlertDescription>
                        </Alert>

                        {importResult.failed > 0 && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    <div className="font-medium">Failed</div>
                                    <div className="text-2xl  mt-1">{importResult.failed}</div>
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    {/* Created Responsibilities */}
                    {importResult.responsibilities.length > 0 && (
                        <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                            <CheckCircle2 className="h-4 w-4 text-foreground" />
                            <AlertDescription>
                                <div className="space-y-3">
                                    <p className=" text-green-900 dark:text-green-100">
                                        Created Responsibilities:
                                    </p>

                                    <ScrollArea className="h-48 rounded-md border bg-white dark:bg-gray-900">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                                                <TableRow>
                                                    <TableHead className="w-[50px]">#</TableHead>
                                                    <TableHead>Title</TableHead>
                                                    <TableHead>Cycle</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {importResult.responsibilities.map((resp, index) => (
                                                    <TableRow key={resp.id}>
                                                        <TableCell className="font-medium text-gray-500">
                                                            {index + 1}
                                                        </TableCell>
                                                        <TableCell className="font-medium">{resp.title}</TableCell>
                                                        <TableCell>{resp.cycle}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Error Details */}
                    {importResult.errors.length > 0 && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                <div className="font-medium mb-2">Import Errors:</div>
                                <ScrollArea className="h-48">
                                    <div className="space-y-2">
                                        {importResult.errors.map((err, index) => (
                                            <div key={index} className="text-sm border-l-2 border-red-500 pl-2">
                                                <div className="font-medium">Row {err.row}: {err.title}</div>
                                                <div className="text-foreground dark:text-red-400">{err.error}</div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Finish Button */}
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button
                            onClick={handleFinish}
                            className="gap-2"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            Finish & Close
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
