"use client"

import { useState, useMemo, useEffect } from "react"
import { format, subDays, getDaysInMonth, getDay } from "date-fns"
import { Download, Calendar as CalendarIcon, Users, Building2, FileSpreadsheet, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

interface DateRange {
    from: Date
    to: Date
}

interface StaffMember {
    id: string | number
    name: string
    subDepartmentId?: string | number
    departmentId?: string | number
}

interface Department {
    id: string | number
    name: string
}

interface SubDepartment {
    id: string | number
    name: string
    departmentId?: string | number
}

interface Responsibility {
    id: string | number
    title: string
    description?: string
    subDepartmentId?: string | number
    isActive?: boolean
}

interface Assignment {
    id: string | number
    responsibilityId: string | number
    staffId: string | number
    responsibility?: Responsibility
}

interface WorkSubmission {
    id: string | number
    assignmentId: string | number
    staffId: string | number
    hoursWorked?: number
    workDate?: string
    workProofType?: 'PDF' | 'IMAGE' | 'TEXT'
    workProofUrl?: string
    workProofText?: string
    staffComment?: string
    managerComment?: string
    status: string
    submittedAt: string
    verifiedAt?: string
    description?: string
    remarks?: string
    assignment?: Assignment
}

// =====================================================
// work.xlsx FORMAT CONSTANTS
// =====================================================

// Column layout per week: [weekIndex][daySlot] => colIndex (1-indexed for ExcelJS)
const WEEK_DAY_COLS: number[][] = [
    [2, 3, 4, 5, 6, 7],      // B-G
    [10, 11, 12, 13, 14, 15], // J-O
    [17, 18, 19, 20, 21, 22], // Q-V
    [24, 25, 26, 27, 28, 29], // X-AC
    [31, 32, 33, 34, 35, 36], // AE-AJ
]

const WEEK_HEADER_RANGES: { s: number; e: number }[] = [
    { s: 2, e: 8 },   // B-H
    { s: 10, e: 15 },  // J-O
    { s: 17, e: 22 },  // Q-V
    { s: 24, e: 29 },  // X-AC
    { s: 31, e: 36 },  // AE-AJ
]

const REMARKS_COLS = [9, 16, 23, 30, 37] // I, P, W, AD, AK (1-indexed)
const LAST_COL = 38 // AL (1-indexed)

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/** Map day-of-month (1-31) to column index (1-indexed), returns -1 for skipped days */
function dayToCol(day: number): number {
    const weekIndex = Math.floor((day - 1) / 7)
    const dayInWeek = (day - 1) % 7
    if (dayInWeek === 6) return -1 // 7th day of each "week block" is skipped
    if (weekIndex >= 5) return -1
    return WEEK_DAY_COLS[weekIndex][dayInWeek]
}

/** Get list of {month, year} pairs covered by a date range */
function getMonthsInRange(from: Date, to: Date): { month: number; year: number }[] {
    const months: { month: number; year: number }[] = []
    let current = new Date(from.getFullYear(), from.getMonth(), 1)
    const end = new Date(to.getFullYear(), to.getMonth(), 1)
    while (current <= end) {
        months.push({ month: current.getMonth(), year: current.getFullYear() })
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
    }
    return months
}

// Color constants
const DARK_BLUE = 'FF1F4E79'
const MED_BLUE = 'FF2E75B6'
const YELLOW_BG = 'FFFFF2CC'
const WHITE = 'FFFFFFFF'
const LIGHT_GRAY = 'FFD9D9D9'
const BLACK = 'FF000000'

const THIN_BORDER = { style: 'thin' as const, color: { argb: BLACK } }
const GRAY_BORDER = { style: 'thin' as const, color: { argb: LIGHT_GRAY } }
const ALL_BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER }
const GRAY_BORDERS = { top: GRAY_BORDER, bottom: GRAY_BORDER, left: GRAY_BORDER, right: GRAY_BORDER }

