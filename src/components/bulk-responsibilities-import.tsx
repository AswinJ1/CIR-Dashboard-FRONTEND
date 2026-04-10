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
        const csvContent = `title,description,cycle,startDate,endDate
Morning Briefing,Daily morning team briefing session,${currentCycle},,
Report Submission,Weekly status report submission,${currentCycle},2024-01-01,2024-12-31
Client Meetings,Handle client communication and meetings,${currentCycle},,
Documentation,Update project documentation,${currentCycle},,`

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'responsibilities_import_template.csv'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
    }

    const parseCSV = (text: string): ImportedResponsibility[] => {
        const lines = text.trim().split('\n')
        if (lines.length < 2) return []

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
        const responsibilities: ImportedResponsibility[] = []

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
            const row: Record<string, string> = {}

            headers.forEach((header, index) => {
                row[header] = values[index] || ''
            })

            if (row.title) {
                responsibilities.push({
                    title: row.title,
                    description: row.description || undefined,
                    cycle: row.cycle || format(new Date(), "yyyy-MM"),
                    startDate: row.startdate || undefined,
                    endDate: row.enddate || undefined,
                })
            }
        }

        return responsibilities
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.name.endsWith('.csv')) {
            setError('Please upload a CSV file')
            return
        }

        setError(null)
        setImportResult(null)
        setParsedData([])
        setIsParsed(false)

        try {
            const text = await file.text()
            const parsed = parseCSV(text)

            if (parsed.length === 0) {
                setError('No valid responsibilities found in CSV. Make sure the file has a header row and data.')
                return
            }

            setParsedData(parsed)
            setIsParsed(true)
        } catch (err) {
            console.error('Error parsing CSV:', err)
            setError('Failed to parse CSV file')
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
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

        const totalItems = parsedData.length
        let processed = 0

        for (let i = 0; i < parsedData.length; i++) {
            const item = parsedData[i]

            try {
                const created = await api.responsibilities.create({
                    title: item.title,
                    description: item.description,
                    cycle: item.cycle,
                    startDate: item.startDate,
                    endDate: item.endDate,
                    createdBy: { connect: { id: parseInt(user.id) } },
                    subDepartment: { connect: { id: parseInt(user.subDepartmentId || '0') } },
                })

                result.success++
                result.responsibilities.push({
                    id: created.id,
                    title: created.title,
                    cycle: created.cycle,
                })
            } catch (err: any) {
                result.failed++
                result.errors.push({
                    row: i + 2, // +2 for header and 0-index
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
                        <p className="font-medium">CSV Import Instructions:</p>
                        <ul className="list-disc list-inside text-sm space-y-1">
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
                    Download Sample CSV
                </Button>
            </div>

            {/* File Upload */}
            {!isParsed && !importResult && (
                <div className="space-y-2">
                    <Label htmlFor="responsibilities-csv-file" className="text-base font-medium">
                        Upload CSV File
                    </Label>
                    <Input
                        ref={fileInputRef}
                        id="responsibilities-csv-file"
                        type="file"
                        accept=".csv"
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
                        <FileSpreadsheet className="h-4 w-4 text-blue-600" />
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
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
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
                                                <div className="text-red-600 dark:text-red-400">{err.error}</div>
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
