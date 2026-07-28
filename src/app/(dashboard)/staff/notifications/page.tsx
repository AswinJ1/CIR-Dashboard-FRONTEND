"use client"

import * as React from "react"
import { format } from "date-fns"
import {
  Bell, Pin, CheckCheck, Megaphone, Search, Loader2
} from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { NotificationItem } from "@/types/cir"

export default function StaffNotificationsPage() {
  const [notices, setNotices] = React.useState<NotificationItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [activeTab, setActiveTab] = React.useState<"all" | "pinned" | "unread">("all")
  const [viewNotice, setViewNotice] = React.useState<NotificationItem | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.notifications.getNoticeBoard()
      setNotices(data)
    } catch (err) {
      toast.error("Failed to load notifications")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { loadData() }, [loadData])

  const handleMarkAsRead = async (notice: NotificationItem) => {
    if (notice.isRead) return
    try {
      await api.notifications.markAsRead(notice.id)
      setNotices(prev => prev.map(n => n.id === notice.id ? { ...n, isRead: true } : n))
    } catch (err) {
      // silent
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllAsRead()
      toast.success("All notifications marked as read")
      setNotices(prev => prev.map(n => ({ ...n, isRead: true })))
    } catch (err) {
      toast.error("Failed to mark all as read")
    }
  }

  const handleOpenNotice = (notice: NotificationItem) => {
    setViewNotice(notice)
    handleMarkAsRead(notice)
  }

  const filteredNotices = React.useMemo(() => {
    let result = notices
    if (activeTab === "pinned") {
      result = result.filter(n => n.isPinned)
    } else if (activeTab === "unread") {
      result = result.filter(n => !n.isRead)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.createdBy?.name?.toLowerCase().includes(q)
      )
    }
    return result
  }, [notices, activeTab, searchQuery])

  const unreadCount = notices.filter(n => !n.isRead).length
  const pinnedCount = notices.filter(n => n.isPinned).length

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Notice Board
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            View announcements and notices from your administration and department managers
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-2 self-start sm:self-auto">
            <CheckCheck className="w-4 h-4" />
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-3 sm:w-auto">
            <TabsTrigger value="all" className="gap-1.5">
              All
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{notices.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pinned" className="gap-1.5">
              Pinned
              {pinnedCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {pinnedCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="unread" className="gap-1.5">
              Unread
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative max-w-md w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search notices..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Notice Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bell className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">No notices found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {activeTab === "unread" ? "You're all caught up! No unread notices." : "No notices available right now."}
          </p>
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
                <div
                  onClick={() => handleOpenNotice(notice)}
                  className={`group relative flex flex-col bg-card border border-border p-5 hover:border-primary/30 transition-all duration-200 min-h-[220px] cursor-pointer ${
                    !notice.isRead ? "border-l-2 border-l-primary" : ""
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {notice.targetType === "ALL" ? "All Staff" : "Notice"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {!notice.isRead ? "Unread" : "Read"}
                    </span>
                  </div>

                  {/* Date row */}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(notice.createdAt), "dd MMM yyyy")}
                    </span>
                    {notice.isPinned && (
                      <Badge variant="secondary" className="text-[10px]">
                        Pinned
                      </Badge>
                    )}
                  </div>

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
                  {notice.createdBy && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        By {notice.createdBy.name}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* View Modal */}
      <Dialog open={!!viewNotice} onOpenChange={(o) => !o && setViewNotice(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewNotice && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  {viewNotice.isPinned && (
                    <Badge variant="secondary" className="text-xs">
                      Pinned
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl leading-snug">{viewNotice.title}</DialogTitle>
                <DialogDescription className="text-xs">
                  Published on {format(new Date(viewNotice.createdAt), "MMMM dd, yyyy 'at' hh:mm a")}
                  {viewNotice.createdBy && ` · By ${viewNotice.createdBy.name}`}
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
