"use client"

import { useAuth } from "@/components/providers/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RoleBadge } from "@/components/ui/status-badge"
import { Separator } from "@/components/ui/separator"
import { Mail, Building2, Key } from "lucide-react"
import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { AvatarSelector } from "@/components/avatar-selector"

export default function ProfilePage() {
  const { user, role } = useAuth()
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined)
  const [gender, setGender] = useState<"male" | "female">("male")

  // Fetch profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch("/api/profile")
        if (response.ok) {
          const data = await response.json()
          setAvatarUrl(data.admin?.avatarUrl || data.avatarUrl)
          setGender(data.admin?.gender || data.gender || "male")
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error)
      }
    }
    fetchProfile()
  }, [])

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match")
      return
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    setIsLoading(true)
    try {
      await api.employees.changePassword({
        currentPassword,
        newPassword,
      })
      toast.success("Password changed successfully")
      setIsChangingPassword(false)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error) {
      console.error("Failed to change password:", error)
      toast.error("Failed to change password. Check your current password.")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAvatarSave(newAvatarUrl: string, newGender: "male" | "female") {
    try {
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: newAvatarUrl, gender: newGender }),
      })
      if (!response.ok) throw new Error("Failed to save avatar")
      setAvatarUrl(newAvatarUrl)
      setGender(newGender)
      toast.success("Avatar updated successfully")
    } catch (error) {
      console.error("Failed to save avatar:", error)
      toast.error("Failed to update avatar")
      throw error
    }
  }

  const getInitials = (name?: string) => {
    if (!name) return "U"
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your account settings
        </p>
      </div>

      {/* Profile Info */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg sm:text-xl">Account Information</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <AvatarSelector
              currentAvatar={avatarUrl}
              gender={gender}
              onSave={handleAvatarSave}
              fallbackInitials={getInitials(user?.name)}
            />
            <div className="text-center sm:text-left">
              <h3 className="text-lg sm:text-xl font-semibold">{user?.name || 'User'}</h3>
              {role && <RoleBadge role={role} className="mt-1" />}
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium truncate">{user?.email}</p>
              </div>
            </div>

            {user?.subDepartmentId && (
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Sub-Department</p>
                  <p className="font-medium truncate">{user.subDepartmentId}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Key className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Change your password</CardDescription>
        </CardHeader>
        <CardContent>
          {!isChangingPassword ? (
            <Button onClick={() => setIsChangingPassword(true)} className="w-full sm:w-auto">
              Change Password
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setIsChangingPassword(false)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button onClick={handleChangePassword} disabled={isLoading} className="w-full sm:w-auto">
                  {isLoading ? "Saving..." : "Save Password"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}