"use client"

import { useEffect, useState,useMemo } from "react"
import { useAuth } from "@/components/providers/auth-context"
import Link from "next/link"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { api } from "@/lib/api"
import { Employee, Department, WorkSubmission, SubDepartment,Assignment, CreateResponsibilityDto,Responsibility} from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { SubmissionStatusBadge } from "@/components/ui/status-badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Users,
  Building2,
  FileCheck,
  ClipboardList,
  TrendingUp,
  Clock,
  Activity,
  Target,
  CheckCircle,
  XCircle,
  Briefcase,
  Plus,
  Layers,
  CalendarIcon,
  BarChart3,
  Download,
} from "lucide-react"
import { toast } from "sonner"
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns"
import { cn } from "@/lib/utils"
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler } from 'chart.js'
import { Bar, Line, Doughnut, Pie } from 'react-chartjs-2'
import { AdminExportDialog } from "@/components/export-dialog"
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler)

// CSV Export utility function
const exportToCSV = (data: Record<string, any>[], filename: string) => {
    if (data.length === 0) {
        alert('No data to export')
        return
    }
    const headers = Object.keys(data[0])
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const value = row[header]
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`
                }
                return value ?? ''
            }).join(',')
        )
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

type DateRange = {
    from: Date
    to: Date
}



interface DashboardStats {
  totalEmployees: number
  totalDepartments: number
  totalSubmissions: number
  pendingSubmissions: number
  verifiedSubmissions: number
  rejectedSubmissions: number
}

export default function AdminDashboardPage() {
  const { user } = useAuth()
  // const [stats, setStats] = useState<DashboardStats>({
  //   totalEmployees: 0,
  //   totalDepartments: 0,
  //   totalSubmissions: 0,
  //   pendingSubmissions: 0,
  //   verifiedSubmissions: 0,
  //   rejectedSubmissions: 0,
  // })
  const [isLoading, setIsLoading] = useState(true)
  const [employeeName, setEmployeeName] = useState<string | null>(null)
  const [submissions, setSubmissions] = useState<WorkSubmission[]>([])
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [responsibilities, setResponsibilities] = useState<Responsibility[]>([])
    const [departments, setDepartments] = useState<Department[]>([])
    const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([])
    
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("all")
    const [selectedSubDepartmentId, setSelectedSubDepartmentId] = useState<string>("all")
    const [selectedStaffId, setSelectedStaffId] = useState<string>("all")
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 30),
        to: new Date(),
    })

    useEffect(() => {
        fetchData()
    }, [user])
    

    async function fetchData() {
        try {
            const [allSubmissions, allAssignments, allEmployees, allResponsibilities, allDepts, allSubDepts] = await Promise.all([
                api.workSubmissions.getAll(),
                api.assignments.getAll(),
                api.employees.getAll(),
                api.responsibilities.getAll(),
                api.departments.getAll(),
                api.subDepartments.getAll(),
            ])
            
            setSubmissions(allSubmissions)
            setAssignments(allAssignments)
            setEmployees(allEmployees)
            setResponsibilities(allResponsibilities)
            setDepartments(allDepts)
            setSubDepartments(allSubDepts)

            // Get admin's name from employee data
            if (user?.id) {
                const adminData = allEmployees.find(e => String(e.id) === String(user.id))
                if (adminData?.name) {
                    setEmployeeName(adminData.name)
                }
            }
        } catch (error) {
            console.error("Failed to fetch analytics data:", error)
        } finally {
            setIsLoading(false)
        }
    }

    // Filter sub-departments based on selected department
    const filteredSubDepartments = useMemo(() => {
        if (selectedDepartmentId === "all") return subDepartments
        return subDepartments.filter(sd => String(sd.departmentId) === selectedDepartmentId)
    }, [subDepartments, selectedDepartmentId])

    // Filter staff based on selected department/sub-department
    const filteredStaffList = useMemo(() => {
        let staff = employees.filter(e => e.role === 'STAFF' || e.role === 'MANAGER')
        if (selectedDepartmentId !== "all") {
            staff = staff.filter(e => String(e.departmentId) === selectedDepartmentId)
        }
        if (selectedSubDepartmentId !== "all") {
            staff = staff.filter(e => String(e.subDepartmentId) === selectedSubDepartmentId)
        }
        return staff
    }, [employees, selectedDepartmentId, selectedSubDepartmentId])

    // Filter submissions based on all filters
    const filteredSubmissions = useMemo(() => {
        return submissions.filter(s => {
            const date = new Date(s.workDate || s.submittedAt)
            const inDateRange = date >= dateRange.from && date <= dateRange.to
            
            // Get staff for this submission
            const staff = employees.find(e => String(e.id) === String(s.staffId))
            if (!staff) return false
            
            // Apply filters
            const matchesDept = selectedDepartmentId === "all" || String(staff.departmentId) === selectedDepartmentId
            const matchesSubDept = selectedSubDepartmentId === "all" || String(staff.subDepartmentId) === selectedSubDepartmentId
            const matchesStaff = selectedStaffId === "all" || String(s.staffId) === selectedStaffId
            
            return inDateRange && matchesDept && matchesSubDept && matchesStaff
        })
    }, [submissions, employees, dateRange, selectedDepartmentId, selectedSubDepartmentId, selectedStaffId])

    // Overall stats
    const stats = useMemo(() => {
        const total = filteredSubmissions.length
        const verified = filteredSubmissions.filter(s => s.status === 'VERIFIED').length
        const pending = filteredSubmissions.filter(s => s.status === 'SUBMITTED' || s.status === 'PENDING').length
        const rejected = filteredSubmissions.filter(s => s.status === 'REJECTED').length
        const totalHours = filteredSubmissions.reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)
        const verifiedHours = filteredSubmissions
            .filter(s => s.status === 'VERIFIED')
            .reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)
        const approvalRate = total > 0 ? Math.round((verified / total) * 100) : 0
        
        const totalStaff = employees.filter(e => e.role === 'STAFF').length
        const totalManagers = employees.filter(e => e.role === 'MANAGER').length
        
        return { total, verified, pending, rejected, totalHours, verifiedHours, approvalRate, totalStaff, totalManagers }
    }, [filteredSubmissions, employees])

    // Department stats
    const departmentStats = useMemo(() => {
        return departments.map(dept => {
            const deptStaff = employees.filter(e => String(e.departmentId) === String(dept.id) && e.role === 'STAFF')
            const staffIds = deptStaff.map(s => String(s.id))
            const deptSubmissions = filteredSubmissions.filter(s => staffIds.includes(String(s.staffId)))
            const verified = deptSubmissions.filter(s => s.status === 'VERIFIED').length
            const hours = deptSubmissions
                .filter(s => s.status === 'VERIFIED')
                .reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)
            
            return {
                ...dept,
                staffCount: deptStaff.length,
                totalSubmissions: deptSubmissions.length,
                verified,
                hours: Math.round(hours * 10) / 10,
                approvalRate: deptSubmissions.length > 0 ? Math.round((verified / deptSubmissions.length) * 100) : 0,
            }
        }).sort((a, b) => b.totalSubmissions - a.totalSubmissions)
    }, [departments, employees, filteredSubmissions])

    // Sub-department stats
    const subDepartmentStats = useMemo(() => {
        return filteredSubDepartments.map(subDept => {
            const subDeptStaff = employees.filter(e => String(e.subDepartmentId) === String(subDept.id) && e.role === 'STAFF')
            const staffIds = subDeptStaff.map(s => String(s.id))
            const subDeptSubmissions = filteredSubmissions.filter(s => staffIds.includes(String(s.staffId)))
            const verified = subDeptSubmissions.filter(s => s.status === 'VERIFIED').length
            const hours = subDeptSubmissions
                .filter(s => s.status === 'VERIFIED')
                .reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)
            
            return {
                ...subDept,
                staffCount: subDeptStaff.length,
                totalSubmissions: subDeptSubmissions.length,
                verified,
                hours: Math.round(hours * 10) / 10,
                approvalRate: subDeptSubmissions.length > 0 ? Math.round((verified / subDeptSubmissions.length) * 100) : 0,
            }
        }).sort((a, b) => b.totalSubmissions - a.totalSubmissions)
    }, [filteredSubDepartments, employees, filteredSubmissions])

    // Staff stats
    const staffStats = useMemo(() => {
        return filteredStaffList.map(staff => {
            const staffSubmissions = filteredSubmissions.filter(s => String(s.staffId) === String(staff.id))
            const verified = staffSubmissions.filter(s => s.status === 'VERIFIED').length
            const pending = staffSubmissions.filter(s => s.status === 'SUBMITTED' || s.status === 'PENDING').length
            const rejected = staffSubmissions.filter(s => s.status === 'REJECTED').length
            const hours = staffSubmissions
                .filter(s => s.status === 'VERIFIED')
                .reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)
            
            return {
                ...staff,
                total: staffSubmissions.length,
                verified,
                pending,
                rejected,
                hours: Math.round(hours * 10) / 10,
                approvalRate: staffSubmissions.length > 0 ? Math.round((verified / staffSubmissions.length) * 100) : 0,
            }
        }).sort((a, b) => b.total - a.total)
    }, [filteredStaffList, filteredSubmissions])

    // Responsibility stats
    const responsibilityStats = useMemo(() => {
        let resps = responsibilities
        if (selectedDepartmentId !== "all") {
            // Filter by department through sub-department
            const subDeptIdsInDept = subDepartments
                .filter(sd => String(sd.departmentId) === selectedDepartmentId)
                .map(sd => String(sd.id))
            resps = resps.filter(r => subDeptIdsInDept.includes(String(r.subDepartmentId)))
        }
        if (selectedSubDepartmentId !== "all") {
            resps = resps.filter(r => String(r.subDepartmentId) === selectedSubDepartmentId)
        }
        
        return resps.map(resp => {
            const respAssignments = assignments.filter(a => String(a.responsibilityId) === String(resp.id))
            // Get unique staff IDs and their details
            const assignedStaffIds = [...new Set(respAssignments.map(a => String(a.staffId)))]
            const assignedStaffList = assignedStaffIds.map(staffId => {
                const staff = employees.find(e => String(e.id) === staffId)
                return staff ? { id: staff.id, name: staff.name } : null
            }).filter(Boolean) as { id: string, name: string }[]
            
            const respSubmissions = filteredSubmissions.filter(s => 
                respAssignments.some(a => String(a.id) === String(s.assignmentId))
            )
            const verified = respSubmissions.filter(s => s.status === 'VERIFIED').length
            
            // Get sub-department and department info for this responsibility
            const subDept = subDepartments.find(sd => String(sd.id) === String(resp.subDepartmentId))
            const dept = subDept ? departments.find(d => String(d.id) === String(subDept.departmentId)) : null
            
            return {
                ...resp,
                assignedStaff: assignedStaffList.length,
                assignedStaffList,
                subDepartmentName: subDept?.name || 'Unknown',
                departmentName: dept?.name || 'Unknown',
                totalSubmissions: respSubmissions.length,
                verified,
                completionRate: respSubmissions.length > 0 ? Math.round((verified / respSubmissions.length) * 100) : 0,
            }
        }).sort((a, b) => b.totalSubmissions - a.totalSubmissions)
    }, [responsibilities, assignments, filteredSubmissions, selectedDepartmentId, selectedSubDepartmentId, subDepartments, employees, departments])

    // Daily data for charts
    const dailyData = useMemo(() => {
        const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to })
        
        return days.map(day => {
            const daySubmissions = filteredSubmissions.filter(s => 
                isSameDay(new Date(s.workDate || s.submittedAt), day)
            )
            const verified = daySubmissions.filter(s => s.status === 'VERIFIED').length
            const hours = daySubmissions.reduce((sum, s) => sum + ((s as any).hoursWorked || 0), 0)
            
            return {
                date: format(day, 'MMM d'),
                submissions: daySubmissions.length,
                verified,
                hours: Math.round(hours * 10) / 10,
            }
        })
    }, [filteredSubmissions, dateRange])

    // Chart Data
    const statusPieData = {
        labels: ['Verified', 'Pending', 'Rejected'],
        datasets: [{
            data: [stats.verified, stats.pending, stats.rejected],
            backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(251, 191, 36, 0.8)', 'rgba(239, 68, 68, 0.8)'],
            borderColor: ['rgba(34, 197, 94, 1)', 'rgba(251, 191, 36, 1)', 'rgba(239, 68, 68, 1)'],
            borderWidth: 2,
            hoverOffset: 8,
        }]
    }

    // Multi-series Area Chart Data - Enhanced with all statuses
    const multiSeriesAreaData = {
        labels: dailyData.map(d => d.date),
        datasets: [{
            label: 'Total',
            data: dailyData.map(d => d.submissions),
            borderColor: 'rgba(99, 102, 241, 1)',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2,
        }, {
            label: 'Verified',
            data: dailyData.map(d => d.verified),
            borderColor: 'rgba(34, 197, 94, 1)',
            backgroundColor: 'rgba(34, 197, 94, 0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2,
        }, {
            label: 'Pending',
            data: dailyData.map(d => {
                const daySubmissions = filteredSubmissions.filter(s => 
                    format(new Date(s.workDate || s.submittedAt), 'MMM d') === d.date
                )
                return daySubmissions.filter(s => s.status === 'SUBMITTED' || s.status === 'PENDING').length
            }),
            borderColor: 'rgba(251, 191, 36, 1)',
            backgroundColor: 'rgba(251, 191, 36, 0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2,
        }, {
            label: 'Rejected',
            data: dailyData.map(d => {
                const daySubmissions = filteredSubmissions.filter(s => 
                    format(new Date(s.workDate || s.submittedAt), 'MMM d') === d.date
                )
                return daySubmissions.filter(s => s.status === 'REJECTED').length
            }),
            borderColor: 'rgba(239, 68, 68, 1)',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2,
        }]
    }

    const departmentBarData = {
        labels: departmentStats.slice(0, 8).map(d => d.name.length > 15 ? d.name.substring(0, 12) + '...' : d.name),
        datasets: [{
            label: 'Verified',
            data: departmentStats.slice(0, 8).map(d => d.verified),
            backgroundColor: 'rgba(34, 197, 94, 0.85)',
            borderRadius: 0,
        }, {
            label: 'Pending',
            data: departmentStats.slice(0, 8).map(d => d.totalSubmissions - d.verified),
            backgroundColor: 'rgba(251, 191, 36, 0.85)',
            borderRadius: 0,
        }]
    }

    const hoursChartData = {
        labels: dailyData.map(d => d.date),
        datasets: [{
            label: 'Hours Worked',
            data: dailyData.map(d => d.hours),
            borderColor: 'rgba(139, 92, 246, 1)',
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2,
        }]
    }

    // Daily Hours Bar Chart - Shows hours per day
    const dailyHoursBarData = {
        labels: dailyData.map(d => d.date),
        datasets: [{
            label: 'Hours',
            data: dailyData.map(d => d.hours),
            backgroundColor: 'rgba(99, 102, 241, 0.85)',
            borderRadius: 0,
            barThickness: 'flex' as const,
            maxBarThickness: 40,
        }]
    }

    // Area chart options for smooth multi-series
    const areaChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { 
                position: 'top' as const, 
                labels: { 
                    padding: 16, 
                    usePointStyle: true,
                    font: { size: 11 }
                } 
            },
            tooltip: { 
                backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                padding: 12, 
                mode: 'index' as const, 
                intersect: false,
                titleFont: { size: 12 },
                bodyFont: { size: 11 },
                cornerRadius: 0,
            },
        },
        scales: {
            x: { 
                grid: { display: false },
                ticks: { font: { size: 10 }, color: 'rgba(100, 116, 139, 0.8)' }
            },
            y: { 
                beginAtZero: true, 
                grid: { color: 'rgba(0, 0, 0, 0.04)' },
                ticks: { font: { size: 10 }, color: 'rgba(100, 116, 139, 0.8)' }
            },
        },
        interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false },
        elements: {
            line: { borderJoinStyle: 'round' as const },
        },
    }

    // Chart Options - Sharp, clean styling
    const pieChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { 
                position: 'bottom' as const, 
                labels: { padding: 16, usePointStyle: true, font: { size: 11 } } 
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                padding: 12,
                cornerRadius: 0,
                titleFont: { size: 12 },
                bodyFont: { size: 11 },
                callbacks: {
                    label: function(context: any) {
                        const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
                        const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0
                        return `${context.label}: ${context.raw} (${percentage}%)`
                    }
                }
            },
        },
    }

    // Vertical bar chart options for daily hours
    const verticalBarChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { 
                backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                padding: 12,
                cornerRadius: 0,
                callbacks: {
                    label: function(context: any) {
                        return `${context.raw.toFixed(1)} hours`
                    }
                }
            },
        },
        scales: {
            x: { 
                grid: { display: false },
                ticks: { font: { size: 9 }, color: 'rgba(100, 116, 139, 0.8)', maxRotation: 45, minRotation: 45 }
            },
            y: { 
                beginAtZero: true, 
                grid: { color: 'rgba(0, 0, 0, 0.04)' },
                ticks: { font: { size: 10 }, color: 'rgba(100, 116, 139, 0.8)' }
            },
        },
    }

    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { 
                position: 'top' as const, 
                labels: { padding: 16, usePointStyle: true, font: { size: 11 } } 
            },
            tooltip: { 
                backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                padding: 12, 
                mode: 'index' as const, 
                intersect: false,
                cornerRadius: 0,
            },
        },
        scales: {
            x: { 
                grid: { display: false },
                ticks: { font: { size: 10 }, color: 'rgba(100, 116, 139, 0.8)' }
            },
            y: { 
                beginAtZero: true, 
                grid: { color: 'rgba(0, 0, 0, 0.04)' },
                ticks: { font: { size: 10 }, color: 'rgba(100, 116, 139, 0.8)' }
            },
        },
        interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false },
    }

    const barChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y' as const,
        plugins: {
            legend: { 
                position: 'top' as const, 
                labels: { padding: 16, usePointStyle: true, font: { size: 11 } } 
            },
            tooltip: { 
                backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                padding: 12,
                cornerRadius: 0,
            },
        },
        scales: {
            x: { 
                stacked: true, 
                beginAtZero: true, 
                grid: { color: 'rgba(0, 0, 0, 0.04)' },
                ticks: { font: { size: 10 }, color: 'rgba(100, 116, 139, 0.8)' }
            },
            y: { 
                stacked: true, 
                grid: { display: false },
                ticks: { font: { size: 10 }, color: 'rgba(100, 116, 139, 0.8)' }
            },
        },
    }

    // Reset sub-department when department changes
    useEffect(() => {
        setSelectedSubDepartmentId("all")
        setSelectedStaffId("all")
    }, [selectedDepartmentId])

    useEffect(() => {
        setSelectedStaffId("all")
    }, [selectedSubDepartmentId])

    if (isLoading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
                </div>
                <Skeleton className="h-[400px]" />
            </div>
        )
    }

  // Create Responsibility form state
  



  async function fetchDashboardData() {
    try {
      const [employees, departments, submissions, subDepts] = await Promise.all([
        api.employees.getAll(),
        api.departments.getAll(),
        api.workSubmissions.getAll(),
        api.subDepartments.getAll(),
      ])

      // setStats({
      //   totalEmployees: employees.length,
      //   totalDepartments: departments.length,
      //   totalSubmissions: submissions.length,
      //   pendingSubmissions: submissions.filter(s => s.status === 'PENDING').length,
      //   verifiedSubmissions: submissions.filter(s => s.status === 'VERIFIED').length,
      //   rejectedSubmissions: submissions.filter(s => s.status === 'REJECTED').length,
      // })

      setSubDepartments(subDepts)
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
    } finally {
      setIsLoading(false)
    }
  }

 

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl  tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back{employeeName ? `, ${employeeName}` : ''}. Here's an overview of the system.
          </p>
        </div>
        <AdminExportDialog
            submissions={submissions}
            employees={employees}
            departments={departments}
            subDepartments={subDepartments}
            responsibilities={responsibilities}
            assignments={assignments}
        />
      </div>

      
   
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* <div>
                    <h1 className="text-3xl  tracking-tight">System Analytics</h1>
                    <p className="text-muted-foreground">
                        Organization-wide performance metrics and insights
                    </p>
                </div> */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Department Filter */}
                    <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                        <SelectTrigger className="w-[160px]">
                            <Building2 className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Department" />
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

                    {/* Sub-Department Filter */}
                    <Select value={selectedSubDepartmentId} onValueChange={setSelectedSubDepartmentId}>
                        <SelectTrigger className="w-[160px]">
                            <Layers className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Sub-Dept" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Sub-Depts</SelectItem>
                            {filteredSubDepartments.map(subDept => (
                                <SelectItem key={subDept.id} value={String(subDept.id)}>
                                    {subDept.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Staff Filter */}
                    <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                        <SelectTrigger className="w-[160px]">
                            <Users className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Staff" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Staff</SelectItem>
                            {filteredStaffList.map(staff => (
                                <SelectItem key={staff.id} value={String(staff.id)}>
                                    {staff.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Date Range Picker */}
                    {/* <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end"> */}
                            {/* <div className="flex gap-2 p-2 border-b">
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}>
                                    7 days
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}>
                                    30 days
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}>
                                    This Month
                                </Button>
                            </div> */}
                            {/* <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={dateRange.from}
                                selected={dateRange}
                                onSelect={(range) => range?.from && range?.to && setDateRange({ from: range.from, to: range.to })}
                                numberOfMonths={1}
                                className="p-2"
                            />
                        </PopoverContent>
                    </Popover> */}
                     {/* Date Range Picker */}
                        <span className="text-sm font-medium text-muted-foreground">Date Range</span>
                        <div className="flex items-center gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {format(dateRange.from, "MMM d, yyyy")}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                        <div className="flex gap-2 p-2 border-b">
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}>
                                    7 days
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}>
                                    30 days
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}>
                                    This Month
                                </Button>
                            </div>
                                    <CalendarComponent
                                        mode="single"
                                        selected={dateRange.from}
                                        onSelect={(date) => {
                                            if (date) {
                                                setDateRange(prev => ({ ...prev, from: date }))
                                            }
                                        }}
                                    />
                                </PopoverContent>
                            </Popover>
                            <span className="text-sm text-muted-foreground">to</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {format(dateRange.to, "MMM d, yyyy")}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                    <CalendarComponent
                                        mode="single"
                                        selected={dateRange.to}
                                        onSelect={(date) => {
                                            if (date) {
                                                setDateRange(prev => ({ ...prev, to: date }))
                                            }
                                        }}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                </div>
            </div>

            {/* Stats Cards - Sharp, clean design */}
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                <Card className="rounded-none border-l-2 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {selectedDepartmentId !== "all" ? "Department" : "Departments"}
                        </CardTitle>
                        <Building2 className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent className="pb-3 px-4">
                        <div className="text-2xl font-semibold">
                            {selectedDepartmentId !== "all" ? 1 : departments.length}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {selectedSubDepartmentId !== "all" ? 1 : filteredSubDepartments.length} sub-dept{filteredSubDepartments.length !== 1 ? 's' : ''}
                        </p>
                    </CardContent>
                </Card>
                <Card className="rounded-none border-l-2 border-l-indigo-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {selectedStaffId !== "all" ? "Selected" : "Staff"}
                        </CardTitle>
                        <Users className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent className="pb-3 px-4">
                        <div className="text-2xl font-semibold">
                            {selectedStaffId !== "all" ? 1 : filteredStaffList.length}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {selectedDepartmentId === "all" && selectedSubDepartmentId === "all" 
                                ? `${stats.totalManagers} manager${stats.totalManagers !== 1 ? 's' : ''}` 
                                : 'in scope'}
                        </p>
                    </CardContent>
                </Card>
                <Card className="rounded-none border-l-2 border-l-cyan-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submissions</CardTitle>
                        <BarChart3 className="h-4 w-4 text-cyan-500" />
                    </CardHeader>
                    <CardContent className="pb-3 px-4">
                        <div className="text-2xl font-semibold">{stats.total}</div>
                        <p className="text-xs text-muted-foreground mt-0.5">{stats.totalHours.toFixed(1)}h logged</p>
                    </CardContent>
                </Card>
                <Card className="rounded-none border-l-2 border-l-green-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Approval</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent className="pb-3 px-4">
                        <div className="text-2xl font-semibold">{stats.approvalRate}%</div>
                        <p className="text-xs text-muted-foreground mt-0.5">{stats.verified} verified</p>
                    </CardContent>
                </Card>
                <Card className="rounded-none border-l-2 border-l-amber-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent className="pb-3 px-4">
                        <div className="text-2xl font-semibold">{stats.pending}</div>
                        <p className="text-xs text-muted-foreground mt-0.5">awaiting review</p>
                    </CardContent>
                </Card>
                <Card className="rounded-none border-l-2 border-l-purple-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Verified Hrs</CardTitle>
                        <FileCheck className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent className="pb-3 px-4">
                        <div className="text-2xl font-semibold">{stats.verifiedHours.toFixed(1)}h</div>
                        <p className="text-xs text-muted-foreground mt-0.5">approved work</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs - Clean navigation */}
            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="rounded-none bg-muted/50 p-0.5">
                    <TabsTrigger value="overview" className="rounded-none gap-2 data-[state=active]:shadow-none">
                        <Activity className="h-4 w-4" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="departments" className="rounded-none gap-2 data-[state=active]:shadow-none">
                        <Building2 className="h-4 w-4" />
                        Departments
                    </TabsTrigger>
                    <TabsTrigger value="staff" className="rounded-none gap-2 data-[state=active]:shadow-none">
                        <Users className="h-4 w-4" />
                        Staff
                    </TabsTrigger>
                    <TabsTrigger value="responsibilities" className="rounded-none gap-2 data-[state=active]:shadow-none">
                        <Briefcase className="h-4 w-4" />
                        Responsibilities
                    </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                    {/* Multi-Series Area Chart - Full Width */}
                    <Card className="rounded-none">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <Activity className="h-4 w-4 text-indigo-500" />
                                        Submissions Trend
                                    </CardTitle>
                                    <CardDescription className="text-xs">Multi-series view of all submission statuses over time</CardDescription>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => exportToCSV(dailyData.map(d => ({ Date: d.date, Submissions: d.submissions, Verified: d.verified, Hours: d.hours })), 'submissions_trend')}>
                                    <Download className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[280px]">
                                <Line data={multiSeriesAreaData} options={areaChartOptions} />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-4 lg:grid-cols-3">
                        <Card className="rounded-none">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <Target className="h-4 w-4 text-green-500" />
                                            Status Distribution
                                        </CardTitle>
                                        <CardDescription className="text-xs">Breakdown by status</CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => exportToCSV([{ Status: 'Verified', Count: stats.verified }, { Status: 'Pending', Count: stats.pending }, { Status: 'Rejected', Count: stats.rejected }], 'status_distribution')}>
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[240px]">
                                    {stats.total > 0 ? (
                                        <Pie data={statusPieData} options={pieChartOptions} />
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                            No submissions in selected period
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-none">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <Building2 className="h-4 w-4 text-blue-500" />
                                            By Department
                                        </CardTitle>
                                        <CardDescription className="text-xs">Submissions breakdown</CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => exportToCSV(departmentStats.map(d => ({ Department: d.name, TotalSubmissions: d.totalSubmissions, Verified: d.verified, Hours: d.hours, ApprovalRate: d.approvalRate, StaffCount: d.staffCount })), 'department_stats')}>
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[240px]">
                                    <Bar data={departmentBarData} options={barChartOptions} />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-none">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <BarChart3 className="h-4 w-4 text-indigo-500" />
                                            Daily Staff Hours
                                        </CardTitle>
                                        <CardDescription className="text-xs">Hours worked per day</CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => exportToCSV(dailyData.map(d => ({ Date: d.date, Hours: d.hours })), 'daily_hours')}>
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[240px]">
                                    <Bar data={dailyHoursBarData} options={verticalBarChartOptions} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Departments Tab */}
                <TabsContent value="departments" className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card className="rounded-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Building2 className="h-4 w-4 text-blue-500" />
                                    Departments
                                </CardTitle>
                                <CardDescription className="text-xs">Performance by department</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[400px]">
                                    <div className="space-y-2">
                                        {departmentStats.map((dept) => (
                                            <div 
                                                key={dept.id} 
                                                className="p-3 border border-l-2 border-l-blue-500 hover:bg-muted/50 transition-colors cursor-pointer"
                                                onClick={() => setSelectedDepartmentId(String(dept.id))}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium text-sm">{dept.name}</span>
                                                    <Badge variant="outline" className="rounded-none text-xs">{dept.staffCount} staff</Badge>
                                                </div>
                                                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                                                    <div>
                                                        <p className="font-semibold text-indigo-600">{dept.totalSubmissions}</p>
                                                        <p className="text-xs text-muted-foreground">Submissions</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-green-600">{dept.verified}</p>
                                                        <p className="text-xs text-muted-foreground">Verified</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-purple-600">{dept.hours}h</p>
                                                        <p className="text-xs text-muted-foreground">Hours</p>
                                                    </div>
                                                    <div>
                                                        <p className={`font-semibold ${dept.approvalRate >= 80 ? 'text-green-600' : dept.approvalRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                            {dept.approvalRate}%
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">Approval</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                        <Card className="rounded-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Layers className="h-4 w-4 text-cyan-500" />
                                    Sub-Departments
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    {selectedDepartmentId === "all" ? "All sub-departments" : "Filtered by department"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[400px]">
                                    <div className="space-y-2">
                                        {subDepartmentStats.map((subDept) => (
                                            <div 
                                                key={subDept.id} 
                                                className="p-3 border border-l-2 border-l-cyan-500 hover:bg-muted/50 transition-colors cursor-pointer"
                                                onClick={() => setSelectedSubDepartmentId(String(subDept.id))}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium text-sm">{subDept.name}</span>
                                                    <Badge variant="outline" className="rounded-none text-xs">{subDept.staffCount} staff</Badge>
                                                </div>
                                                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                                                    <div>
                                                        <p className="font-semibold text-indigo-600">{subDept.totalSubmissions}</p>
                                                        <p className="text-xs text-muted-foreground">Submissions</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-green-600">{subDept.verified}</p>
                                                        <p className="text-xs text-muted-foreground">Verified</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-purple-600">{subDept.hours}h</p>
                                                        <p className="text-xs text-muted-foreground">Hours</p>
                                                    </div>
                                                    <div>
                                                        <p className={`font-semibold ${subDept.approvalRate >= 80 ? 'text-green-600' : subDept.approvalRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                            {subDept.approvalRate}%
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">Approval</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {subDepartmentStats.length === 0 && (
                                            <div className="text-center py-8 text-muted-foreground">
                                                No sub-departments found
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Staff Tab */}
                <TabsContent value="staff" className="space-y-4">
                    <Card className="rounded-none">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Users className="h-4 w-4 text-indigo-500" />
                                Staff Performance
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Individual metrics 
                                {selectedDepartmentId !== "all" && " • filtered by department"}
                                {selectedSubDepartmentId !== "all" && " • filtered by sub-department"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px]">
                                <div className="space-y-2">
                                    {staffStats.map((staff) => (
                                        <div 
                                            key={staff.id} 
                                            className="flex items-center justify-between p-3 border border-l-2 border-l-indigo-500 hover:bg-muted/50 transition-colors cursor-pointer"
                                            onClick={() => setSelectedStaffId(String(staff.id))}
                                        >
                                            <div className="flex items-center gap-3">
                                                  <Avatar className="h-9 w-9 rounded-none ring-1 ring-muted-foreground/20 flex-shrink-0">
                            {staff.avatarUrl ? (
                                <AvatarImage src={staff.avatarUrl} alt={staff.name || ''} className="rounded-none" />
                            ) : (
                                <AvatarFallback className="rounded-none bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-medium text-xs">
                                    {staff.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                                </AvatarFallback>
                            )}
                        </Avatar>
                                                <div>
                                                    <p className="font-medium text-sm">{staff.name}</p>
                                                    <p className="text-xs text-muted-foreground">{staff.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-center">
                                                    <p className="text-base font-semibold">{staff.total}</p>
                                                    <p className="text-xs text-muted-foreground">Submissions</p>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Badge variant="outline" className="rounded-none bg-green-50 text-green-700 border-green-200">
                                                        <CheckCircle className="h-3 w-3 mr-1" />
                                                        {staff.verified}
                                                    </Badge>
                                                    <Badge variant="outline" className="rounded-none bg-amber-50 text-amber-700 border-amber-200">
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        {staff.pending}
                                                    </Badge>
                                                    <Badge variant="outline" className="rounded-none bg-red-50 text-red-700 border-red-200">
                                                        <XCircle className="h-3 w-3 mr-1" />
                                                        {staff.rejected}
                                                    </Badge>
                                                </div>
                                                <div className="text-center min-w-[50px]">
                                                    <p className="text-base font-semibold text-purple-600">{staff.hours}h</p>
                                                    <p className="text-xs text-muted-foreground">Hours</p>
                                                </div>
                                                <div className="text-center min-w-[50px]">
                                                    <p className={`text-base font-semibold ${staff.approvalRate >= 80 ? 'text-green-600' : staff.approvalRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                        {staff.approvalRate}%
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">Approval</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {staffStats.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground">
                                            No staff members found with current filters
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Responsibilities Tab */}
                <TabsContent value="responsibilities" className="space-y-4">
                    <Card className="rounded-none">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Briefcase className="h-4 w-4 text-indigo-500" />
                                Responsibilities
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Performance by responsibility
                                {selectedDepartmentId !== "all" && " • filtered"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px]">
                                <div className="space-y-2">
                                    {responsibilityStats.map((resp) => (
                                        <div 
                                            key={resp.id} 
                                            className="p-3 border border-l-2 border-l-purple-500 hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Target className="h-3 w-3 text-purple-500" />
                                                    <span className="font-medium text-sm">{resp.title}</span>
                                                </div>
                                                <Badge variant={resp.isActive ? "default" : "secondary"} className="rounded-none text-xs">
                                                    {resp.isActive ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </div>
                                            {/* Department and Sub-department info */}
                                            <div className="flex flex-wrap gap-1 mb-2">
                                                <Badge variant="outline" className="rounded-none text-xs">
                                                    <Building2 className="h-3 w-3 mr-1" />
                                                    {resp.departmentName}
                                                </Badge>
                                                <Badge variant="outline" className="rounded-none text-xs ">
                                                    <Layers className="h-3 w-3 mr-1" />
                                                    {resp.subDepartmentName}
                                                </Badge>
                                            </div>
                                            {resp.description && (
                                                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{resp.description}</p>
                                            )}
                                            {/* Assigned Staff List */}
                                            {resp.assignedStaffList.length > 0 && (
                                                <div className="mb-2">
                                                    <p className="text-xs font-medium text-muted-foreground mb-1">Assigned:</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {resp.assignedStaffList.slice(0, 5).map((staff) => (
                                                            <Badge key={staff.id} variant="secondary" className="rounded-none text-xs">
                                                                <Users className="h-3 w-3 mr-1" />
                                                                {staff.name}
                                                            </Badge>
                                                        ))}
                                                        {resp.assignedStaffList.length > 5 && (
                                                            <Badge variant="secondary" className="rounded-none text-xs">
                                                                +{resp.assignedStaffList.length - 5} more
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-4 gap-2 text-center">
                                                <div className="p-2 bg-muted">
                                                    <p className="text-base font-semibold text-blue-600">{resp.assignedStaff}</p>
                                                    <p className="text-xs text-muted-foreground">Assigned</p>
                                                </div>
                                                <div className="p-2 bg-muted">
                                                    <p className="text-base font-semibold text-indigo-600">{resp.totalSubmissions}</p>
                                                    <p className="text-xs text-muted-foreground">Submissions</p>
                                                </div>
                                                <div className="p-2 bg-muted">
                                                    <p className="text-base font-semibold text-green-600">{resp.verified}</p>
                                                    <p className="text-xs text-muted-foreground">Verified</p>
                                                </div>
                                                <div className="p-2 bg-muted">
                                                    <p className={`text-base font-semibold ${resp.completionRate >= 80 ? 'text-green-600' : resp.completionRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                        {resp.completionRate}%
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">Completion</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {responsibilityStats.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground">
                                            No responsibilities found with current filters
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

   
         {/* Quick Actions */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <Card className="rounded-none border-l-2 border-l-blue-500 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Link href="/admin/users">
                        <CardHeader className="py-4">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                <FileCheck className="h-4 w-4 text-blue-500" />
                               Manage Users
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Create, edit, delete and reset passwords
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>

                <Card className="rounded-none border-l-2 border-l-green-500 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Link href="/admin/departments">
                        <CardHeader className="py-4">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                <ClipboardList className="h-4 w-4 text-green-500" />
                                Manage Departments
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Create and manage departments
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>

                <Card className="rounded-none border-l-2 border-l-purple-500 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Link href="/admin/responsibilities">
                        <CardHeader className="py-4">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                <Briefcase className="h-4 w-4 text-purple-500" />
                                Manage Responsibilities
                            </CardTitle>
                            <CardDescription className="text-xs">
                               Manage responsibilities in organization
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>

                <Card className="rounded-none border-l-2 border-l-amber-500 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Link href="/admin/work-submissions">
                        <CardHeader className="py-4">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                <Target className="h-4 w-4 text-amber-500" />
                                Work Submissions
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Review and verify submissions
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>
            </div>
    </div>
  )
}