/** Build a work.xlsx-formatted worksheet for one staff member + one month using ExcelJS */
function buildStaffSheet(
    workbook: any,
    sheetName: string,
    staffName: string,
    month: number,
    year: number,
    hoursMap: Map<string, Map<number, number>>,
    responsibilityTitles: string[]
) {
    const ws = workbook.addWorksheet(sheetName)
    const daysInMonth = getDaysInMonth(new Date(year, month))

    // Column widths: col A wide, day cols narrow
    const colWidths: { width: number }[] = [{ width: 48 }]
    for (let i = 1; i < LAST_COL; i++) colWidths.push({ width: 7 })
    ws.columns = colWidths.map((w: { width: number }) => ({ width: w.width }))

    // ---- HEADER ROWS (rows 1-5) ----
    const headerTexts = [
        "Corporate & Industry Relations, Amrita Vishwa Vidyapeetham, Amritapuri Campus",
        `Work Report for the Month of ${MONTH_NAMES[month]} ${year}`,
        `Faculty Name : ${staffName}`,
    ]
    for (let r = 1; r <= 5; r++) {
        const cell = ws.getCell(r, 1)
        cell.value = headerTexts[r - 1]
        cell.font = { bold: true, size: r <= 2 ? 13 : 11 }
        cell.alignment = { horizontal: 'left', vertical: 'middle' }
        ws.mergeCells(r, 1, r, LAST_COL)
    }

    // ---- ROW 6: Week headers ----
    const weekHeaderRow = 6
    const weekCell = ws.getCell(weekHeaderRow, 1)
    weekCell.value = "Week"
    weekCell.font = { bold: true, color: { argb: WHITE }, size: 11 }
    weekCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BLUE } }
    weekCell.alignment = { horizontal: 'center', vertical: 'middle' }
    weekCell.border = ALL_BORDERS

    for (let w = 0; w < 5; w++) {
        ws.mergeCells(weekHeaderRow, WEEK_HEADER_RANGES[w].s, weekHeaderRow, WEEK_HEADER_RANGES[w].e)
        const wCell = ws.getCell(weekHeaderRow, WEEK_HEADER_RANGES[w].s)
        wCell.value = `Week ${w + 1}`
        wCell.font = { bold: true, color: { argb: WHITE }, size: 11 }
        wCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MED_BLUE } }
        wCell.alignment = { horizontal: 'center', vertical: 'middle' }
        wCell.border = ALL_BORDERS

        // Remarks column header (merged rows 6-8)
        ws.mergeCells(weekHeaderRow, REMARKS_COLS[w], weekHeaderRow + 2, REMARKS_COLS[w])
        const rCell = ws.getCell(weekHeaderRow, REMARKS_COLS[w])
        rCell.value = "Remarks if any"
        rCell.font = { bold: true, color: { argb: WHITE }, size: 10 }
        rCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MED_BLUE } }
        rCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        rCell.border = ALL_BORDERS
    }

    // ---- ROW 7: Date numbers ----
    const dateRow = 7
    const dateLabel = ws.getCell(dateRow, 1)
    dateLabel.value = "Date"
    dateLabel.font = { bold: true, color: { argb: WHITE }, size: 11 }
    dateLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BLUE } }
    dateLabel.alignment = { horizontal: 'center', vertical: 'middle' }
    dateLabel.border = ALL_BORDERS

    for (let d = 1; d <= daysInMonth; d++) {
        const col = dayToCol(d)
        if (col !== -1) {
            const c = ws.getCell(dateRow, col)
            c.value = d
            c.font = { bold: true, color: { argb: WHITE }, size: 10 }
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BLUE } }
            c.alignment = { horizontal: 'center', vertical: 'middle' }
            c.border = ALL_BORDERS
        }
    }

    // ---- ROW 8: Day names + Key Responsibilities ----
    const dayNameRow = 8
    const keyRespCell = ws.getCell(dayNameRow, 1)
    keyRespCell.value = "Key Responsibilities"
    keyRespCell.font = { bold: true, color: { argb: WHITE }, size: 11 }
    keyRespCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BLUE } }
    keyRespCell.alignment = { horizontal: 'center', vertical: 'middle' }
    keyRespCell.border = ALL_BORDERS

    for (let d = 1; d <= daysInMonth; d++) {
        const col = dayToCol(d)
        if (col !== -1) {
            const dayOfWeek = getDay(new Date(year, month, d))
            const c = ws.getCell(dayNameRow, col)
            c.value = DAY_NAMES[dayOfWeek]
            c.font = { bold: true, color: { argb: WHITE }, size: 10 }
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BLUE } }
            c.alignment = { horizontal: 'center', vertical: 'middle' }
            c.border = ALL_BORDERS
        }
    }

    // ---- DYNAMIC RESPONSIBILITY ROWS ----
    let currentRow = 9
    const grandWeekTotals = [0, 0, 0, 0, 0]
    const dailyTotals = new Map<number, number>()

    for (const title of responsibilityTitles) {
        const labelCell = ws.getCell(currentRow, 1)
        labelCell.value = title
        labelCell.font = { size: 11 }
        labelCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
        labelCell.border = GRAY_BORDERS

        const normalizedTitle = title.toLowerCase().trim()
        const titleHours = hoursMap.get(normalizedTitle)
        if (titleHours) {
            for (const [day, hours] of titleHours) {
                const col = dayToCol(day)
                if (col !== -1) {
                    const c = ws.getCell(currentRow, col)
                    c.value = hours
                    c.alignment = { horizontal: 'center', vertical: 'middle' }
                    c.border = GRAY_BORDERS
                    const weekIdx = Math.floor((day - 1) / 7)
                    if (weekIdx < 5) grandWeekTotals[weekIdx] += hours
                    dailyTotals.set(day, (dailyTotals.get(day) || 0) + hours)
                }
            }
        }
        currentRow++
    }

    // ---- BOTTOM TOTAL ROWS ----
    const applyTotalStyle = (cell: any) => {
        cell.font = { bold: true, size: 11 }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_BG } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = ALL_BORDERS
    }

    // "Total work hours in a day" row
    const dayTotalLabel = ws.getCell(currentRow, 1)
    dayTotalLabel.value = "Total work hours in a day"
    applyTotalStyle(dayTotalLabel)
    dayTotalLabel.alignment = { horizontal: 'left', vertical: 'middle' }

    for (let d = 1; d <= daysInMonth; d++) {
        const col = dayToCol(d)
        if (col !== -1) {
            const c = ws.getCell(currentRow, col)
            c.value = dailyTotals.get(d) || 0
            applyTotalStyle(c)
        }
    }
    currentRow++

    // "Total work hours in a week" row
    const weekTotalLabel = ws.getCell(currentRow, 1)
    weekTotalLabel.value = "Total work hours in a week"
    applyTotalStyle(weekTotalLabel)
    weekTotalLabel.alignment = { horizontal: 'left', vertical: 'middle' }

    for (let w = 0; w < 5; w++) {
        ws.mergeCells(currentRow, WEEK_HEADER_RANGES[w].s, currentRow, WEEK_HEADER_RANGES[w].e)
        const c = ws.getCell(currentRow, WEEK_HEADER_RANGES[w].s)
        c.value = grandWeekTotals[w]
        applyTotalStyle(c)
    }
    currentRow++

    // "Total work hours in a month" row
    const monthTotal = grandWeekTotals.reduce((a, b) => a + b, 0)
    const monthTotalLabel = ws.getCell(currentRow, 1)
    monthTotalLabel.value = "Total work hours in a month"
    applyTotalStyle(monthTotalLabel)
    monthTotalLabel.alignment = { horizontal: 'left', vertical: 'middle' }

    ws.mergeCells(currentRow, 2, currentRow, LAST_COL)
    const monthTotalCell = ws.getCell(currentRow, 2)
    monthTotalCell.value = monthTotal
    applyTotalStyle(monthTotalCell)

    return ws
}

