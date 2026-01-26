"use client"

import { useRouter, usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import Link from "next/link"
import {
  LayoutDashboard,
  Users,
  FileText,
  CheckCircle,
  ClipboardList,
  LogOut,
  Menu,
  ChevronRight,
  User,
  ChevronLeft,
  Building2,
  BarChart3,
  UserCheck,
  FileCheck,
  Briefcase,
  CalendarCheck,
  Save,
  CalendarRange,
  FolderOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useAuth, getDashboardUrl } from "@/components/providers/auth-context"
import { RoleBadge } from "@/components/ui/status-badge"
import { Role } from "@/types/cir"
import DashboardHeader from "@/components/dashboard-header"

interface NavigationItem {
  name: string
  href: string
  icon: React.ReactNode
  roles: Role[]
}

// CIR Navigation structure based on role requirements
const navigation: NavigationItem[] = [
  // Admin Navigation
  {
    name: "Dashboard",
    href: "/admin",
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ["ADMIN"]
  },
  {
    name: "Users",
    href: "/admin/users",
    icon: <Users className="w-5 h-5" />,
    roles: ["ADMIN"]
  },
  {
    name: "Departments",
    href: "/admin/departments",
    icon: <Building2 className="w-5 h-5" />,
    roles: ["ADMIN"]
  },
  {
    name: "Responsibilities",
    href: "/admin/responsibilities",
    icon: <Briefcase className="w-5 h-5" />,
    roles: ["ADMIN"]
  },
  {
    name: "Work Submissions",
    href: "/admin/work-submissions",
    icon: <FileCheck className="w-5 h-5" />,
    roles: ["ADMIN"]
  },
  {
    name: "Analytics",
    href: "/admin/analytics",
    icon: <BarChart3 className="w-5 h-5" />,
    roles: ["ADMIN"]
  },
  {
    name: "Profile",
    href: "/admin/profile",
    icon: <User className="w-5 h-5" />,
    roles: ["ADMIN"]
  },

  // Manager Navigation
  {
    name: "Dashboard",
    href: "/manager",
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ["MANAGER"]
  },
  {
    name: "Review Submissions",
    href: "/manager/submissions",
    icon: <FileCheck className="w-5 h-5" />,
    roles: ["MANAGER"]
  },
  {
    name: "Responsibilities",
    href: "/manager/responsibilities",
    icon: <Briefcase className="w-5 h-5" />,
    roles: ["MANAGER"]
  },
  {
    name: "Assignments",
    href: "/manager/assignments",
    icon: <ClipboardList className="w-5 h-5" />,
    roles: ["MANAGER"]
  },
  {
    name: "Groups",
    href: "/manager/responsibility-groups",
    icon: <FolderOpen className="w-5 h-5" />,
    roles: ["MANAGER"]
  },
  {
    name: "My Staff",
    href: "/manager/staff",
    icon: <UserCheck className="w-5 h-5" />,
    roles: ["MANAGER"]
  },
  {
    name: "Profile",
    href: "/manager/profile",
    icon: <User className="w-5 h-5" />,
    roles: ["MANAGER"]
  },

  // Staff Navigation
  {
    name: "Dashboard",
    href: "/staff",
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ["STAFF"]
  },
  {
    name: "Submit Work",
    href: "/staff/work-calendar",
    icon: <Save className="w-5 h-5" />,
    roles: ["STAFF"]
  },
  {
    name: "Work Calendar",
    href: "/staff/responsibilities",
    icon: <CalendarRange className="w-5 h-5" />,
    roles: ["STAFF"]
  },
  {
    name: "Work Submissions",
    href: "/staff/work-submissions",
    icon: <FileCheck className="w-5 h-5" />,
    roles: ["STAFF"]
  },
  {
    name: "Analytics",
    href: "/staff/analytics",
    icon: <BarChart3 className="w-5 h-5" />,
    roles: ["STAFF"]
  },
  {
    name: "Profile",
    href: "/staff/profile",
    icon: <User className="w-5 h-5" />,
    roles: ["STAFF"]
  },
]

function NavItem({
  item,
  isActive,
  isCollapsed,
  onClick
}: {
  item: NavigationItem
  isActive: boolean
  isCollapsed: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-primary text-primary-foreground shadow-lg"
          : "hover:bg-accent hover:text-accent-foreground hover:shadow-md",
        isCollapsed && "justify-center"
      )}
    >
      <div className={cn(
        "transition-transform duration-200",
        isActive && "scale-110"
      )}>
        {item.icon}
      </div>
      {!isCollapsed && (
        <>
          <span className="flex-1">{item.name}</span>
          {isActive && (
            <ChevronRight className="h-4 w-4 animate-pulse" />
          )}
        </>
      )}
      {isCollapsed && (
        <div className="absolute left-full ml-2 hidden group-hover:block z-50">
          <div className="bg-popover text-popover-foreground px-3 py-2 rounded-lg text-sm whitespace-nowrap shadow-xl border">
            {item.name}
          </div>
        </div>
      )}
    </Link>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, role, isLoading, isAuthenticated, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, isLoading, router])

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

  // Filter navigation based on user role
  const filteredNavigation = navigation.filter(item =>
    item.roles.includes(role)
  )

  const isCurrentPath = (href: string) => {
    const roleBase = getDashboardUrl(role)
    if (href === roleBase) {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-5",
          isCollapsed && !isMobile && "justify-center px-2"
        )}
      >
        {!isCollapsed || isMobile ? (
          <div className="flex flex-col">
            <Image
              src="/logo.png"
              alt="CIR Management"
              width={120}
              height={30}
            />
            {/* <span className="text-xs text-muted-foreground mt-1">
              Work Management System
            </span> */}
          </div>
        ) : (
          <Image
            src="/logo.png"
            alt="CIR"
            width={40}
            height={40}
          />
        )}
      </div>

      <Separator />

      {/* User Info */}
      {/* {(!isCollapsed || isMobile) && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.name || user?.email?.split('@')[0]}
              </p>
              <RoleBadge role={role} className="mt-1" />
            </div>
          </div>
        </div>
      )} */}

      <Separator />

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1.5 py-4">
          {filteredNavigation.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              isActive={isCurrentPath(item.href)}
              isCollapsed={isCollapsed && !isMobile}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </div>
      </ScrollArea>

      <Separator />

      {/* Logout Button */}
      <div className={cn(
        "p-4",
        isCollapsed && !isMobile && "px-2"
      )}>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10",
            isCollapsed && !isMobile && "justify-center px-2"
          )}
          onClick={logout}
        >
          <LogOut className="h-5 w-5" />
          {(!isCollapsed || isMobile) && <span className="ml-3">Sign out</span>}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-72 p-0"
        >
          <SidebarContent isMobile />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300 z-40",
        "bg-card border-r shadow-sm",
        isCollapsed ? "lg:w-20" : "lg:w-72"
      )}>
        <SidebarContent />

        {/* Collapse Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "absolute -right-3 top-8 h-6 w-6 rounded-full",
            "bg-background border-2 shadow-lg",
            "flex items-center justify-center",
            "hover:bg-accent transition-all duration-200",
            "hover:scale-110"
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </aside>

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300 flex flex-col min-h-screen",
        isCollapsed ? "lg:pl-20" : "lg:pl-72"
      )}>
        {/* Desktop Dashboard Header */}
        <div className="hidden lg:block sticky top-0 z-30">
          <DashboardHeader />
        </div>

        {/* Mobile Header - Full DashboardHeader on mobile */}
        <div className="lg:hidden sticky top-0 z-30">
          <div className="flex items-center gap-2 bg-background border-b px-3 py-2">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
            <div className="flex-1">
              <DashboardHeader />
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}