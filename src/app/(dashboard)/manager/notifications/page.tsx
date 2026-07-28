"use client"

import * as React from "react"
import { format } from "date-fns"
import {
  Plus, Pin, PinOff, Trash2, Network,
  User, Megaphone, Search, X, ChevronDown, Loader2, Pencil
} from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { useAuth } from "@/components/providers/auth-context"
import { ManagedNotice, NoticeTargetType, NoticeTargets, CreateBroadcastNoticeDto } from "@/types/cir"
import Tiptap from "@/components/tiptap"

const targetTypeConfig: Partial<Record<NoticeTargetType, { label: string; icon: React.ReactNode; color: string }>> = {
  SUB_DEPARTMENT: { label: "Sub-Department", icon: <Network className="w-3.5 h-3.5" />, color: "bg-secondary text-foreground border-border" },
  INDIVIDUAL: { label: "Individual Staff", icon: <User className="w-3.5 h-3.5" />, color: "bg-secondary text-foreground border-border" },
}

export default function ManagerNotificationsPage() {
  const [notices, setNotices] = React.useState<ManagedNotice[]>([])
  const [targets, setTargets] = React.useState<NoticeTargets>({ departments: [], subDepartments: [], staff: [] })
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [createOpen, setCreateOpen] = React.useState(false)
  const [viewNotice, setViewNotice] = React.useState<ManagedNotice | null>(null)
  const [publishing, setPublishing] = React.useState(false)

  // Form & Edit state
  const [editingNoticeId, setEditingNoticeId] = React.useState<number | null>(null)
  const [title, setTitle] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [targetType, setTargetType] = React.useState<NoticeTargetType>("SUB_DEPARTMENT")
  const [selectedUserIds, setSelectedUserIds] = React.useState<number[]>([])
  const [isPinned, setIsPinned] = React.useState(false)
  const [staffSearchOpen, setStaffSearchOpen] = React.useState(false)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const [noticesData, targetsData] = await Promise.all([
        api.notifications.getManageNotices(),
        api.notifications.getTargets(),
      ])
      setNotices(noticesData)
      setTargets(targetsData)
    } catch (err) {
      toast.error("Failed to load notices")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { loadData() }, [loadData])

  const { user, role } = useAuth()

  const resetForm = () => {
    setEditingNoticeId(null)
    setTitle("")
    setMessage("")
    setTargetType("SUB_DEPARTMENT")
    setSelectedUserIds([])
    setIsPinned(false)
  }

  const handleOpenEdit = (notice: ManagedNotice) => {
    setEditingNoticeId(notice.id)
    setTitle(notice.title)
    setMessage(notice.message)
    setTargetType(notice.targetType || "SUB_DEPARTMENT")
    setIsPinned(notice.isPinned)
    setCreateOpen(true)
  }

  const handlePublish = async () => {
    if (!title.trim()) return toast.error("Title is required")
    if (!message.trim() || message === "<p></p>") return toast.error("Message content is required")

    try {
      setPublishing(true)
      if (editingNoticeId) {
        const result = await api.notifications.updateNotice(editingNoticeId, {
          title: title.trim(),
          message,
          isPinned,
        })
        toast.success(result.message || "Notice updated")
      } else {
        const managerSubDeptId = targets.subDepartments[0]?.id
        if (targetType === "SUB_DEPARTMENT" && !managerSubDeptId) {
          return toast.error("No sub-department assigned to manager")
        }
        if (targetType === "INDIVIDUAL" && selectedUserIds.length === 0) {
          return toast.error("Select at least one staff member")
        }

        const dto: CreateBroadcastNoticeDto = {
          title: title.trim(),
          message,
          targetType,
          isPinned,
          ...(targetType === "SUB_DEPARTMENT" ? { targetId: managerSubDeptId } : {}),
          ...(targetType === "INDIVIDUAL" ? { userIds: selectedUserIds } : {}),
        }
        const result = await api.notifications.broadcastNotice(dto)
        toast.success(result.message)
      }
      setCreateOpen(false)
      resetForm()
      loadData()
    } catch (err: any) {
      toast.error(err?.message || "Failed to save notice")
    } finally {
      setPublishing(false)
    }
  }

  const handleTogglePin = async (notice: ManagedNotice) => {
    try {
      await api.notifications.togglePin(notice.id)
      toast.success(notice.isPinned ? "Notice unpinned" : "Notice pinned")
      loadData()
    } catch (err) {
      toast.error("Failed to toggle pin")
    }
  }

  const handleDelete = async (notice: ManagedNotice) => {
    try {
      await api.notifications.deleteNotice(notice.id)
      toast.success("Notice deleted")
      loadData()
    } catch (err) {
      toast.error("Failed to delete notice")
    }
  }

  const filteredNotices = React.useMemo(() => {
    if (!searchQuery.trim()) return notices
    const q = searchQuery.toLowerCase()
    return notices.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.createdBy?.name?.toLowerCase().includes(q)
    )
  }, [notices, searchQuery])

  const toggleStaffSelection = (id: number) => {
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const managerSubDeptName = targets.subDepartments[0]?.name || "Sub-Department"

  const getTargetLabel = (notice: ManagedNotice) => {
    if (notice.targetType === "ALL") return "All Staff"
    if (notice.targetType && targetTypeConfig[notice.targetType]) {
      return targetTypeConfig[notice.targetType]!.label
    }
    return "Targeted"
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Notice Board ({managerSubDeptName})
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create and publish notices for staff members in your sub-department
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm() }}>
          <DialogTrigger asChild>
            <Button className="gap-2" id="create-notice-btn">
              <Plus className="w-4 h-4" />
              Create Notice
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingNoticeId ? "Edit Notice" : "Create New Notice"}
              </DialogTitle>
              <DialogDescription>
                {editingNoticeId ? "Update existing notice details" : `Publish a notice for ${managerSubDeptName} staff`}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="edit" className="w-full mt-2">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="edit">Edit Content</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="space-y-5">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="notice-title" className="text-sm font-medium">Title</Label>
                  <Input
                    id="notice-title"
                    placeholder="Enter notice title..."
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="font-medium"
                  />
                </div>

                {/* Tiptap Editor */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Content</Label>
                  <Tiptap
                    content={message}
                    onChange={setMessage}
                    placeholder="Write your notice content here..."
                  />
                </div>

                {/* Target Type */}
                {!editingNoticeId && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Target Audience</Label>
                    <Select value={targetType} onValueChange={(v) => { setTargetType(v as NoticeTargetType); setSelectedUserIds([]) }}>
                      <SelectTrigger id="target-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SUB_DEPARTMENT">
                          <span className="flex items-center gap-2"><Network className="w-4 h-4" /> Entire Sub-Department ({managerSubDeptName})</span>
                        </SelectItem>
                        <SelectItem value="INDIVIDUAL">
                          <span className="flex items-center gap-2"><User className="w-4 h-4" /> Select Specific Staff</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Individual Staff Picker */}
                {!editingNoticeId && targetType === "INDIVIDUAL" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Select Staff Members</Label>
                    <Popover open={staffSearchOpen} onOpenChange={setStaffSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between text-left font-normal" id="staff-picker-btn">
                          {selectedUserIds.length > 0
                            ? `${selectedUserIds.length} staff selected`
                            : "Select staff members..."
                          }
                          <ChevronDown className="w-4 h-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search staff..." />
                          <CommandList>
                            <CommandEmpty>No staff found in sub-department.</CommandEmpty>
                            <CommandGroup>
                              {targets.staff.map(s => (
                                <CommandItem
                                  key={s.id}
                                  onSelect={() => toggleStaffSelection(s.id)}
                                  className="flex items-center gap-2"
                                >
                                  <Checkbox
                                    checked={selectedUserIds.includes(s.id)}
                                    className="pointer-events-none"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{s.name}</div>
                                    <div className="text-xs text-muted-foreground truncate">{s.email}</div>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {selectedUserIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedUserIds.map(id => {
                          const staff = targets.staff.find(s => s.id === id)
                          return staff ? (
                            <Badge key={id} variant="secondary" className="gap-1 pr-1">
                              {staff.name}
                              <button onClick={() => toggleStaffSelection(id)} className="ml-0.5 hover:text-foreground">
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Pin Toggle */}
                <div className="flex items-center justify-between border p-3 bg-muted/30">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Pin Notice</Label>
                    <p className="text-xs text-muted-foreground">Pinned notices appear at the top of staff notice board</p>
                  </div>
                  <Switch checked={isPinned} onCheckedChange={setIsPinned} id="pin-switch" />
                </div>
              </TabsContent>

              {/* Preview Tab */}
              <TabsContent value="preview" className="py-2 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Card Preview:</p>
                <div className="flex flex-col bg-card border border-border p-5 min-h-[240px]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {targetType === "ALL" ? "All Staff" : (targetType && targetTypeConfig[targetType]?.label) || "Sub-Department"}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">Published</span>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(), "dd MMM yyyy")}
                    </span>
                    {isPinned && (
                      <Badge variant="secondary" className="text-[10px]">Pinned</Badge>
                    )}
                  </div>

                  <div className="flex-1 mt-4">
                    <h3 className="font-semibold text-lg text-foreground leading-snug mb-2">
                      {title || "Notice Title"}
                    </h3>
                    <div
                      className="notice-body prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: message || "<p class='text-muted-foreground italic'>Notice content preview...</p>" }}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm() }}>
                Cancel
              </Button>
              <Button onClick={handlePublish} disabled={publishing} className="gap-2" id="publish-btn">
                {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingNoticeId ? "Save Changes" : "Publish"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search notices..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9"
          id="search-notices"
        />
      </div>

      {/* Notice Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Megaphone className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">No notices published yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create notices for staff in your sub-department</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredNotices.map((notice, index) => (
              <motion.div
                key={notice.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.03, duration: 0.3 }}
              >
                <div className="group relative flex flex-col bg-card border border-border p-5 hover:border-primary/30 transition-all duration-200 min-h-[220px]">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {getTargetLabel(notice)}
                    </span>
                    <span className="text-xs text-muted-foreground">Published</span>
                  </div>

                  {/* Date & actions */}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(notice.createdAt), "dd MMM yyyy")}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Pin / Edit / Delete only for the creator or admins */}
                      {((user && notice.createdBy && String(user.id) === String(notice.createdBy.id)) || role === 'ADMIN') && (
                        <>
                          <button
                            onClick={() => handleTogglePin(notice)}
                            className={`p-1 transition-colors rounded-sm hover:bg-muted ${notice.isPinned ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                            title={notice.isPinned ? "Unpin" : "Pin"}
                          >
                            {notice.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleOpenEdit(notice)}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-muted"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-muted" title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Notice</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete this notice for all recipients. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(notice)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Pinned */}
                  {notice.isPinned && (
                    <div className="mt-2">
                      <Badge variant="secondary" className="text-[10px]">Pinned</Badge>
                    </div>
                  )}

                  {/* Title & Body */}
                  <div className="flex-1 mt-3">
                    <h3 className="font-semibold text-base text-foreground leading-snug mb-2 line-clamp-2">
                      {notice.title}
                    </h3>
                    <div
                      className="notice-body line-clamp-4"
                      dangerouslySetInnerHTML={{ __html: notice.message }}
                    />
                  </div>

                  {/* Footer */}
                  <div className="mt-3 pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      {notice.recipientCount} recipients
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* View Notice Dialog */}
      <Dialog open={!!viewNotice} onOpenChange={(o) => !o && setViewNotice(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          {viewNotice && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  {viewNotice.targetType && targetTypeConfig[viewNotice.targetType] && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      {targetTypeConfig[viewNotice.targetType]?.label}
                    </Badge>
                  )}
                  {viewNotice.isPinned && (
                    <Badge variant="secondary" className="text-xs">Pinned</Badge>
                  )}
                </div>
                <DialogTitle className="text-xl">{viewNotice.title}</DialogTitle>
                <DialogDescription>
                  {format(new Date(viewNotice.createdAt), "MMMM dd, yyyy 'at' hh:mm a")}
                  {` · ${viewNotice.recipientCount} recipients`}
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div
                  className="notice-body prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: viewNotice.message }}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
