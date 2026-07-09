"use client"

import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@/components/providers/auth-context"
import { api } from "@/lib/api"
import { Timetable, TimetableEntry, Classroom, Role } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, CalendarCheck, Plus, Trash2, Edit, FileDown, AlertTriangle, AlertCircle, RefreshCw, UserCheck, FolderOpen } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const TIME_SLOTS = [
    { label: 'Period 1 — 9:00 to 9:50', start: '09:00', end: '09:50' },
    { label: 'Period 2 — 9:50 to 10:40', start: '09:50', end: '10:40' },
    { label: 'Period 3 — 10:50 to 11:40', start: '10:50', end: '11:40' },
    { label: 'Period 4 — 11:40 to 12:30', start: '11:40', end: '12:30' },
    { label: 'Period 5 — 12:30 to 13:20', start: '12:30', end: '13:20' },
    { label: 'Period 6 — 13:20 to 14:10', start: '13:20', end: '14:10' },
    { label: 'Period 7 — 14:10 to 15:00', start: '14:10', end: '15:00' },
    { label: 'Period 8 — 15:10 to 16:00', start: '15:10', end: '16:00' },
    { label: 'Period 9 — 16:00 to 16:50', start: '16:00', end: '16:50' },
]

export default function ManagerTimetablePage() {
    const { user } = useAuth()
    const [timetables, setTimetables] = useState<Timetable[]>([])
    const [selectedTimetable, setSelectedTimetable] = useState<Timetable | null>(null)
    const [classrooms, setClassrooms] = useState<Classroom[]>([])
    const [assignableStaff, setAssignableStaff] = useState<{ id: number; name: string; email: string; role: string }[]>([])
    
    const [isLoading, setIsLoading] = useState(true)
    const [isActionLoading, setIsActionLoading] = useState(false)

    // Form State
    const [isEntryModalOpen, setIsEntryModalOpen] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [semesterDates, setSemesterDates] = useState({ start: "2026-01-05", end: "2026-06-30" })
    
    const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null)
    const [formData, setFormData] = useState({
        day: "",
        staffId: "",
        batch: "",
        topic: "",
        startTime: "",
        endTime: "",
        classroomId: ""
    })

    useEffect(() => {
        if (!user) return
        fetchData()
    }, [user])

    const fetchData = async () => {
        setIsLoading(true)
        try {
            const [ttData, crData] = await Promise.all([
                api.timetables.getAll(),
                api.classrooms.getAll()
            ])
            setTimetables(ttData)
            setClassrooms(crData.filter(c => c.isActive))
            
            if (ttData.length > 0 && !selectedTimetable) {
                handleSelectTimetable(ttData[0].id)
            }
            
            if (user?.subDepartmentId) {
                const staffData = await api.timetables.getAssignableStaff(Number(user.subDepartmentId))
                setAssignableStaff(staffData)
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to load timetable data")
        } finally {
            setIsLoading(false)
        }
    }

    const handleSelectTimetable = async (id: number) => {
        setIsActionLoading(true)
        try {
            const data = await api.timetables.getById(id)
            setSelectedTimetable(data)
        } catch (error: any) {
            toast.error(error.message || "Failed to load timetable details")
        } finally {
            setIsActionLoading(false)
        }
    }

    const handleCreateTimetable = async () => {
        setIsCreateModalOpen(true)
    }

    const confirmCreate = async () => {
        if (!user?.subDepartmentId) return toast.error("Missing Sub-Department ID")
        if (!semesterDates.start || !semesterDates.end) return toast.error("Start and end dates are required")

        setIsActionLoading(true)
        try {
            const created = await api.timetables.create(Number(user.subDepartmentId), semesterDates.start, semesterDates.end)
            toast.success("Timetable created successfully")
            setIsCreateModalOpen(false)
            fetchData()
            handleSelectTimetable(created.id)
        } catch (error: any) {
            toast.error(error.message || "Failed to create timetable")
        } finally {
            setIsActionLoading(false)
        }
    }

    const handleDeleteTimetable = async (id: number) => {
        if (!confirm("Are you sure you want to delete this full timetable? This cannot be undone.")) return
        setIsActionLoading(true)
        try {
            await api.timetables.delete(id)
            toast.success("Timetable deleted")
            if (selectedTimetable?.id === id) setSelectedTimetable(null)
            fetchData()
        } catch (error: any) {
            toast.error(error.message || "Failed to delete timetable")
        } finally {
            setIsActionLoading(false)
        }
    }

    const handlePublishToggle = async () => {
        if (!selectedTimetable) return
        if (selectedTimetable.isPublished) {
            if (!confirm("Are you sure you want to unpublish? This will completely remove all auto-generated bookings.")) return;
            setIsActionLoading(true)
            try {
                await api.timetables.unpublish(selectedTimetable.id)
                toast.success("Timetable unpublished successfully")
                handleSelectTimetable(selectedTimetable.id)
                fetchData()
            } catch (error: any) {
                toast.error(error.message || "Action failed")
            } finally {
                setIsActionLoading(false)
            }
        } else {
            setIsActionLoading(true)
            try {
                await api.timetables.publish(selectedTimetable.id)
                toast.success("Timetable published & bookings locked!")
                handleSelectTimetable(selectedTimetable.id)
                fetchData()
            } catch (error: any) {
                toast.error(error.message || "Publish failed")
            } finally {
                setIsActionLoading(false)
            }
        }
    }

    const openCreateEntryModal = () => {
        setEditingEntry(null)
        setFormData({
            day: "",
            staffId: "",
            batch: "",
            topic: "",
            startTime: "",
            endTime: "",
            classroomId: ""
        })
        setIsEntryModalOpen(true)
    }

    const openEditEntryModal = (entry: TimetableEntry) => {
        const formatTime = (isoString: string) => {
            const date = new Date(isoString);
            return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }
        setEditingEntry(entry)
        setFormData({
            day: entry.day,
            staffId: String(entry.staffId),
            batch: entry.batch,
            topic: entry.topic,
            startTime: formatTime(entry.startTime),
            endTime: formatTime(entry.endTime),
            classroomId: String(entry.classroomId)
        })
        setIsEntryModalOpen(true)
    }

    const handleSaveEntry = async () => {
        if (!selectedTimetable) return
        if (!formData.day || !formData.staffId || !formData.startTime || !formData.endTime || !formData.classroomId) {
            return toast.error("Please fill all required fields")
        }

        setIsActionLoading(true)
        try {
            const DAY_REFERENCE_DATES: Record<string, string> = {
                Monday: '2026-01-05',
                Tuesday: '2026-01-06',
                Wednesday: '2026-01-07',
                Thursday: '2026-01-08',
                Friday: '2026-01-09',
                Saturday: '2026-01-10',
            }
            
            const refDate = DAY_REFERENCE_DATES[formData.day] || '2026-01-05'
            const sISO = new Date(`${refDate}T${formData.startTime}:00`).toISOString()
            const eISO = new Date(`${refDate}T${formData.endTime}:00`).toISOString()

            const payload = {
                day: formData.day,
                staffId: Number(formData.staffId),
                batch: formData.batch,
                topic: formData.topic,
                startTime: sISO,
                endTime: eISO,
                classroomId: Number(formData.classroomId)
            }

            if (editingEntry) {
                await api.timetables.updateEntry(selectedTimetable.id, editingEntry.id, payload)
                toast.success("Entry updated")
            } else {
                await api.timetables.addEntry(selectedTimetable.id, payload)
                toast.success("Entry added")
            }
            
            setIsEntryModalOpen(false)
            handleSelectTimetable(selectedTimetable.id)
        } catch (error: any) {
            toast.error(error.message || "Conflict or validation error")
        } finally {
            setIsActionLoading(false)
        }
    }

    const handleDeleteEntry = async (entryId: number) => {
        if (!selectedTimetable) return
        if (!confirm("Remove this entry?")) return
        setIsActionLoading(true)
        try {
            await api.timetables.removeEntry(selectedTimetable.id, entryId)
            toast.success("Entry removed")
            handleSelectTimetable(selectedTimetable.id)
        } catch (error: any) {
             toast.error(error.message || "Failed to remove entry")
        } finally {
            setIsActionLoading(false)
        }
    }

    // Export to Excel matching the exact CIR faculty timetable format
    const handleExport = async () => {
        if (!selectedTimetable || !selectedTimetable.entries) return
        
        try {
            const { exportTimetableToExcel } = await import('@/lib/timetable-export')
            await exportTimetableToExcel({
                entries: selectedTimetable.entries,
                subDepartmentName: selectedTimetable.subDepartment?.name || 'Unknown',
                timetableId: selectedTimetable.id,
                departmentName: selectedTimetable.subDepartment?.department?.name,
                semesterStartDate: selectedTimetable.semesterStartDate,
                semesterEndDate: selectedTimetable.semesterEndDate,
            })
            toast.success("Excel file generated")
        } catch (error) {
            console.error("Export error", error)
            toast.error("Failed to generate Excel file")
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

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl  tracking-tight flex items-center gap-2">
                        <CalendarCheck className="h-8 w-8 text-primary" />
                        Timetable Management
                    </h1>
                    <p className="text-muted-foreground">Manage class schedules for your sub-department</p>
                </div>
                <Button onClick={handleCreateTimetable} disabled={isActionLoading}>
                    <Plus className="mr-2 h-4 w-4" /> Create Timetable
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar: List of Timetables */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Timetables</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {timetables.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No timetables found</p>
                        ) : (
                            <div className="space-y-2">
                                {timetables.map(tt => (
                                    <div 
                                        key={tt.id}
                                        onClick={() => handleSelectTimetable(tt.id)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between ${selectedTimetable?.id === tt.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted'}`}
                                    >
                                        <div>
                                            <p className="font-medium text-sm">Version {tt.id}</p>
                                            <p className="text-xs text-muted-foreground truncate">{format(new Date(tt.createdAt), 'dd MMM yyyy')}</p>
                                        </div>
                                        <Badge variant={tt.isPublished ? "default" : "secondary"} className="text-xs">
                                            {tt.isPublished ? "Published" : "Draft"}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Main Content: Timetable Details */}
                <div className="lg:col-span-3">
                    {selectedTimetable ? (
                        <Card className="h-full border-t-4 border-t-primary shadow-sm">
                            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-2xl">Timetable v{selectedTimetable.id}</CardTitle>
                                        <Badge variant={selectedTimetable.isPublished ? "default" : "secondary"}>
                                            {selectedTimetable.isPublished ? "Published (Locked)" : "Draft Mode"}
                                        </Badge>
                                    </div>
                                    <CardDescription>
                                        Sub-Department: <span className="font-medium">{selectedTimetable.subDepartment?.name}</span>
                                    </CardDescription>
                                    {!selectedTimetable.isPublished && (
                                        <div className="flex items-center text-xs text-muted-foreground bg-secondary/50 p-2 rounded-md mt-2 border border-border">
                                            <AlertTriangle className="h-3 w-3 mr-1.5" />
                                            Changes won't lock classrooms until published
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {selectedTimetable.isPublished ? (
                                        <Button 
                                            variant="outline" 
                                            onClick={handlePublishToggle} 
                                            disabled={isActionLoading}
                                            title="Unpublish to make edits"
                                        >
                                            <RefreshCw className="mr-2 h-4 w-4" /> Unpublish
                                        </Button>
                                    ) : (
                                        <Button 
                                            variant="default" 
                                            onClick={handlePublishToggle} 
                                            disabled={isActionLoading || (selectedTimetable.entries?.length === 0)}
                                        >
                                            <CalendarCheck className="mr-2 h-4 w-4" /> Publish & Lock
                                        </Button>
                                    )}
                                    <Button variant="outline" onClick={handleExport} disabled={isActionLoading || !selectedTimetable.entries?.length}>
                                        <FileDown className="mr-2 h-4 w-4" /> Export
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={() => handleDeleteTimetable(selectedTimetable.id)} disabled={isActionLoading}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="mb-6 flex justify-between items-center bg-muted/30 p-3 rounded-lg border">
                                    <div className="flex flex-col gap-1">
                                        <div className="text-sm">
                                            <span className="font-semibold text-primary">{selectedTimetable.entries?.length || 0}</span> scheduled sessions total
                                        </div>
                                        {selectedTimetable.semesterStartDate && selectedTimetable.semesterEndDate && (
                                            <div className="text-xs text-muted-foreground flex items-center">
                                                <Calendar className="mr-1 h-3 w-3 inline" />
                                                {format(new Date(selectedTimetable.semesterStartDate), "MMM d, yyyy")} - {format(new Date(selectedTimetable.semesterEndDate), "MMM d, yyyy")}
                                            </div>
                                        )}
                                    </div>
                                    {!selectedTimetable.isPublished && (
                                        <Button size="sm" onClick={openCreateEntryModal} disabled={isActionLoading}>
                                            <Plus className="h-4 w-4 mr-1" /> Add Session
                                        </Button>
                                    )}
                                </div>

                                <Tabs defaultValue={DAYS[0]}>
                                    <TabsList className="mb-4 flex flex-wrap h-auto">
                                        {DAYS.map(day => (
                                            <TabsTrigger key={day} value={day} className="flex-1 min-w-[100px]">
                                                {day.substring(0,3)}
                                                <Badge variant="secondary" className="ml-2 text-[10px]">
                                                    {selectedTimetable.entries?.filter(e => e.day === day).length || 0}
                                                </Badge>
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>

                                    {DAYS.map(day => {
                                        const entries = selectedTimetable.entries?.filter(e => e.day === day) || [];
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
                                                            const tm1 = `${String(t1.getHours()).padStart(2,'0')}:${String(t1.getMinutes()).padStart(2,'0')}`
                                                            const tm2 = `${String(t2.getHours()).padStart(2,'0')}:${String(t2.getMinutes()).padStart(2,'0')}`
                                                            
                                                            return (
                                                            <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-card rounded-xl border shadow-sm hover:shadow transition-shadow group">
                                                                <div className="flex items-start sm:items-center gap-4">
                                                                    <div className="bg-primary/10 text-primary font-mono font-semibold px-3 py-1.5 rounded-md min-w-[120px] text-center shrink-0 border border-primary/20">
                                                                        {tm1} - {tm2}
                                                                    </div>
                                                                    <div>
                                                                        <h4 className=" text-base flex items-center gap-2">
                                                                            {entry.topic}
                                                                            <Badge variant="outline" className="font-normal text-xs">{entry.batch}</Badge>
                                                                        </h4>
                                                                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                                                            <span className="flex items-center"><UserCheck className="h-3 w-3 mr-1 inline" /> {entry.staff?.name}</span>
                                                                            <span className="flex items-center"><FolderOpen className="h-3 w-3 mr-1 inline" /> {entry.classroom?.name}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {!selectedTimetable.isPublished && (
                                                                    <div className="flex gap-2 mt-3 sm:mt-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <Button variant="outline" size="sm" onClick={() => openEditEntryModal(entry)}>
                                                                            <Edit className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteEntry(entry.id)}>
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                )}
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
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-12 bg-muted/20 rounded-xl border border-dashed">
                            <CalendarCheck className="h-16 w-16 text-muted-foreground/30 mb-4" />
                            <h3 className="text-xl font-medium mb-1">No Timetable Selected</h3>
                            <p className="text-muted-foreground text-center max-w-sm mb-6">Select a timetable from the sidebar to view details, or create a new one to get started.</p>
                            <Button onClick={handleCreateTimetable} disabled={isActionLoading}>
                                <Plus className="mr-2 h-4 w-4" /> Create Timetable
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={isEntryModalOpen} onOpenChange={setIsEntryModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingEntry ? 'Edit Session' : 'Add New Session'}</DialogTitle>
                        <DialogDescription>
                            Schedule a class session. Overlapping conflicts will be automatically validated.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Day</Label>
                                <Select value={formData.day} onValueChange={(v) => setFormData({...formData, day: v})}>
                                    <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
                                    <SelectContent>
                                        {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Classroom</Label>
                                <Select value={formData.classroomId} onValueChange={(v) => setFormData({...formData, classroomId: v})}>
                                    <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                                    <SelectContent>
                                        {classrooms.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Assigned Staff</Label>
                            <Select value={formData.staffId} onValueChange={(v) => setFormData({...formData, staffId: v})}>
                                <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                                <SelectContent>
                                    {assignableStaff.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.role})</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="batch">Batch</Label>
                                <Input id="batch" placeholder="e.g. S5CSE" value={formData.batch} onChange={(e) => setFormData({...formData, batch: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="topic">Topic</Label>
                                <Input id="topic" placeholder="e.g. Verbal Training" value={formData.topic} onChange={(e) => setFormData({...formData, topic: e.target.value})} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Time Slot</Label>
                            <Select 
                                value={formData.startTime && formData.endTime ? `${formData.startTime}-${formData.endTime}` : ''} 
                                onValueChange={(v) => {
                                    const slot = TIME_SLOTS.find(s => `${s.start}-${s.end}` === v)
                                    if (slot) setFormData({...formData, startTime: slot.start, endTime: slot.end})
                                }}
                            >
                                <SelectTrigger><SelectValue placeholder="Select time slot" /></SelectTrigger>
                                <SelectContent>
                                    {TIME_SLOTS.map(s => (
                                        <SelectItem key={`${s.start}-${s.end}`} value={`${s.start}-${s.end}`}>{s.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEntryModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveEntry} disabled={isActionLoading}>
                            {isActionLoading ? "Saving..." : "Save Session"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Timetable Modal */}
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Create Timetable</DialogTitle>
                        <DialogDescription>
                            Please select the semester dates for this timetable. This will be used when it is published.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="semStart">Semester Start Date</Label>
                            <Input id="semStart" type="date" value={semesterDates.start} onChange={(e) => setSemesterDates({...semesterDates, start: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="semEnd">Semester End Date</Label>
                            <Input id="semEnd" type="date" value={semesterDates.end} onChange={(e) => setSemesterDates({...semesterDates, end: e.target.value})} />
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                        <Button onClick={confirmCreate} disabled={isActionLoading}>
                            {isActionLoading ? "Creating..." : "Create Timetable"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
