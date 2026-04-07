import * as ExcelJS from 'exceljs'
import { TimetableEntry } from '@/types/cir'

/**
 * Export timetable to Excel matching the exact CIR faculty timetable format.
 * 
 * Reference: "CIR TT_Even Sem_2026_Version 2.xlsx"
 * 
 * Layout per faculty (2 faculty side-by-side in cols A-K and L-U):
 *   - Row 1: Title "CIR Faculty Timetable..." merged A1:U1, bg FFFFEB9C
 *   - Row 2: Faculty name (bg FFFFC000) + time slot headers (bg FFF2F2F2)
 *   - Row 3: Faculty name continued + period numbers 1-9 (bg FFD9D9D9)
 *   - Rows 4-8 or 4-9: Days Mon-Fri/Sat with class data
 *     Colors: FF7AA7FF (blue, regular class), FFFA4D4D (red, MI),
 *             FFFFFF00 (yellow, Lunch Break), FF99FF00 (green, meetings)
 *   - Column K or between periods: Lunch Break column (FFFFFF00)
 */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_ABBREV: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat'
}

// Time period definitions matching the reference Excel
const PERIODS = [
  { num: 1, time: '9.00-9.50' },
  { num: 2, time: '9:50-10.40' },
  { num: 3, time: '10:50-11.40' },
  { num: 4, time: '11.40-12.30' },
  { num: 5, time: '12.30-1.20' },
  // Lunch break goes here
  { num: 6, time: '1.20-2.10' },
  { num: 7, time: '2.10-3.00' },
  { num: 8, time: '3.10-4.00' },
  { num: 9, time: '4.00-4.50' },
]

// Period time ranges in 24h minutes for matching entries to periods
const PERIOD_RANGES = [
  { num: 1, startMin: 9 * 60, endMin: 9 * 60 + 50 },
  { num: 2, startMin: 9 * 60 + 50, endMin: 10 * 60 + 40 },
  { num: 3, startMin: 10 * 60 + 50, endMin: 11 * 60 + 40 },
  { num: 4, startMin: 11 * 60 + 40, endMin: 12 * 60 + 30 },
  { num: 5, startMin: 12 * 60 + 30, endMin: 13 * 60 + 20 },
  // Lunch break: 1:20 PM
  { num: 6, startMin: 13 * 60 + 20, endMin: 14 * 60 + 10 },
  { num: 7, startMin: 14 * 60 + 10, endMin: 15 * 60 },
  { num: 8, startMin: 15 * 60 + 10, endMin: 16 * 60 },
  { num: 9, startMin: 16 * 60, endMin: 16 * 60 + 50 },
]

// Colors matching the reference Excel
const COLORS = {
  titleBg: 'FFFFEB9C',      // Amber/orange for title row
  nameBg: 'FFFFC000',       // Gold for faculty name
  timeHeaderBg: 'FFF2F2F2', // Light gray for time headers
  periodNumBg: 'FFD9D9D9',  // Gray for period numbers & day names
  lunchBg: 'FFFFFF00',      // Yellow for lunch break
  classBg: 'FF7AA7FF',      // Blue for regular classes
  meetingBg: 'FF99FF00',    // Green for meetings
  miBg: 'FFFA4D4D',         // Red for MI
  separatorBg: 'FFFDE49B',  // Light gold for separator column
}

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
}

function makeFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function getEntryMinutes(entry: TimetableEntry): { startMin: number; endMin: number } {
  const s = new Date(entry.startTime)
  const e = new Date(entry.endTime)
  return {
    startMin: s.getHours() * 60 + s.getMinutes(),
    endMin: e.getHours() * 60 + e.getMinutes(),
  }
}

/**
 * Find which period(s) an entry overlaps with.
 * Returns the best-matching single period number for simple mapping.
 */
function entryToPeriod(entry: TimetableEntry): number | null {
  const { startMin } = getEntryMinutes(entry)
  for (const pr of PERIOD_RANGES) {
    if (startMin >= pr.startMin && startMin < pr.endMin) {
      return pr.num
    }
  }
  return null
}

interface ExportOptions {
  entries: TimetableEntry[]
  subDepartmentName: string
  timetableId: number
  departmentName?: string
  semesterStartDate?: string
  semesterEndDate?: string
}

