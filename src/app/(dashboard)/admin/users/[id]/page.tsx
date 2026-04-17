"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import DashboardHeader from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import UserForm from "@/components/forms/user-form"
import { 
  ArrowLeft,
  Mail,
  Calendar,
  Shield,
  Edit,
  Trash2,
  User,
  Building2,
  Phone,
  MapPin,
  Wifi,
  ExternalLink,
  Lock,
  IdCard,
  UserCircle,
  CheckCircle,
  Clock,
  Eye,
  EyeOff,
  Users,
  DoorOpen,
  VerifiedIcon
} from "lucide-react"
import { cn} from "@/lib/utils"
import { FaBuilding, FaMapMarked, FaPrescription, FaUser, FaUserAlt, FaUserFriends } from "react-icons/fa"

interface User {
  id: string
  email: string
  uid?: string
  role: string
  createdAt: string
  participant?: {
    id: string
    name: string
    college?: string
    siteName?: string
    teamName?: string
    hostelName?: string
    roomNumber?: string
    wifiusername?: string
    wifiPassword?: string
    hostelLocation?: string
    contactNumber?: string
    gender?: string
    avatarUrl?: string
    createdAt: string
  }
  admin?: {
    id: string
    name: string
    gender?: string
    avatarUrl?: string
    createdAt: string
    isSuperAdmin?: boolean
  }
}