/** Group submissions for a specific month by responsibility title → day → hours */
function groupSubmissionsForMonth(
    submissions: WorkSubmission[],
    assignmentMap: Map<string, Assignment>,
    responsibilityMap: Map<string, Responsibility>,
    month: number,
    year: number,
): {
    hoursMap: Map<string, Map<number, number>>
    responsibilityTitles: string[]
} {
    const hoursMap = new Map<string, Map<number, number>>()
    const titleMap = new Map<string, string>()

    for (const s of submissions) {
        const date = new Date(s.workDate || s.submittedAt)
        // Only include submissions for this specific month
        if (date.getMonth() !== month || date.getFullYear() !== year) continue
        const dayOfMonth = date.getDate()
        const hours = s.hoursWorked || 0

        // Resolve responsibility title
        const nested = s.assignment?.responsibility
        const assignment = assignmentMap.get(String(s.assignmentId))
        const assignmentResp = assignment?.responsibility
        const lookupResp = assignment ? responsibilityMap.get(String(assignment.responsibilityId)) : undefined
        const responsibility = nested || assignmentResp || lookupResp
        const title = responsibility?.title || 'Unknown'
        const normalizedTitle = title.toLowerCase().trim()

        if (!titleMap.has(normalizedTitle)) titleMap.set(normalizedTitle, title)

        if (!hoursMap.has(normalizedTitle)) {
            hoursMap.set(normalizedTitle, new Map())
        }
        const dayMap = hoursMap.get(normalizedTitle)!
        dayMap.set(dayOfMonth, (dayMap.get(dayOfMonth) || 0) + hours)
    }

    const responsibilityTitles = Array.from(titleMap.values())
    return { hoursMap, responsibilityTitles }
}