export async function exportTimetableToExcel(opts: ExportOptions): Promise<void> {
  const { entries, subDepartmentName, timetableId, departmentName, semesterStartDate, semesterEndDate } = opts

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'CIR System'
  const ws = workbook.addWorksheet('Faculty-Load')

  // Group entries by staff
  const staffMap = new Map<number, { name: string; entries: TimetableEntry[] }>()
  for (const entry of entries) {
    const staffId = entry.staffId
    const staffName = entry.staff?.name || 'Unknown'
    if (!staffMap.has(staffId)) {
      staffMap.set(staffId, { name: staffName, entries: [] })
    }
    staffMap.get(staffId)!.entries.push(entry)
  }

  const staffList = Array.from(staffMap.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name))

  // Pair faculty members side-by-side (2 per row block): Left = cols 1-10, Sep = col 11, Right = cols 12-21
  const LEFT_START = 1  // col A
  const LEFT_END = 10   // col J
  const SEP_COL = 11    // col K (separator)
  const RIGHT_START = 12 // col L
  const RIGHT_END = 21   // col U
  const TOTAL_COLS = 21

  // Set column widths
  for (let c = 1; c <= TOTAL_COLS; c++) {
    ws.getColumn(c).width = 14
  }
  ws.getColumn(1).width = 14  // Faculty name / Day
  ws.getColumn(12).width = 14 // 2nd faculty name / Day
  ws.getColumn(SEP_COL).width = 4 // Separator column

  let currentRow = 1

  // Process pairs of staff
  for (let pairIdx = 0; pairIdx < staffList.length; pairIdx += 2) {
    const leftStaff = staffList[pairIdx]
    const rightStaff = pairIdx + 1 < staffList.length ? staffList[pairIdx + 1] : null

    // ── Title Row (merged A:U) ──
    const titleRow = ws.getRow(currentRow)
    ws.mergeCells(currentRow, 1, currentRow, TOTAL_COLS)
    const titleCell = titleRow.getCell(1)
    
    let dateStr = ''
    if (semesterStartDate && semesterEndDate) {
        const s = new Date(semesterStartDate).toLocaleDateString()
        const e = new Date(semesterEndDate).toLocaleDateString()
        dateStr = ` (${s} to ${e})`
    }
    
    titleCell.value = `CIR Faculty Timetable - ${subDepartmentName} - Even Semester${dateStr}`
    titleCell.font = { bold: true, size: 16, name: 'Cambria', color: { argb: 'FF000000' } }
    titleCell.fill = makeFill(COLORS.titleBg)
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    titleRow.height = 25
    currentRow++

    // ── Helper to write a faculty block ──
    const writeFacultyBlock = (
      staffId: number,
      staffName: string,
      staffEntries: TimetableEntry[],
      colStart: number,
    ) => {
      const nameCol = colStart
      const periodCols = Array.from({ length: 9 }, (_, i) => colStart + 1 + i) // 9 period columns

      // ROW: Time headers (row = currentRow)
      const timeHeaderRow = ws.getRow(currentRow)
      // Faculty name cell
      const nameCell = timeHeaderRow.getCell(nameCol)
      nameCell.value = staffName
      nameCell.font = { bold: true, size: 11, name: 'Calibri' }
      nameCell.fill = makeFill(COLORS.nameBg)
      nameCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      nameCell.border = thinBorder

      // Time slot headers
      PERIODS.forEach((p, i) => {
        const cell = timeHeaderRow.getCell(periodCols[i])
        cell.value = p.time
        cell.font = { bold: true, size: 9, name: 'Calibri' }
        cell.fill = makeFill(COLORS.timeHeaderBg)
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.border = thinBorder
      })

      // ROW: Period numbers (row = currentRow + 1)
      const periodNumRow = ws.getRow(currentRow + 1)
      // Faculty name merged with row above
      ws.mergeCells(currentRow, nameCol, currentRow + 1, nameCol)

      PERIODS.forEach((p, i) => {
        const cell = periodNumRow.getCell(periodCols[i])
        cell.value = p.num
        cell.font = { bold: true, size: 10, name: 'Calibri' }
        cell.fill = makeFill(COLORS.periodNumBg)
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = thinBorder
      })

      // ROWS: Days (Mon-Sat)
      DAYS.forEach((day, dayIdx) => {
        const dayRow = ws.getRow(currentRow + 2 + dayIdx)
        dayRow.height = 50

        // Day cell
        const dayCell = dayRow.getCell(nameCol)
        dayCell.value = DAY_ABBREV[day]
        dayCell.font = { bold: true, size: 10, name: 'Calibri' }
        dayCell.fill = makeFill(COLORS.periodNumBg)
        dayCell.alignment = { horizontal: 'center', vertical: 'middle' }
        dayCell.border = thinBorder

        // Get entries for this day and map to periods
        const dayEntries = staffEntries.filter(e => e.day === day)

        PERIODS.forEach((p, i) => {
          const cell = dayRow.getCell(periodCols[i])
          cell.border = thinBorder
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
          cell.font = { size: 9, name: 'Calibri' }

          // Check if there's a lunch break period (period 5 → after 12:30)
          // In the reference, lunch break appears at different positions
          // For simplicity, check if this period is the lunch column

          // Find matching entry
          const matchingEntry = dayEntries.find(e => entryToPeriod(e) === p.num)

          if (matchingEntry) {
            // Format: "Batch\nClassroom"
            const roomName = matchingEntry.classroom?.name || ''
            cell.value = `${matchingEntry.batch}\n${roomName}`
            
            // Color based on topic
            const topic = matchingEntry.topic?.toLowerCase() || ''
            if (topic.includes('mi') || topic === 'mi') {
              cell.value = 'MI'
              cell.fill = makeFill(COLORS.miBg)
            } else if (topic.includes('meeting') || topic.includes('cir meeting')) {
              cell.value = matchingEntry.topic
              cell.fill = makeFill(COLORS.meetingBg)
            } else {
              cell.fill = makeFill(COLORS.classBg)
            }
          }
        })
      })
    }

    // Write left faculty block
    writeFacultyBlock(leftStaff[0], leftStaff[1].name, leftStaff[1].entries, LEFT_START)

    // Separator column styling for all rows in this block
    for (let r = currentRow; r < currentRow + 2 + DAYS.length; r++) {
      const sepCell = ws.getRow(r).getCell(SEP_COL)
      sepCell.fill = makeFill(COLORS.separatorBg)
      sepCell.value = ' '
    }

    // Write right faculty block (if exists)
    if (rightStaff) {
      writeFacultyBlock(rightStaff[0], rightStaff[1].name, rightStaff[1].entries, RIGHT_START)
    }

    // Move past: 2 header rows + 6 day rows = 8 rows per block
    currentRow += 2 + DAYS.length

    // Add a blank separator row between pairs
    if (pairIdx + 2 < staffList.length) {
      currentRow++
    }
  }

  // If no entries, add a message
  if (staffList.length === 0) {
    ws.getCell('A1').value = 'No timetable entries to export'
    ws.getCell('A1').font = { bold: true, size: 14 }
  }

  // Generate & download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `CIR TT_Even Sem_2026_Version ${timetableId}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