export default function UserDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string

  const isSuperAdmin = session?.user?.isSuperAdmin || false
  const isOwnAccount = session?.user?.id === userId  // Add this line

  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showWifiPassword, setShowWifiPassword] = useState(false)

  useEffect(() => {
    if (!session || session.user.role !== "ADMIN") {
      router.push("/unauthorized")
      return
    }
    fetchUser()
  }, [session, router, userId])

  const fetchUser = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/users/${userId}`)

      if (response.ok) {
        const data = await response.json()
        setUser(data)
      } else if (response.status === 404) {
        setError("User not found")
      } else {
        setError("Failed to load user details")
      }
    } catch (error) {
      console.error("Error fetching user:", error)
      setError("An error occurred while loading user details")
    } finally {
      setIsLoading(false)
    }
  }

  // Helper function to check if user can be edited
  const canEditUser = () => {
    if (!user) return false
    if (isSuperAdmin) return true // Super admin can edit anyone
    if (isOwnAccount) return true // Admin can always edit their own account
    if (user.role === "ADMIN") return false // Regular admin cannot edit other admin users
    return true // Regular admin can edit participants
  }

  // Helper function to check if user can be deleted
  const canDeleteUser = () => {
    if (!user) return false
    if (!isSuperAdmin) return false // Only super admins can delete
    if (isOwnAccount) return false // Cannot delete own account
    if (user.role === "ADMIN" && user.admin?.isSuperAdmin) return false // Cannot delete super admins
    return true // Can delete participants and regular admins
  }

  // Helper function to get action button tooltip
  const getActionTooltip = () => {
    if (!user) return ""
    if (isOwnAccount) return "Cannot delete your own account"
    if (!isSuperAdmin) return "Delete (Super Admin Only)"
    if (user.role === "ADMIN" && user.admin?.isSuperAdmin) return "Cannot delete Super Admin"
    return "Delete User"
  }

  const handleDelete = async () => {
    if (!user) return

    // Check permissions
    if (!canDeleteUser()) {
      alert(getActionTooltip())
      setShowDeleteDialog(false)
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/users?userId=${user.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        router.push("/admin/users")
      } else {
        const data = await response.json()
        alert(data.error || "Failed to delete user")
      }
    } catch (error) {
      console.error("Error deleting user:", error)
      alert("An error occurred while deleting user")
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handleEditSuccess = () => {
    setShowEditDialog(false)
    fetchUser()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getRoleVariant = (role: string): "default" | "secondary" | "destructive" => {
    switch (role) {
      case "ADMIN":
        return "destructive"
      case "PARTICIPANT":
        return "default"
      default:
        return "secondary"
    }
  }

  const getUserDisplayName = () => {
    if (!user) return ""
    return user.participant?.name || user.admin?.name || user.email.split("@")[0]
  }

  const getUserInitials = () => {
    const name = getUserDisplayName()
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getUserAvatar = () => {
    let url: string | null = null
    if (user?.role === "ADMIN" && user.admin?.avatarUrl) {
      url = user.admin.avatarUrl
    } else if (user?.role === "PARTICIPANT" && user.participant?.avatarUrl) {
      url = user.participant.avatarUrl
    } else if (user?.role === "STAFF" && (user as any).staff?.avatarUrl) {
      url = (user as any).staff.avatarUrl
    } else if (user?.role === "MANAGER" && (user as any).manager?.avatarUrl) {
      url = (user as any).manager.avatarUrl
    }
    return url
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-64 w-full" />
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-96" />
              <Skeleton className="h-96" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <p className="text-center text-destructive mb-4">
                {error || "User not found"}
              </p>
              <Button
                onClick={() => router.push("/admin/users")}
                className="w-full"
                variant="outline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Users
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin")}
            className="gap-2"
          >
            Dashboard
          </Button>
          <span>/</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/users")}
          >
            Users
          </Button>
          <span>/</span>
          <span className="text-foreground">{getUserDisplayName()}</span>
        </div>

        {/* Header Card with User Info */}
        <Card className="mb-6 overflow-hidden border-none shadow-xl">
          {/* Gradient Background */}
          <div className="h-32 sm:h-48 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-32 h-32 sm:w-40 sm:h-40">
                <Image
                  src="/icpc_foundation.png"
                  alt="ICPC Foundation"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>

          <CardContent className="relative pb-6 -mt-16 sm:-mt-20">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
              {/* Avatar */}
              <div className="relative">
                <Avatar className="h-32 w-32 ring-4 ring-background">
                  {getUserAvatar() ? (
                    <AvatarImage src={getUserAvatar()!} alt={getUserDisplayName()} />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-3xl ">
                      {getUserInitials()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-blue-500 border-4 border-background flex items-center justify-center">
                  <VerifiedIcon className="h-4 w-4 text-white" />
                </div>
              </div>

              {/* User Info */}
              <div className="text-center sm:text-left flex-1">
                <h1 className="text-3xl sm:text-4xl ">{getUserDisplayName()}</h1>
                <p className="text-muted-foreground text-lg mt-1 break-all">{user.email}</p>
                <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
                    {/* <Shield className="h-3 w-3 mr-1" /> */}
                    {user.role} | &nbsp;
                  {/* {user.role === "ADMIN" && user.admin?.isSuperAdmin && (
                    <Badge variant="destructive" className="text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      Super Admin
                    </Badge>
                  )} */}
                  {isOwnAccount 
                  && (
                    <Badge variant="secondary" className="">
                      {/* <UserCircle className="h-3 w-3 mr-1" /> */}
                      Your Account
                    </Badge>
                  )
                  }
                  {/* <Badge variant="secondary" className="">
                    <CheckCircle className="h-3 w-3 mr-1" /> */}
                    {/* Active */}
                  {/* </Badge> */}
               
                    {/* <Badge variant="outline" className="font-mono"> */}
                      {/* <IdCard className="h-3 w-3 mr-1" /> */}
                     UID: {user.uid}
                    {/* </Badge> */}
                
                  {user.participant?.siteName && (
                    <Badge variant="outline" className="">
                      <MapPin className="h-3 w-3 mr-1" />
                      {user.participant.siteName}
                    </Badge>
                  )}
                  {user.participant?.teamName && (
                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20">
                      <Users className="h-3 w-3 mr-1" />
                      {user.participant.teamName}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {canEditUser() ? (
                  <Button
                    onClick={() => setShowEditDialog(true)}
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                ) : (
                  <Button
                    disabled
                    variant="outline"
                    className="gap-2 opacity-50"
                  >
                    <Edit className="h-4 w-4" />
                    Edit (Super Admin Only)
                  </Button>
                )}
                
                {canDeleteUser() ? (
                  <Button
                    onClick={() => setShowDeleteDialog(true)}
                    variant="outline"
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                ) : (
                  <Button
                    disabled
                    variant="outline"
                    className="gap-2 opacity-50"
                    title={getActionTooltip()}
                  >
                    <Trash2 className="h-4 w-4" />
                    {isOwnAccount ? "Cannot Delete Self" : getActionTooltip()}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Account Information */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="h-10 w-10  flex items-center justify-center">
                  <FaUserFriends className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoItem icon={<Mail />} label="Email Address" value={user.email} />
              <InfoItem icon={<IdCard />} label="User ID" value={user.id} className="font-mono text-xs" />
              {user.uid && <InfoItem icon={<IdCard />} label="UID" value={user.uid} />}
              <InfoItem
                icon={<Calendar />}
                label="Account Created"
                value={formatDate(user.createdAt)}
              />
            </CardContent>
          </Card>

          {/* Role-Specific Information */}
          {user.role === "PARTICIPANT" && user.participant && (
            <>
              {/* Personal Information */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-10 w-10 0 flex items-center justify-center">
                      <FaUserAlt className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoItem icon={<User />} label="Full Name" value={user.participant.name} />
                  <InfoItem
                    icon={<Building2 />}
                    label="College"
                    value={user.participant.college || "Not provided"}
                  />
                  <InfoItem
                    icon={<Phone />}
                    label="Contact Number"
                    value={user.participant.contactNumber || "Not provided"}
                  />
                  <InfoItem
                    icon={<UserCircle />}
                    label="Gender"
                    value={user.participant.gender || "Not specified"}
                    className="capitalize"
                  />
                </CardContent>
              </Card>

              {/* Site & Team Information */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-10 w-10  flex items-center justify-center">
                      <FaMapMarked className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    Site & Team Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoItem
                    icon={<MapPin />}
                    label="Site Location"
                    value={user.participant.siteName || "Not assigned"}
                  />
                  <InfoItem
                    icon={<Users />}
                    label="Team Name"
                    value={user.participant.teamName || "Not assigned"}
                  />
                </CardContent>
              </Card>

              {/* Hostel Information */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-10 w-10  flex items-center justify-center">
                      <FaBuilding className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    Hostel Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoItem
                    icon={<Building2 />}
                    label="Hostel Name"
                    value={user.participant.hostelName || "Not assigned"}
                  />
                  <InfoItem
                    icon={<DoorOpen />}
                    label="Room Number"
                    value={user.participant.roomNumber || "Not assigned"}
                  />
                  {user.participant.hostelLocation && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Location
                      </label>
                      <a
                        href={user.participant.hostelLocation}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        View on Google Maps
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* WiFi Credentials */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-10 w-10  flex items-center justify-center">
                      <Wifi className="h-5 w-5 text-blue-400 dark:text-blue-400" />
                    </div>
                    WiFi Credentials
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoItem
                    icon={<User />}
                    label="WiFi Username"
                    value={user.participant.wifiusername || "Not provided"}
                    className="font-mono"
                  />
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      WiFi Password
                    </label>
                    <div className="flex items-center gap-2">
                      <p className={cn("text-sm font-mono", !showWifiPassword && "select-none")}>
                        {showWifiPassword
                          ? user.participant.wifiPassword || "Not provided"
                          : "••••••••"}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowWifiPassword(!showWifiPassword)}
                      >
                        {showWifiPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {user.role === "ADMIN" && user.admin && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="h-10 w-10  flex items-center justify-center">
                    <FaUser className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  Administrator Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoItem icon={<User />} label="Full Name" value={user.admin.name} />
                <InfoItem
                  icon={<UserCircle />}
                  label="Gender"
                  value={user.admin.gender || "Not specified"}
                  className="capitalize"
                />
                <InfoItem
                  icon={<Clock />}
                  label="Profile Created"
                  value={formatDate(user.admin.createdAt)}
                />
                {/* {user.admin.isSuperAdmin && (
                  <div className="pt-2">
                    <Alert className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
                      <Shield className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-sm text-red-800 dark:text-red-200">
                        This user has Super Administrator privileges with full system access.
                      </AlertDescription>
                    </Alert>
                  </div>
                )} */}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update the user information below.
            </DialogDescription>
          </DialogHeader>
          <UserForm editingUser={user} onSuccess={handleEditSuccess} />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account
              for <strong>{getUserDisplayName()}</strong> and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Info Item Component
function InfoItem({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <div className="text-muted-foreground">{icon}</div>
        {label}
      </label>
      <p className={cn("text-sm break-words", className)}>{value}</p>
    </div>
  )
}