"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { Employee, WorkSubmission } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Search,
    User,
    Mail,
    Building,
    Clock,
    ChevronRight,
} from "lucide-react"


export default function ManagerStaffPage() {
    const router = useRouter()
    const [staff, setStaff] = useState<Employee[]>([])
    const [submissions, setSubmissions] = useState<WorkSubmission[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        try {
            const [employees, allSubmissions] = await Promise.all([
                api.employees.getAll(),
                api.workSubmissions.getAll(),
            ])
            // Backend already scopes to sub-department, filter for STAFF and MANAGER roles
            setStaff(employees.filter(e => e.role === 'STAFF' || e.role === 'MANAGER'))
            setSubmissions(allSubmissions)
        } catch (error) {
            console.error("Failed to fetch data:", error)
        } finally {
            setIsLoading(false)
        }
    }

    // Get pending submission count for a staff member
    function getPendingCount(staffId: string): number {
        return submissions.filter(
            s => s.staffId === staffId && (s.status === 'SUBMITTED' || s.status === 'PENDING')
        ).length
    }

    const filteredStaff = staff.filter(s =>
        s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    function handleStaffClick(staffId: string) {
        router.push(`/manager/staff/${staffId}`)
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
            <div>
                <h1 className="text-3xl  tracking-tight">My Staff</h1>
                <p className="text-muted-foreground">
                    View staff members and their work submissions
                </p>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Staff List */}
            <Card>
                <CardHeader>
                    <CardTitle>Staff Members</CardTitle>
                    <CardDescription>
                        {filteredStaff.length} staff member{filteredStaff.length !== 1 ? 's' : ''} - Click to view submissions
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredStaff.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            No staff members found
                        </p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {filteredStaff.map((member) => {
                                const pendingCount = getPendingCount(member.id)
                                return (
                                    <Card
                                        key={member.id}
                                        className="p-4 cursor-pointer hover:shadow-md transition-all hover:border-primary group"
                                        onClick={() => handleStaffClick(member.id)}
                                    >
                                        <div className="flex items-start gap-4">
                                            <Avatar className="h-20 w-20 ring-2 ring-primary/20 hover:ring-primary/40 transition-all border-2 border-background shadow-sm flex-shrink-0">
                                                {member.avatarUrl ? (
                                                    <AvatarImage src={member.avatarUrl} alt={member.name || ''} />
                                                ) : (
                                                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-semibold text-sm">
                                                        {member.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                                                    </AvatarFallback>
                                                )}
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-medium truncate">{member.name}</p>
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                </div>
                                                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                                    <Mail className="h-3 w-3" />
                                                    <span className="truncate">{member.email}</span>
                                                </div>
                                                {member.subDepartment && (
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                                        <Building className="h-3 w-3" />
                                                        <span className="truncate">{member.subDepartment.name}</span>
                                                    </div>
                                                )}
                                                {/* Pending Submissions Badge */}
                                                {pendingCount > 0 && (
                                                    <Badge
                                                        variant="secondary"
                                                        className="mt-2 bg-secondary text-secondary-foreground border border-border shadow-sm hover:bg-amber-200"
                                                    >
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        {pendingCount} pending
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
