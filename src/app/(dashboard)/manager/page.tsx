"use client"

import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@/components/providers/auth-context"
import { api } from "@/lib/api"
import { Employee, Assignment, WorkSubmission } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SubmissionStatusBadge } from "@/components/ui/status-badge"
import { CreateResponsibilityDialog } from "@/components/manager/create-responsibility-dialog"
import Link from "next/link"
import { format } from "date-fns"
import {
    Users,
    ClipboardList,
    FileCheck,
    Clock,
    CheckCircle,
    XCircle,
    ArrowRight,
    Plus,
    Briefcase,
} from "lucide-react"
import { getSubmissionsForDate, getToday } from "@/lib/responsibility-status"
import DashboardHeader from "@/components/dashboard-header"

interface DashboardStats {
    teamSize: number
    totalAssignments: number
    pendingVerifications: number
    verifiedCount: number
    rejectedCount: number
}

export default function ManagerDashboardPage() {
    const { user } = useAuth()
    const [stats, setStats] = useState<DashboardStats>({
        teamSize: 0,
        totalAssignments: 0,
        pendingVerifications: 0,
        verifiedCount: 0,
        rejectedCount: 0,
    })
    const [pendingSubmissions, setPendingSubmissions] = useState<WorkSubmission[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [allSubmissions, setAllSubmissions] = useState<WorkSubmission[]>([])

    const today = useMemo(() => getToday(), [])

    useEffect(() => {
        async function fetchDashboardData() {
            try {
                const [employees, assignments, submissions] = await Promise.all([
                    api.employees.getAll(),
                    api.assignments.getAll(),
                    api.workSubmissions.getAll(),
                ])

                // Filter for STAFF only (sub-department isolation handled by backend)
                const staffMembers = employees.filter(e => e.role === 'STAFF')
                
                // Get TODAY's submissions for proper status checking
                const todaySubmissions = getSubmissionsForDate(submissions, today)
                
                // Count pending verifications from TODAY's submissions only
                // A submission is pending for verification if it's SUBMITTED status
                const pendingForVerification = todaySubmissions.filter(s => 
                    (s.status === 'SUBMITTED') || (s.assignment?.status === 'SUBMITTED')
                )
                
                // Count verified from today's submissions
                const verifiedToday = todaySubmissions.filter(s => 
                    (s.status === 'VERIFIED') || (s.assignment?.status === 'VERIFIED')
                )
                
                // Count rejected from today's submissions
                const rejectedToday = todaySubmissions.filter(s => 
                    (s.status === 'REJECTED') || (s.assignment?.status === 'REJECTED')
                )

                setStats({
                    teamSize: staffMembers.length,
                    totalAssignments: assignments.length,
                    pendingVerifications: pendingForVerification.length,
                    verifiedCount: verifiedToday.length,
                    rejectedCount: rejectedToday.length,
                })

                // Get pending submissions for verification (SUBMITTED status from all time for review)
                const allPending = submissions.filter(s => 
                    (s.status === 'SUBMITTED') || (s.assignment?.status === 'SUBMITTED')
                )
                setPendingSubmissions(allPending.slice(0, 5))
                setAllSubmissions(submissions)
            } catch (error) {
                console.error("Failed to fetch dashboard data:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchDashboardData()
    }, [today])

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
            <DashboardHeader/>
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Manager Dashboard</h1>
                    <p className="text-muted-foreground">
                        Welcome back, {user?.name || 'Manager'}. Manage your team's work here.
                    </p>
                </div>
                {/* <CreateResponsibilityDialog onSuccess={() => window.location.reload()} /> */}
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Team Size</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.teamSize}</div>
                        <p className="text-xs text-muted-foreground">
                            Staff members
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Assignments</CardTitle>
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalAssignments}</div>
                        <p className="text-xs text-muted-foreground">
                            Active assignments
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                        <Clock className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pendingVerifications}</div>
                        <p className="text-xs text-muted-foreground">
                            Awaiting verification
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Verified</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.verifiedCount}</div>
                        <p className="text-xs text-muted-foreground">
                            Completed verifications
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Pending Verifications */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Pending Verifications</CardTitle>
                        <CardDescription>Submissions awaiting your review</CardDescription>
                    </div>
                    {stats.pendingVerifications > 0 && (
                        <Button asChild>
                            <Link href="/manager/submissions">
                                View All <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    )}
                </CardHeader>
                {/* <CardContent>
                    {pendingSubmissions.length === 0 ? (
                        <div className="text-center py-8">
                            <CheckCircle className="h-12 w-12 text-blue-500 mx-auto mb-3" />
                            <p className="text-muted-foreground">
                                All caught up! No pending verifications.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pendingSubmissions.map((submission) => (
                                <div
                                    key={submission.id}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex-1">
                                        <p className="font-medium">
                                            {submission.assignment?.responsibility?.title || 'Work Submission'}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            By {submission.staff?.name || 'Staff Member'} •
                                            {new Date(submission.submittedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <SubmissionStatusBadge status={submission.status} />
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href={`/manager/submissions`}>
                                                Review
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent> */}
            </Card>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <Link href="/manager/submissions">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileCheck className="h-5 w-5" />
                                Review Submissions
                            </CardTitle>
                            <CardDescription>
                                Review and approve staff work submissions
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <Link href="/manager/assignments">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ClipboardList className="h-5 w-5" />
                                Manage Assignments
                            </CardTitle>
                            <CardDescription>
                                Create and manage work assignments for your team
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <Link href="/manager/staff">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                My Staff
                            </CardTitle>
                            <CardDescription>
                                View staff members and their submissions
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <Link href="/manager/responsibilities">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Briefcase className="h-5 w-5" />
                                Responsibilities
                            </CardTitle>
                            <CardDescription>
                                Create and manage work responsibilities
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>
            </div>
        </div>
    )
}