/** Main export function: creates work.xlsx-formatted workbook with ExcelJS */
async function exportToWorkXlsx(
    staffEntries: { name: string; submissions: WorkSubmission[] }[],
    assignmentMap: Map<string, Assignment>,
    responsibilityMap: Map<string, Responsibility>,
    dateRange: DateRange,
    filename: string,
) {
    try {
        const xlModule = await import('exceljs')
        const ExcelJS = xlModule.default || xlModule
        const fsModule = await import('file-saver')
        const saveAs = fsModule.saveAs || (fsModule.default && fsModule.default.saveAs) || fsModule.default

        if (!ExcelJS.Workbook) {
            throw new Error("ExcelJS.Workbook is not a constructor. Module loaded incorrectly: " + Object.keys(ExcelJS))
        }

        const workbook = new ExcelJS.Workbook()

        // Get all months in the date range
        const months = getMonthsInRange(dateRange.from, dateRange.to)

        for (const entry of staffEntries) {
            for (const { month, year } of months) {
                // Filter submissions for this month
                const { hoursMap, responsibilityTitles } = groupSubmissionsForMonth(
                    entry.submissions, assignmentMap, responsibilityMap, month, year
                )

                // Skip months with no data
                if (responsibilityTitles.length === 0) continue

                // Build sheet name: "Jan 2026 - StaffName" or "Jan 2026" for single staff
                let sheetName = `${MONTH_NAMES[month].substring(0, 3)} ${year}`
                if (staffEntries.length > 1) {
                    const suffix = ` - ${entry.name}`
                    sheetName = sheetName.substring(0, 31 - suffix.length) + suffix
                }
                if (sheetName.length > 31) sheetName = sheetName.substring(0, 31)

                buildStaffSheet(workbook, sheetName, entry.name, month, year, hoursMap, responsibilityTitles)
            }
        }

        // Check if any sheets were created
        if (workbook.worksheets.length === 0) {
            alert('No data found for the selected date range')
            return
        }

        // Write and save
        const buffer = await workbook.xlsx.writeBuffer()
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        if (typeof saveAs === 'function') {
            saveAs(blob, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
        } else {
            throw new Error("saveAs is not a function. Module loaded incorrectly.")
        }
    } catch (error) {
        console.error('Failed to export Excel file:', error)
        alert(`Failed to export file: ${error instanceof Error ? error.message : String(error)}. Please try again.`)
    }
}

// ============ STAFF EXPORT DIALOG ============
// Staff can only export their own data
interface StaffExportDialogProps {
    submissions: WorkSubmission[]
    responsibilities: Responsibility[]
    assignments: Assignment[]
    userName: string
}

export function StaffExportDialog({ submissions, responsibilities, assignments, userName }: StaffExportDialogProps) {
    const [open, setOpen] = useState(false)
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 30),
        to: new Date(),
    })

    const handleExport = () => {
        const filteredSubmissions = submissions.filter(s => {
            const date = new Date(s.workDate || s.submittedAt)
            return date >= dateRange.from && date <= dateRange.to
        })

        if (filteredSubmissions.length === 0) {
            alert('No submissions found in the selected date range')
            return
        }

        // Build lookup maps for performance
        const assignmentMap = new Map(assignments.map(a => [String(a.id), a]))
        const responsibilityMap = new Map(responsibilities.map(r => [String(r.id), r]))

        exportToWorkXlsx(
            [{ name: userName, submissions: filteredSubmissions }],
            assignmentMap,
            responsibilityMap,
            dateRange,
            `my_submissions_${userName.replace(/\s+/g, '_')}`
        )
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export My Data
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" />
                        Export My Submissions
                    </DialogTitle>
                    <DialogDescription>
                        Export your detailed work submission data including responsibilities, hours, status, and comments
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* Date Range */}
                    <div className="space-y-2">
                        <Label>Date Range</Label>
                        <div className="flex gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="flex-1 justify-start">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {format(dateRange.from, "MMM d, yyyy")}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={dateRange.from}
                                        onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                                    />
                                </PopoverContent>
                            </Popover>
                            <span className="flex items-center text-muted-foreground">to</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="flex-1 justify-start">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {format(dateRange.to, "MMM d, yyyy")}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={dateRange.to}
                                        onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}>
                                Last 7 days
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}>
                                Last 30 days
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setDateRange({ from: subDays(new Date(), 90), to: new Date() })}>
                                Last 90 days
                            </Button>
                        </div>
                    </div>

                    <Separator />

                    <div className="text-sm text-muted-foreground">
                        <p className="font-medium mb-1">Export includes:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            <li>Submission date & responsibility details</li>
                            <li>Hours worked & submission status</li>
                            <li>Work proof type & content/URL</li>
                            <li>Staff & manager comments</li>
                        </ul>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleExport}>
                        <Download className="h-4 w-4 mr-2" />
                        Export Excel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ============ MANAGER EXPORT DIALOG ============
