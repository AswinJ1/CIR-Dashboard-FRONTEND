"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
    CalendarCheck, 
    Clock, 
    CheckCircle, 
    XCircle,
    CalendarX,
    Send
} from "lucide-react"
import { DayStatus } from "@/types/cir"

interface DailyMetrics {
    todayStatus: DayStatus
    todayHours: number
    todayVerifiedHours: number
    verifiedDaysCount: number
    missedDaysCount: number
    totalSubmittedDays: number
    totalRejectedCount: number
}

interface DailyMetricsCardsProps {
    metrics: DailyMetrics
    isLoading?: boolean
}

export function DailyMetricsCards({ metrics, isLoading = false }: DailyMetricsCardsProps) {
    const getTodayStatusDisplay = (status: DayStatus): { label: string; color: string } => {
        switch (status) {
            case 'VERIFIED':
                return { label: 'Verified', color: 'text-foreground' }
            case 'SUBMITTED':
                return { label: 'Submitted', color: 'text-foreground' }
            case 'REJECTED':
                return { label: 'Rejected', color: 'text-foreground' }
            case 'PARTIAL':
                return { label: 'Partial', color: 'text-orange-500' }
            case 'NOT_SUBMITTED':
            default:
                return { label: 'Not Submitted', color: 'text-slate-500' }
        }
    }

    const todayDisplay = getTodayStatusDisplay(metrics.todayStatus)

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            {/* <div className="h-4 w-24 bg-muted animate-pulse rounded" /> */}
                        </CardHeader>
                        <CardContent>
                            {/* <div className="h-8 w-16 bg-muted animate-pulse rounded" /> */}
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Today's Status */}
            <Card className="border-l-4 ">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Today's Status</CardTitle>
                    {/* <Send className={`h-4 w-4 ${todayDisplay.color}`} /> */}
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl  ${todayDisplay.color}`}>
                        {todayDisplay.label}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {metrics.todayStatus === 'NOT_SUBMITTED' 
                            ? 'Submit your work for today' 
                            : 'Work recorded for today'}
                    </p>
                </CardContent>
            </Card>

            {/* Today's Hours */}
            <Card className="border-l-4 ">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Today's Hours</CardTitle>
                    {/* <Clock className="h-4 w-4 text-foreground" /> */}
                </CardHeader>
                <CardContent>
                    <div className="text-2xl ">{metrics.todayHours}</div>
                    <p className="text-xs text-muted-foreground">
                        {metrics.todayVerifiedHours > 0 
                            ? `${metrics.todayVerifiedHours} verified` 
                            : 'Hours submitted today'}
                    </p>
                </CardContent>
            </Card>

            {/* Verified Days */}
            <Card className="border-l-4 ">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium"> Verified Days</CardTitle>
                    {/* <CheckCircle className="h-4 w-4 text-foreground" /> */}
                </CardHeader>
                <CardContent>
                    <div className="text-2xl ">{metrics.verifiedDaysCount}</div>
                    <p className="text-xs text-muted-foreground">
                        Days with approved work
                    </p>
                </CardContent>
            </Card>

            {/* Missed Days */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Missed Days</CardTitle>
                    {/* <CalendarX className={`h-4 w-4 ${metrics.missedDaysCount > 0 ? 'text-foreground' : 'text-slate-400'}`} /> */}
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl  ${metrics.missedDaysCount > 0 ? 'text-foreground' : ''}`}>
                        {metrics.missedDaysCount}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Days with no submissions since joining
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
