"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useTheme } from "next-themes"

// Icons
import {
  Search, LogOut, Home, Users, FileText, User, BarChart,
  Building2, ClipboardList, Calendar, CheckSquare, FolderKanban,
  FolderOpen, Sun, Moon, Bell, Globe, ChevronDown, ChevronsUpDown,
  LayoutDashboard, FileCheck, Briefcase, CalendarCheck, CalendarRange,
  Calendar1, UserCheck, Menu, Settings
} from "lucide-react"

// Core UI Components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb"

import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Radix Sidebar Components
import {
  SidebarProvider, SidebarInset, SidebarTrigger, Sidebar, SidebarHeader,
  SidebarContent, SidebarFooter, SidebarRail, SidebarGroup, SidebarGroupLabel,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from "@/components/animate-ui/components/radix/sidebar"

// Utilities & Providers
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { useAuth, getDashboardUrl } from "@/components/providers/auth-context"
import { Role, NotificationItem } from "@/types/cir"
import { useTranslation } from "react-i18next"
import "@/lib/i18n"

// --- Types & Constants ---

interface SearchOption {
  label: string
  href: string
  icon: React.ReactNode
  roles: string[]
}



interface NavigationItem {
  name: string
  href: string
  icon: React.ReactNode
  roles: Role[]
}

const searchOptions: SearchOption[] = [
  // ADMIN Options
  { label: "dashboard", href: "/admin", icon: <Home className="h-4 w-4" />, roles: ["ADMIN"] },
  { label: "manageUsers", href: "/admin/users", icon: <Users className="h-4 w-4" />, roles: ["ADMIN"] },
  { label: "manageDepartments", href: "/admin/departments", icon: <Building2 className="h-4 w-4" />, roles: ["ADMIN"] },
  { label: "manageResponsibilities", href: "/admin/responsibilities", icon: <ClipboardList className="h-4 w-4" />, roles: ["ADMIN"] },
  { label: "manageWorkSubmissions", href: "/admin/work-submissions", icon: <FileText className="h-4 w-4" />, roles: ["ADMIN"] },
  { label: "accountProfile", href: "/admin/profile", icon: <User className="h-4 w-4" />, roles: ["ADMIN"] },
  { label: "timetable", href: "/admin/timetable", icon: <Calendar className="h-4 w-4" />, roles: ["ADMIN"] },
  { label: "settings", href: "/admin/settings", icon: <Settings className="h-4 w-4" />, roles: ["ADMIN"] },

  // MANAGER Options
  { label: "dashboard", href: "/manager", icon: <Home className="h-4 w-4" />, roles: ["MANAGER"] },
  { label: "staff", href: "/manager/staff", icon: <Users className="h-4 w-4" />, roles: ["MANAGER"] },
  { label: "manageDuty", href: "/manager/assignments", icon: <FolderKanban className="h-4 w-4" />, roles: ["MANAGER"] },
  { label: "accountProfile", href: "/manager/profile", icon: <User className="h-4 w-4" />, roles: ["MANAGER"] },

  // STAFF Options
  { label: "dashboard", href: "/staff", icon: <Home className="h-4 w-4" />, roles: ["STAFF"] },
  { label: "workCalendar", href: "/staff/responsibilities", icon: <CalendarRange className="h-4 w-4" />, roles: ["STAFF"] },
  { label: "accountProfile", href: "/staff/profile", icon: <User className="h-4 w-4" />, roles: ["STAFF"] },
]

const navigation: NavigationItem[] = [
  // Admin Navigation
  { name: "dashboard", href: "/admin", icon: <LayoutDashboard className="w-4 h-4" />, roles: ["ADMIN"] },
  { name: "noticeBoard", href: "/admin/notifications", icon: <Bell className="w-4 h-4" />, roles: ["ADMIN"] },
  { name: "manageUsers", href: "/admin/users", icon: <Users className="w-4 h-4" />, roles: ["ADMIN"] },
  { name: "manageDepartments", href: "/admin/departments", icon: <Building2 className="w-4 h-4" />, roles: ["ADMIN"] },
  { name: "manageResponsibilities", href: "/admin/responsibilities", icon: <Briefcase className="w-4 h-4" />, roles: ["ADMIN"] },
  { name: "manageWorkSubmissions", href: "/admin/work-submissions", icon: <FileCheck className="w-4 h-4" />, roles: ["ADMIN"] },
  { name: "semReports", href: "/admin/sem-reports", icon: <FileText className="w-4 h-4" />, roles: ["ADMIN"] },
  { name: "classroomManagement", href: "/admin/classrooms", icon: <FolderOpen className="w-4 h-4" />, roles: ["ADMIN"] },
  { name: "timetable", href: "/admin/timetable", icon: <CalendarCheck className="w-4 h-4" />, roles: ["ADMIN"] },
  { name: "settings", href: "/admin/settings", icon: <Settings className="w-4 h-4" />, roles: ["ADMIN"] },

  // Manager Navigation
  { name: "dashboard", href: "/manager", icon: <LayoutDashboard className="w-4 h-4" />, roles: ["MANAGER"] },
  { name: "noticeBoard", href: "/manager/notifications", icon: <Bell className="w-4 h-4" />, roles: ["MANAGER"] },
  { name: "manageDuty", href: "/manager/assignments", icon: <ClipboardList className="w-4 h-4" />, roles: ["MANAGER"] },
  { name: "staff", href: "/manager/staff", icon: <UserCheck className="w-4 h-4" />, roles: ["MANAGER"] },
  { name: "classroomManagement", href: "/manager/classrooms", icon: <FolderOpen className="w-4 h-4" />, roles: ["MANAGER"] },
  { name: "timetable", href: "/manager/timetable", icon: <CalendarCheck className="w-4 h-4" />, roles: ["MANAGER"] },
  // { name: "submitWork", href: "/manager/work-calendar", icon: <CalendarRange className="w-4 h-4" />, roles: ["MANAGER"] },
  { name: "myWorkSubmissions", href: "/manager/work-submissions", icon: <FileCheck className="w-4 h-4" />, roles: ["MANAGER"] },
  { name: "myResponsibilities", href: "/manager/my-responsibilities", icon: <Calendar1 className="w-4 h-4" />, roles: ["MANAGER"] },
  { name: "semReports", href: "/manager/sem-reports", icon: <FileText className="w-4 h-4" />, roles: ["MANAGER"] },

  // Staff Navigation
  { name: "dashboard", href: "/staff", icon: <LayoutDashboard className="w-4 h-4" />, roles: ["STAFF"] },
  { name: "noticeBoard", href: "/staff/notifications", icon: <Bell className="w-4 h-4" />, roles: ["STAFF"] },
  { name: "workCalendar", href: "/staff/responsibilities", icon: <CalendarRange className="w-4 h-4" />, roles: ["STAFF"] },
  { name: "manageWorkSubmissions", href: "/staff/work-submissions", icon: <FileCheck className="w-4 h-4" />, roles: ["STAFF"] },
  { name: "classroomManagement", href: "/staff/classrooms", icon: <FolderOpen className="w-4 h-4" />, roles: ["STAFF"] },
  { name: "timetable", href: "/staff/timetable", icon: <CalendarCheck className="w-4 h-4" />, roles: ["STAFF"] },
  { name: "semReports", href: "/staff/sem-reports", icon: <FileText className="w-4 h-4" />, roles: ["STAFF"] }
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation()
  // Auth & Routing
  const { user, role, isLoading, isAuthenticated, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // State
  const { theme, setTheme } = useTheme()
  const [profile, setProfile] = React.useState<any>(null)
  const [openSearch, setOpenSearch] = React.useState(false)
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [notificationOpen, setNotificationOpen] = React.useState(false)

  // Auth Redirection
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, isLoading, router])

  // Fetch Profile Data
  React.useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await api.profile.get()
        setProfile(data)
      } catch (error) {
        console.error("Failed to fetch profile:", error)
      }
    }
    if (isAuthenticated) fetchProfile()
  }, [isAuthenticated])

  // Fetch Notifications
  React.useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const [notifs, count] = await Promise.all([
          api.notifications.getAll(),
          api.notifications.getUnreadCount(),
        ])
        setNotifications(notifs || [])
        setUnreadCount(count || 0)
      } catch (error) {
        console.error("Failed to fetch notifications:", error)
      }
    }

    if (isAuthenticated) {
      fetchNotifications()
      const interval = setInterval(fetchNotifications, 30000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated])

  // Keyboard shortcut for search
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpenSearch((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // Show Loading Spinner
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !role) return null

  // Authorization Check
  const rolePathMap: Record<Role, string[]> = {
    'ADMIN': ['/admin', '/dashboard'],
    'MANAGER': ['/manager', '/dashboard'],
    'STAFF': ['/staff', '/dashboard'],
  }
  const allowedPaths = rolePathMap[role]
  const isAuthorized = allowedPaths.some(prefix => pathname.startsWith(prefix))

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="h-24 w-24 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
            <CheckSquare className="h-12 w-12 text-destructive" />
          </div>
          <h1 className="text-4xl  text-destructive mb-2">403</h1>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">
            You don't have permission to access this page. Please navigate to your authorized dashboard.
          </p>
          <Button onClick={() => router.push(getDashboardUrl(role))} className="w-full sm:w-auto">
            Go to My Dashboard
          </Button>
        </div>
      </div>
    )
  }

  // Helpers
  const filteredNavigation = navigation.filter(item => item.roles.includes(role))
  const filteredOptions = searchOptions.filter(option => option.roles.includes(role as string))

  const isCurrentPath = (href: string) => {
    const roleBase = getDashboardUrl(role)
    if (href === roleBase) return pathname === href
    return pathname.startsWith(href)
  }

  const userEmail = user?.email || ""
  const userInitial = user?.name?.charAt(0).toUpperCase() || userEmail.charAt(0).toUpperCase() || "U"

  const getAvatarUrl = () => {
    if (!profile) return null
    let url: string | null = null
    switch (role) {
      case "ADMIN": url = profile.admin?.avatarUrl || profile.avatarUrl; break
      case "MANAGER": url = profile.manager?.avatarUrl || profile.avatarUrl; break
      case "STAFF": url = profile.staff?.avatarUrl || profile.avatarUrl; break
      default: url = profile.avatarUrl || null
    }
    return url
  }

  const getUserName = () => {
    if (!profile) return userEmail
    switch (role) {
      case "ADMIN": return profile.admin?.name || profile.name || userEmail
      case "MANAGER": return profile.manager?.name || profile.name || userEmail
      case "STAFF": return profile.staff?.name || profile.name || userEmail
      default: return profile.name || userEmail
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (seconds < 60) return "Just now"
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return date.toLocaleDateString()
  }

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      try {
        await api.notifications.markAsRead(notification.id)
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
      } catch (error) {
        console.error("Failed to mark notification as read:", error)
      }
    }
    setNotificationOpen(false)
  }

  return (
    <SidebarProvider>
      {/* ---------------- SIDEBAR NAVIGATION ---------------- */}
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="hover:bg-sidebar-accent cursor-pointer">
                <Link href={getDashboardUrl(role)}>
                  {/* <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Image src="/logo.png" alt="CIR" width={24} height={24} className="rounded-sm" />
                  </div> */}
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate text-xl ">{t('cirDashboard')}</span>
                    <span className="truncate text-xs  capitalize">{t(role.toLowerCase() + 'Portal')}</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t('menu')}</SidebarGroupLabel>
            <SidebarMenu>
              {filteredNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={isCurrentPath(item.href)}
                    tooltip={t(item.name)}
                  >
                    <Link href={item.href}>
                      {item.icon}
                      <span>{t(item.name)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg border">
                      {getAvatarUrl() ? (
                        <AvatarImage src={getAvatarUrl()!} alt={getUserName()} />
                      ) : (
                        <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                          {userInitial}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{getUserName()}</span>
                      <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="bottom"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg border">
                        {getAvatarUrl() ? (
                          <AvatarImage src={getAvatarUrl()!} alt={getUserName()} />
                        ) : (
                          <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                            {userInitial}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{getUserName()}</span>
                        <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuGroup>
                    {/* Fixed Dropdown Navigation */}
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href={`/${role.toLowerCase()}/profile`}>
                        <User className="mr-2 h-4 w-4" />
                        <span>{t('accountProfile')}</span>
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href={getDashboardUrl(role)}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>{t('dashboard')}</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      logout();
                    }}
                    className=" cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t('signOut')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      {/* ---------------- MAIN LAYOUT ---------------- */}
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 z-30 sticky top-0">

          {/* Left: Sidebar Trigger & Search */}
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4 hidden md:block" />

            {/* Desktop Search Bar */}
            <div
              className="relative w-64 cursor-pointer hidden md:block"
              onClick={() => setOpenSearch(true)}
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('search')}
                className="pl-9 h-9 rounded-full bg-muted/40 cursor-pointer border-none shadow-none focus-visible:ring-1"
                readOnly
              />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Mobile Search Icon */}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpenSearch(true)}>
              <Search className="h-5 w-5" />
            </Button>

            {/* Language Selection */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Globe className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem className="cursor-pointer" onClick={() => i18n.changeLanguage('en')}>English</DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => i18n.changeLanguage('ml')}>Malayalam (മലയാളം)</DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => i18n.changeLanguage('hi')}>Hindi (हिन्दी)</DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => i18n.changeLanguage('ta')}>Tamil (தமிழ்)</DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => i18n.changeLanguage('zh')}>中文 (Chinese)</DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => i18n.changeLanguage('ja')}>日本語 (Japanese)</DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => i18n.changeLanguage('ko')}>한국어 (Korean)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle */}
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              <Sun className="h-5 w-5 dark:hidden" />
              <Moon className="h-5 w-5 hidden dark:block" />
            </Button>

            {/* Notifications Popover */}
            <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px] animate-pulse">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-semibold text-sm">{t('notifications')}</h3>
                  {unreadCount > 0 && <Badge variant="secondary">{unreadCount} new</Badge>}
                </div>
                <ScrollArea className="h-[350px]">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Bell className="h-10 w-10 mb-2 opacity-20" />
                      <p className="text-sm">{t('noNotifications')}</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {notifications.slice(0, 5).map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={cn(
                            "p-4 hover:bg-muted/50 cursor-pointer transition-colors",
                            !notification.isRead && "bg-primary/5"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn("mt-1.5 h-2 w-2 rounded-full flex-shrink-0", !notification.isRead ? "bg-primary" : "bg-transparent")} />
                            <div className="flex-1 space-y-1">
                              <p className={cn("text-sm font-medium leading-none", !notification.isRead && "text-primary")}>
                                {notification.title}
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-2">
                                {formatTimeAgo(notification.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                {notifications.length > 0 && (
                  <div className="p-2 border-t">
                    <Button variant="ghost" className="w-full text-xs" onClick={async () => {
                      try {
                        await api.notifications.markAllAsRead()
                        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
                        setUnreadCount(0)
                      } catch (error) {
                        console.error("Failed to mark all as read:", error)
                      }
                    }}>
                      Mark all as read
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </header>

        {/* Dynamic Global Breadcrumb */}
        <DynamicBreadcrumb />

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {children}
        </main>
      </SidebarInset>

      {/* ---------------- COMMAND DIALOG (Global Search) ---------------- */}
      <CommandDialog open={openSearch} onOpenChange={setOpenSearch}>
        <CommandInput placeholder={t('search')} />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {filteredOptions.map((option) => (
              <CommandItem
                key={option.href}
                onSelect={() => {
                  router.push(option.href)
                  setOpenSearch(false)
                }}
                className="cursor-pointer"
              >
                {option.icon}
                <span className="ml-2">{t(option.label)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Quick Actions">
            <CommandItem onSelect={() => { router.push(`/${role.toLowerCase()}/profile`); setOpenSearch(false) }} className="cursor-pointer">
              <User className="h-4 w-4 mr-2" />
              {t('accountProfile')}
            </CommandItem>
            <CommandItem onSelect={() => { logout(); setOpenSearch(false) }} className="cursor-pointer text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              {t('signOut')}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </SidebarProvider>
  )
}