// Manager can export data for staff in their sub-department
interface ManagerExportDialogProps {
    submissions: WorkSubmission[]
    staffList: StaffMember[]
    responsibilities: Responsibility[]
    assignments: Assignment[]
    subDepartmentName: string
}

export function ManagerExportDialog({ 
    submissions, 
    staffList, 
    responsibilities, 
    assignments, 
    subDepartmentName 
}: ManagerExportDialogProps) {
    const [open, setOpen] = useState(false)
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 30),
        to: new Date(),
    })
    const [selectedStaffId, setSelectedStaffId] = useState<string>("all")

    // Reset staff selection when dialog opens
    useEffect(() => {
        if (open) {
            setSelectedStaffId("all")
        }
    }, [open])

    const handleExport = () => {
        // Filter by date range
        let filteredSubmissions = submissions.filter(s => {
            const date = new Date(s.workDate || s.submittedAt)
            return date >= dateRange.from && date <= dateRange.to
        })

        // Filter by selected staff
        if (selectedStaffId !== "all") {
            filteredSubmissions = filteredSubmissions.filter(s => String(s.staffId) === selectedStaffId)
        }

        if (filteredSubmissions.length === 0) {
            alert('No submissions found for the selected filters')
            return
        }

        // Build lookup maps for performance
        const assignmentMap = new Map(assignments.map(a => [String(a.id), a]))
        const responsibilityMap = new Map(responsibilities.map(r => [String(r.id), r]))
        const staffMap = new Map(staffList.map(s => [String(s.id), s]))

        // Group submissions by staff for multi-sheet export
        let staffEntries: { name: string; submissions: WorkSubmission[] }[]

        if (selectedStaffId === "all") {
            const grouped = new Map<string, WorkSubmission[]>()
            // Ensure every staff member gets a sheet, even if they have 0 submissions
            for (const staff of staffList) {
                grouped.set(String(staff.id), [])
            }
            // Populate with actual submissions
            for (const s of filteredSubmissions) {
                const sid = String(s.staffId)
                if (grouped.has(sid)) {
                    grouped.get(sid)!.push(s)
                }
            }
            staffEntries = Array.from(grouped.entries()).map(([sid, subs]) => ({
                name: staffMap.get(sid)?.name || 'Unknown',
                submissions: subs
            }))
        } else {
            const staffName = staffMap.get(selectedStaffId)?.name || 'Staff'
            staffEntries = [{ name: staffName, submissions: filteredSubmissions }]
        }

        // Generate filename
        let filename = 'submissions'
        if (selectedStaffId === "all") {
            filename = `all_staff_submissions_${subDepartmentName.replace(/\s+/g, '_')}`
        } else {
            const staffName = staffMap.get(selectedStaffId)?.name || 'staff'
            filename = `${staffName.replace(/\s+/g, '_')}_submissions`
        }

        exportToWorkXlsx(staffEntries, assignmentMap, responsibilityMap, dateRange, filename)
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export Data
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" />
                        Export Team Submissions
                    </DialogTitle>
                    <DialogDescription>
                        Export detailed submission data for staff in {subDepartmentName}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* Staff Selection - First filter */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Select Staff
                        </Label>
                        <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select staff member" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    <span className="flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        All Staff ({staffList.length})
                                    </span>
                                </SelectItem>
                                {staffList.map(staff => (
                                    <SelectItem key={staff.id} value={String(staff.id)}>
                                        <span className="flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            {staff.name}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Separator />

                    {/* Date Range */}
                    <div className="space-y-2">
                        <Label>Date Range</Label>
                        <div className="flex gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="flex-1 justify-start">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {format(dateRange.from, "MMM d, yyyy")}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={dateRange.from}
                                        onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                                    />
                                </PopoverContent>
                            </Popover>
                            <span className="flex items-center text-muted-foreground">to</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="flex-1 justify-start">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {format(dateRange.to, "MMM d, yyyy")}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={dateRange.to}
                                        onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}>
                                Last 7 days
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}>
                                Last 30 days
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setDateRange({ from: subDays(new Date(), 90), to: new Date() })}>
                                Last 90 days
                            </Button>
                        </div>
                    </div>

                    <Separator />

                    <div className="text-sm text-muted-foreground">
                        <p className="font-medium mb-1">Export includes:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            <li>Staff name & submission date</li>
                            <li>Responsibility title & description</li>
                            <li>Hours worked & submission status</li>
                            <li>Work proof type & content/URL</li>
                            <li>Staff & manager comments</li>
                        </ul>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleExport}>
                        <Download className="h-4 w-4 mr-2" />
                        Export Excel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ============ ADMIN EXPORT DIALOG ============
