"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/providers/auth-context"
import { api } from "@/lib/api"
import { Timetable } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarCheck, UserCheck, FolderOpen } from "lucide-react"

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function StaffTimetablePage() {
    const { user } = useAuth()
    const [timetable, setTimetable] = useState<Timetable | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!user) return
        fetchTimetable()
    }, [user])

    const fetchTimetable = async () => {
        setIsLoading(true)
        try {
            // Staff can only see published timetables. The backend will return them directly.
            const tts = await api.timetables.getAll()
            
            if (tts.length > 0) {
                // Fetch full details of the most recent published timetable
                const fullTt = await api.timetables.getById(tts[0].id)
                setTimetable(fullTt)
            }
        } catch (error: any) {
            console.error("Failed to fetch timetable", error)
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-[400px]" />
            </div>
        )
    }

    if (!timetable) {
        return (
            <div className="p-6">
                <div className="flex items-center gap-2 mb-6">
                    <CalendarCheck className="h-8 w-8 text-primary" />
                    <h1 className="text-3xl font-bold tracking-tight">Active Timetable</h1>
                </div>
                <div className="h-[400px] flex flex-col items-center justify-center p-12 bg-muted/20 rounded-xl border border-dashed">
                    <CalendarCheck className="h-16 w-16 text-muted-foreground/30 mb-4" />
                    <h3 className="text-xl font-medium mb-1">No Published Timetable</h3>
                    <p className="text-muted-foreground text-center max-w-sm">
                        There is currently no published timetable available for your sub-department. 
                        Please check back later or contact your manager.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <CalendarCheck className="h-8 w-8 text-primary" />
                        Department Timetable
                    </h1>
                    <p className="text-muted-foreground">
                        {timetable.subDepartment?.department?.name} • {timetable.subDepartment?.name}
                    </p>
                </div>
            </div>

            <Card className="h-full border-t-4 border-t-primary shadow-sm">
                <CardHeader className="pb-4 border-b">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-2xl">Weekly Schedule</CardTitle>
                            <CardDescription>
                                Currently active timetable
                            </CardDescription>
                        </div>
                        <Badge className="bg-green-600">Active</Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <Tabs defaultValue={DAYS[0]}>
                        <TabsList className="mb-4 flex flex-wrap h-auto">
                            {DAYS.map(day => (
                                <TabsTrigger key={day} value={day} className="flex-1 min-w-[100px]">
                                    {day}
                                    <Badge variant="secondary" className="ml-2 text-[10px]">
                                        {timetable.entries?.filter(e => e.day === day).length || 0}
                                    </Badge>
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        {DAYS.map(day => {
                            const entries = timetable.entries?.filter(e => e.day === day) || [];
                            // Sort by start time
                            entries.sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

                            return (
                                <TabsContent key={day} value={day} className="space-y-4 focus-visible:outline-none">
                                    {entries.length === 0 ? (
                                        <div className="text-center py-12 bg-muted/10 rounded-lg border border-dashed">
                                            <CalendarCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                            <p className="text-muted-foreground">No sessions scheduled for {day}</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {entries.map(entry => {
                                                const t1 = new Date(entry.startTime);
                                                const t2 = new Date(entry.endTime);
                                                // const tm1 = `${String(t1.getUTCHours()).padStart(2,'0')}:${String(t1.getUTCMinutes()).padStart(2,'0')}`
                                                // const tm2 = `${String(t2.getUTCHours()).padStart(2,'0')}:${String(t2.getUTCMinutes()).padStart(2,'0')}`
                                                const tm1 = `${String(t1.getHours()).padStart(2,'0')}:${String(t1.getMinutes()).padStart(2,'0')}`
                                                const tm2 = `${String(t2.getHours()).padStart(2,'0')}:${String(t2.getMinutes()).padStart(2,'0')}`
                                                
                                                const isMyClass = String(entry.staffId) === String(user?.id);
                                                
                                                return (
                                                <div key={entry.id} className={`flex flex-col sm:flex-row sm:items-center p-4 rounded-xl border shadow-sm transition-all ${isMyClass ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' : 'bg-card'}`}>
                                                    <div className="flex items-start sm:items-center gap-4 w-full">
                                                        <div className={`font-mono font-semibold px-3 py-2 rounded-lg min-w-[130px] text-center shrink-0 border ${isMyClass ? 'bg-primary text-primary-foreground border-primary' : 'bg-primary/10 text-primary border-primary/20'}`}>
                                                            {tm1} - {tm2}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3">
                                                                <h4 className="font-bold text-lg">{entry.topic}</h4>
                                                                {isMyClass && <Badge variant="default" className="text-[10px]">Your Class</Badge>}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-muted-foreground">
                                                                <span className="flex items-center text-foreground/80 font-medium bg-muted px-2 py-0.5 rounded">
                                                                    {entry.batch}
                                                                </span>
                                                                <span className="flex items-center">
                                                                    <UserCheck className="h-4 w-4 mr-1.5 opacity-70" /> 
                                                                    {entry.staff?.name}
                                                                </span>
                                                                <span className="flex items-center">
                                                                    <FolderOpen className="h-4 w-4 mr-1.5 opacity-70" /> 
                                                                    {entry.classroom?.name}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )})}
                                        </div>
                                    )}
                                </TabsContent>
                            )
                        })}
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}
