"use client"

import { 
  Search, LogOut, Home, Users, FileText, User, Settings, BarChart, 
  Building2, ClipboardList, Calendar, CheckSquare, FolderKanban, FolderOpen 
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/providers/auth-context"
import { Sun, Moon, Bell, Globe, ChevronDown } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface SearchOption {
  label: string
  href: string
  icon: React.ReactNode
  roles: string[]
}

interface Notification {
  id: string
  title: string
  message: string
  type: string
  priority: string
  isRead: boolean
  createdAt: string
  actionUrl: string | null
}

const searchOptions: SearchOption[] = [
  // ==================== ADMIN Options ====================
  {
    label: "Dashboard",
    href: "/admin",
    icon: <Home className="h-4 w-4" />,
    roles: ["ADMIN"]
  },
  {
    label: "User Management",
    href: "/admin/users",
    icon: <Users className="h-4 w-4" />,
    roles: ["ADMIN"]
  },
  {
    label: "Departments",
    href: "/admin/departments",
    icon: <Building2 className="h-4 w-4" />,
    roles: ["ADMIN"]
  },
  {
    label: "Responsibilities",
    href: "/admin/responsibilities",
    icon: <ClipboardList className="h-4 w-4" />,
    roles: ["ADMIN"]
  },
  {
    label: "Work Submissions",
    href: "/admin/work-submissions",
    icon: <FileText className="h-4 w-4" />,
    roles: ["ADMIN"]
  },
  {
    label: "Analytics",
    href: "/admin/analytics",
    icon: <BarChart className="h-4 w-4" />,
    roles: ["ADMIN"]
  },
  {
    label: "My Profile",
    href: "/admin/profile",
    icon: <User className="h-4 w-4" />,
    roles: ["ADMIN"]
  },

  // ==================== MANAGER Options ====================
  {
    label: "Dashboard",
    href: "/manager",
    icon: <Home className="h-4 w-4" />,
    roles: ["MANAGER"]
  },
  {
    label: "Staff Management",
    href: "/manager/staff",
    icon: <Users className="h-4 w-4" />,
    roles: ["MANAGER"]
  },
  {
    label: "Assignments",
    href: "/manager/assignments",
    icon: <FolderKanban className="h-4 w-4" />,
    roles: ["MANAGER"]
  },
  {
    label: "Groups",
    href: "/manager/responsibility-groups",
    icon: <FolderOpen className="h-4 w-4" />,
    roles: ["MANAGER"]
  },
  {
    label: "Responsibilities",
    href: "/manager/responsibilities",
    icon: <ClipboardList className="h-4 w-4" />,
    roles: ["MANAGER"]
  },
  {
    label: "Submissions",
    href: "/manager/submissions",
    icon: <FileText className="h-4 w-4" />,
    roles: ["MANAGER"]
  },
  {
    label: "Analytics",
    href: "/manager/analytics",
    icon: <BarChart className="h-4 w-4" />,
    roles: ["MANAGER"]
  },
  {
    label: "My Profile",
    href: "/manager/profile",
    icon: <User className="h-4 w-4" />,
    roles: ["MANAGER"]
  },

  // ==================== STAFF Options ====================
  {
    label: "Dashboard",
    href: "/staff",
    icon: <Home className="h-4 w-4" />,
    roles: ["STAFF"]
  },
  {
    label: "My Assignments",
    href: "/staff/assignments",
    icon: <FolderKanban className="h-4 w-4" />,
    roles: ["STAFF"]
  },
  {
    label: "My Responsibilities",
    href: "/staff/responsibilities",
    icon: <ClipboardList className="h-4 w-4" />,
    roles: ["STAFF"]
  },
  {
    label: "Work Calendar",
    href: "/staff/work-calendar",
    icon: <Calendar className="h-4 w-4" />,
    roles: ["STAFF"]
  },
  {
    label: "My Submissions",
    href: "/staff/work-submissions",
    icon: <CheckSquare className="h-4 w-4" />,
    roles: ["STAFF"]
  },
  {
    label: "Analytics",
    href: "/staff/analytics",
    icon: <BarChart className="h-4 w-4" />,
    roles: ["STAFF"]
  },
  {
    label: "My Profile",
    href: "/staff/profile",
    icon: <User className="h-4 w-4" />,
    roles: ["STAFF"]
  },
]

export default function DashboardHeader() {
  const { user, role, isLoading, isAuthenticated, logout } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, isLoading, router])

  // Fetch user profile with avatar
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch("/api/profile")
        if (response.ok) {
          const data = await response.json()
          setProfile(data)
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error)
      }
    }

    if (isAuthenticated) {
      fetchProfile()
    }
  }, [isAuthenticated])

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch("/api/notifications")
        if (response.ok) {
          const data = await response.json()
          setNotifications(data.notifications || [])
          setUnreadCount(data.unreadCount || 0)
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error)
      }
    }

    if (isAuthenticated) {
      fetchNotifications()
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated])

  // Keyboard shortcut for search
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  if (!isAuthenticated || !role) return null

  const userRole = role
  const userEmail = user?.email || ""
  const userInitial = user?.name?.charAt(0).toUpperCase() || userEmail.charAt(0).toUpperCase() || "U"

  // Filter search options based on user role
  const filteredOptions = searchOptions.filter(option => 
    option.roles.includes(userRole as string)
  )
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getAvatarUrl = () => {
    if (!profile) return null
    
    switch (userRole as string) {
      case "ADMIN":
        return profile.admin?.avatarUrl || profile.avatarUrl
      case "MANAGER":
        return profile.manager?.avatarUrl || profile.avatarUrl
      case "STAFF":
        return profile.staff?.avatarUrl || profile.avatarUrl
      default:
        return profile.avatarUrl || null
    }
  }

  const getUserName = () => {
    if (!profile) return userEmail
    
    switch (userRole as string) {
      case "ADMIN":
        return profile.admin?.name || profile.name || userEmail
      case "MANAGER":
        return profile.manager?.name || profile.name || userEmail
      case "STAFF":
        return profile.staff?.name || profile.name || userEmail
      default:
        return profile.name || userEmail
    }
  }

  const getRoleVariant = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "destructive"
      case "MANAGER":
        return "default"
      case "STAFF":
        return "secondary"
      default:
        return "outline"
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "SUCCESS":
        return "text-green-600 dark:text-green-400"
      case "WARNING":
        return "text-orange-600 dark:text-orange-400"
      case "ERROR":
        return "text-red-600 dark:text-red-400"
      case "CONTEST":
        return "text-purple-600 dark:text-purple-400"
      case "SYSTEM":
        return "text-blue-600 dark:text-blue-400"
      case "ANNOUNCEMENT":
        return "text-indigo-600 dark:text-indigo-400"
      default:
        return "text-gray-600 dark:text-gray-400"
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

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      try {
        await fetch(`/api/notifications?id=${notification.id}`, {
          method: "PATCH"
        })
      } catch (error) {
        console.error("Failed to mark notification as read:", error)
      }
    }

    setNotificationOpen(false)

    // Navigate to action URL or notification page
    if (notification.actionUrl) {
      router.push(notification.actionUrl)
    } else {
      const notificationPath = userRole === "ADMIN" 
        ? "/admin/notifications/manage" 
        : "/participant/notification"
      router.push(notificationPath)
    }
  }

  const handleViewAllNotifications = () => {
    setNotificationOpen(false)
    const notificationPath = userRole === "ADMIN" 
      ? "/admin/notifications/manage" 
      : "/participant/notification"
    router.push(notificationPath)
  }

  return (
    <>
      <header className="w-full bg-background lg:border-b">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-2 sm:py-3 lg:py-4 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* LEFT: Logo + Name + Search Bar */}
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            {/* Logo + Brand Name - hidden on mobile since it's in sidebar */}
            <div 
              className="flex items-center gap-2 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity hidden lg:flex"
              onClick={() => router.push(`/${userRole.toLowerCase()}`)}
            >
              <span className="text-lg sm:text-xl font-bold">
                Work Manager
              </span>
            </div>

            {/* Search Bar - hidden on mobile, shown on larger screens */}
            <div 
              className="relative w-72 cursor-pointer hidden md:block"
              onClick={() => setOpen(true)}
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search... ⌘K"
                className="pl-10 rounded-full bg-muted/40 cursor-pointer"
                readOnly
              />
            </div>
          </div>

          {/* RIGHT: Actions */}
          <div className="flex items-center gap-1 sm:gap-2 lg:gap-4">
            
            {/* Mobile Search Icon */}
            <Button 
              variant="ghost" 
              size="icon"
              className="md:hidden"
              onClick={() => setOpen(true)}
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Language Icon - Hidden on small screens */}
            <Button variant="ghost" size="icon" className="hidden lg:flex">
              <Globe className="h-5 w-5" />
            </Button>

            {/* Theme button */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => document.documentElement.classList.toggle("dark")}
            >
              <Sun className="h-5 w-5 dark:hidden" />
              <Moon className="h-5 w-5 hidden dark:block" />
            </Button>

            {/* Notification Popover */}
            <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-semibold">Notifications</h3>
                  {unreadCount > 0 && (
                    <Badge variant="secondary">{unreadCount} new</Badge>
                  )}
                </div>
                <ScrollArea className="h-[400px]">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Bell className="h-12 w-12 mb-2 opacity-50" />
                      <p className="text-sm">No notifications yet</p>
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
                            <div className={cn(
                              "mt-0.5 h-2 w-2 rounded-full flex-shrink-0",
                              !notification.isRead ? "bg-primary" : "bg-transparent"
                            )} />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className={cn(
                                  "text-sm font-medium leading-none",
                                  !notification.isRead && "text-primary"
                                )}>
                                  {notification.title}
                                </p>
                                <Badge 
                                  variant="outline" 
                                  className={cn("text-xs flex-shrink-0", getTypeColor(notification.type))}
                                >
                                  {notification.type}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground">
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
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={handleViewAllNotifications}
                    >
                      View All Notifications
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 sm:p-2 rounded-lg transition-colors">
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10 ring-2 ring-primary/20 hover:ring-primary/40 transition-all border-2 border-background shadow-sm">
                    {getAvatarUrl() ? (
                      <AvatarImage src={getAvatarUrl()!} alt={getUserName()} />
                    ) : (
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-semibold text-xs sm:text-sm">
                        {profile ? getInitials(getUserName()) : userInitial}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="hidden lg:block text-left">
                    <p className="text-sm font-medium leading-none">{getUserName()}</p>
                    <p className="text-xs text-muted-foreground">{userRole}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground hidden lg:block" />
                </div>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{getUserName()}</p>
                    <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                    {/* <Badge variant={getRoleVariant(userRole as string)} className="text-xs mt-1 w-fit">
                      {userRole}
                    </Badge> */}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => router.push(`/${userRole.toLowerCase()}/profile`)}
                  className="cursor-pointer"
                >
                  <User className="mr-2 h-4 w-4" />
                  View Profile
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => router.push(`/${userRole.toLowerCase()}`)}
                  className="cursor-pointer"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={() => logout()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Command Dialog for Search */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type to search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {filteredOptions.map((option) => (
              <CommandItem
                key={option.href}
                onSelect={() => {
                  router.push(option.href)
                  setOpen(false)
                }}
                className="cursor-pointer"
              >
                {option.icon}
                <span className="ml-2">{option.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Quick Actions">
            <CommandItem
              onSelect={() => {
                router.push(`/${userRole.toLowerCase()}/profile`)
                setOpen(false)
              }}
              className="cursor-pointer"
            >
              <User className="h-4 w-4" />
              <span className="ml-2">Go to Profile</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                logout()
                setOpen(false)
              }}
              className="cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span className="ml-2">Sign Out</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}