// Admin can export data across all departments and sub-departments
interface AdminExportDialogProps {
    submissions: WorkSubmission[]
    employees: StaffMember[]
    departments: Department[]
    subDepartments: SubDepartment[]
    responsibilities: Responsibility[]
    assignments: Assignment[]
}

export function AdminExportDialog({ 
    submissions, 
    employees, 
    departments, 
    subDepartments, 
    responsibilities, 
    assignments 
}: AdminExportDialogProps) {
    const [open, setOpen] = useState(false)
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 30),
        to: new Date(),
    })
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("all")
    const [selectedSubDepartmentId, setSelectedSubDepartmentId] = useState<string>("all")
    const [selectedStaffId, setSelectedStaffId] = useState<string>("all")

    // Filter sub-departments based on selected department
    const filteredSubDepartments = useMemo(() => {
        if (selectedDepartmentId === "all") return subDepartments
        return subDepartments.filter(sd => String(sd.departmentId) === selectedDepartmentId)
    }, [subDepartments, selectedDepartmentId])

    // Filter staff based on selected department/sub-department
    const filteredStaffList = useMemo(() => {
        let staff = employees.filter(e => (e as any).role === 'STAFF')
        if (selectedDepartmentId !== "all") {
            staff = staff.filter(e => String(e.departmentId) === selectedDepartmentId)
        }
        if (selectedSubDepartmentId !== "all") {
            staff = staff.filter(e => String(e.subDepartmentId) === selectedSubDepartmentId)
        }
        return staff
    }, [employees, selectedDepartmentId, selectedSubDepartmentId])

    // Reset cascading selections
    useEffect(() => {
        setSelectedSubDepartmentId("all")
        setSelectedStaffId("all")
    }, [selectedDepartmentId])

    useEffect(() => {
        setSelectedStaffId("all")
    }, [selectedSubDepartmentId])

    // Reset all selections when dialog opens
    useEffect(() => {
        if (open) {
            setSelectedDepartmentId("all")
            setSelectedSubDepartmentId("all")
            setSelectedStaffId("all")
        }
    }, [open])

    const handleExport = () => {
        // Filter by date range
        let filteredSubmissions = submissions.filter(s => {
            const date = new Date(s.workDate || s.submittedAt)
            return date >= dateRange.from && date <= dateRange.to
        })

        // Build lookup maps for performance
        const assignmentMap = new Map(assignments.map(a => [String(a.id), a]))
        const responsibilityMap = new Map(responsibilities.map(r => [String(r.id), r]))
        const employeeMap = new Map(employees.map(e => [String(e.id), e]))

        // Apply department filter using Set for O(1) lookups
        if (selectedDepartmentId !== "all") {
            const deptStaffIds = new Set(
                employees.filter(e => String(e.departmentId) === selectedDepartmentId).map(e => String(e.id))
            )
            filteredSubmissions = filteredSubmissions.filter(s => deptStaffIds.has(String(s.staffId)))
        }

        // Apply sub-department filter
        if (selectedSubDepartmentId !== "all") {
            const subDeptStaffIds = new Set(
                employees.filter(e => String(e.subDepartmentId) === selectedSubDepartmentId).map(e => String(e.id))
            )
            filteredSubmissions = filteredSubmissions.filter(s => subDeptStaffIds.has(String(s.staffId)))
        }

        // Apply staff filter
        if (selectedStaffId !== "all") {
            filteredSubmissions = filteredSubmissions.filter(s => String(s.staffId) === selectedStaffId)
        }

        if (filteredSubmissions.length === 0) {
            alert('No submissions found for the selected filters')
            return
        }

        // Group submissions by staff for multi-sheet export
        const grouped = new Map<string, WorkSubmission[]>()
        
        // Ensure every relevant staff member gets a sheet, even if they have 0 submissions
        for (const staff of filteredStaffList) {
            grouped.set(String(staff.id), [])
        }
        
        // Populate with actual submissions
        for (const s of filteredSubmissions) {
            const sid = String(s.staffId)
            if (grouped.has(sid)) {
                grouped.get(sid)!.push(s)
            }
        }

        const staffEntries = Array.from(grouped.entries()).map(([sid, subs]) => ({
            name: employeeMap.get(sid)?.name || 'Unknown',
            submissions: subs
        }))

        // Generate filename based on selection
        let filename = 'submissions'
        if (selectedStaffId !== "all") {
            const staffName = employeeMap.get(selectedStaffId)?.name || 'staff'
            filename = `${staffName.replace(/\s+/g, '_')}_submissions`
        } else if (selectedSubDepartmentId !== "all") {
            const subDeptName = subDepartments.find(sd => String(sd.id) === selectedSubDepartmentId)?.name || 'subdept'
            filename = `${subDeptName.replace(/\s+/g, '_')}_submissions`
        } else if (selectedDepartmentId !== "all") {
            const deptName = departments.find(d => String(d.id) === selectedDepartmentId)?.name || 'dept'
            filename = `${deptName.replace(/\s+/g, '_')}_submissions`
        } else {
            filename = 'all_submissions'
        }

        exportToWorkXlsx(staffEntries, assignmentMap, responsibilityMap, dateRange, filename)
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export Data
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" />
                        Export Organization Submissions
                    </DialogTitle>
                    <DialogDescription>
                        Export detailed submission data by department, sub-department, or individual staff
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* Step 1: Department Selection */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Step 1: Select Department
                        </Label>
                        <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                {departments.map(dept => (
                                    <SelectItem key={dept.id} value={String(dept.id)}>
                                        {dept.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Step 2: Sub-Department Selection (only visible after department selected) */}
                    {selectedDepartmentId !== "all" && (
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                Step 2: Select Sub-Department
                            </Label>
                            <Select value={selectedSubDepartmentId} onValueChange={setSelectedSubDepartmentId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select sub-department" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Sub-Departments ({filteredSubDepartments.length})</SelectItem>
                                    {filteredSubDepartments.map(subDept => (
                                        <SelectItem key={subDept.id} value={String(subDept.id)}>
                                            {subDept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Step 3: Staff Selection (only visible after sub-department selected) */}
                    {selectedSubDepartmentId !== "all" && (
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Step 3: Select Staff
                            </Label>
                            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select staff member" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        <span className="flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            All Staff ({filteredStaffList.length})
                                        </span>
                                    </SelectItem>
                                    {filteredStaffList.map(staff => (
                                        <SelectItem key={staff.id} value={String(staff.id)}>
                                            <span className="flex items-center gap-2">
                                                <User className="h-4 w-4" />
                                                {staff.name}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <Separator />

                    {/* Date Range */}
                    <div className="space-y-2">
                        <Label>Date Range</Label>
                        <div className="flex gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="flex-1 justify-start">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {format(dateRange.from, "MMM d, yyyy")}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={dateRange.from}
                                        onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                                    />
                                </PopoverContent>
                            </Popover>
                            <span className="flex items-center text-muted-foreground">to</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="flex-1 justify-start">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {format(dateRange.to, "MMM d, yyyy")}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={dateRange.to}
                                        onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}>
                                Last 7 days
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}>
                                Last 30 days
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setDateRange({ from: subDays(new Date(), 90), to: new Date() })}>
                                Last 90 days
                            </Button>
                        </div>
                    </div>

                    <Separator />

                    <div className="text-sm text-muted-foreground">
                        <p className="font-medium mb-1">Export includes:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            <li>Staff name, department & sub-department</li>
                            <li>Responsibility title & description</li>
                            <li>Submission date, hours worked & status</li>
                            <li>Work proof type & content/URL</li>
                            <li>Staff & manager comments</li>
                        </ul>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleExport}>
                        <Download className="h-4 w-4 mr-2" />
                        Export Excel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
