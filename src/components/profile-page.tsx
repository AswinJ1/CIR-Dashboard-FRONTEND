"use client"

import { useAuth } from "@/components/providers/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RoleBadge } from "@/components/ui/status-badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Mail, Building2, Key, Shield, Camera, User, Calendar, Briefcase } from "lucide-react"
import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { AvatarSelector } from "@/components/avatar-selector"

interface ProfilePageProps {
    roleKey: "admin" | "manager" | "staff"
}

export function ProfilePage({ roleKey }: ProfilePageProps) {
    const { user, role } = useAuth()
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined)
    const [gender, setGender] = useState<"male" | "female">("male")
    const [profileName, setProfileName] = useState<string | null>(null)
    const [profileEmail, setProfileEmail] = useState<string | null>(null)
    const [departmentName, setDepartmentName] = useState<string | null>(null)
    const [subDepartmentName, setSubDepartmentName] = useState<string | null>(null)
    const [jobTitle, setJobTitle] = useState<string | null>(null)
    const [profileLoading, setProfileLoading] = useState(true)

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const data = await api.profile.get()
                const roleData = data[roleKey]
                setAvatarUrl(roleData?.avatarUrl || data.avatarUrl)
                setGender(roleData?.gender || data.gender || "male")
                setProfileName(roleData?.name || data.name || null)
                setProfileEmail(roleData?.email || data.email || user?.email || null)
                setDepartmentName(roleData?.department?.name || data.department?.name || null)
                setSubDepartmentName(roleData?.subDepartment?.name || data.subDepartment?.name || null)
                setJobTitle(roleData?.jobTitle || data.jobTitle || null)
            } catch (error) {
                console.error("Failed to fetch profile:", error)
            } finally {
                setProfileLoading(false)
            }
        }
        fetchProfile()
    }, [roleKey, user?.email])

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
            await api.employees.changePassword({ currentPassword, newPassword })
            toast.success("Password changed successfully")
            setIsPasswordDialogOpen(false)
            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
        } catch (error: any) {
            toast.error(error?.message || "Failed to change password. Check your current password.")
        } finally {
            setIsLoading(false)
        }
    }

    async function handleAvatarSave(newAvatarUrl: string, newGender: "male" | "female") {
        try {
            await api.profile.updateAvatar({
                avatarUrl: newAvatarUrl,
                gender: newGender,
            })
            setAvatarUrl(newAvatarUrl)
            setGender(newGender)
            toast.success("Avatar updated successfully")
        } catch (error: any) {
            console.error("Failed to save avatar:", error)
            toast.error(error.message || "Failed to update avatar")
            throw error
        }
    }

    const getInitials = (name?: string) => {
        if (!name) return "U"
        return name.split(" ").map(word => word[0]).join("").toUpperCase().slice(0, 2)
    }

    const displayName = profileName || user?.name || "User"
    const displayEmail = profileEmail || user?.email || ""

    if (profileLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
            {/* Page header */}
            <div>
                <h1 className="text-2xl sm:text-3xl  tracking-tight">Profile</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                    Manage your account settings and preferences
                </p>
            </div>

            {/* Profile Hero Card */}
            <Card className="overflow-hidden">
                {/* Gradient banner */}
                <div className="h-32 sm:h-40 bg-gradient-to-br from-primary/80 via-primary/60 to-primary/40 relative">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzMuMzEgMCA2LTIuNjkgNi02cy0yLjY5LTYtNi02LTYgMi42OS02IDYgMi42OSA2IDYgNnptMCAxMmMzLjMxIDAgNi0yLjY5IDYtNnMtMi42OS02LTYtNi02IDIuNjktNiA2IDIuNjkgNiA2IDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
                </div>

                <CardContent className="relative px-4 sm:px-6 pb-6">
                    {/* Avatar overlapping the banner */}
                    <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-16 sm:-mt-14">
                        <div className="relative group">
                            <AvatarSelector
                                currentAvatar={avatarUrl}
                                gender={gender}
                                onSave={handleAvatarSave}
                                fallbackInitials={getInitials(displayName)}
                            />
                        </div>
                        <div className="flex-1 text-center sm:text-left sm:pb-1">
                            <h2 className="text-xl sm:text-2xl ">{displayName}</h2>
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1.5">
                                {role} |
                                {jobTitle && (
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground  px-2 py-0.5 ">
                                        {/* <Briefcase className="h-3 w-3" /> */}
                                        {jobTitle}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Information Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
                {/* Contact Info */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            Contact Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-primary/10 p-2">
                                <Mail className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</p>
                                <p className="text-sm font-medium truncate mt-0.5">{displayEmail || "Not available"}</p>
                            </div>
                        </div>
                        <Separator />
                        <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-primary/10 p-2">
                                <Shield className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</p>
                                <p className="text-sm font-medium mt-0.5 capitalize">{role?.toLowerCase() || "Unknown"}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Department Info */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            Department
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-primary/10 p-2">
                                <Building2 className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Department</p>
                                <p className="text-sm font-medium mt-0.5">{departmentName || "Not assigned"}</p>
                            </div>
                        </div>
                        <Separator />
                        <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-primary/10 p-2">
                                <Briefcase className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sub-Department</p>
                                <p className="text-sm font-medium mt-0.5">{subDepartmentName || "Not assigned"}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Security Card */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Key className="h-4 w-4 text-muted-foreground" />
                            Security
                        </CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsPasswordDialogOpen(true)}
                        >
                            Change Password
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3 p-3">
                        {/* <div className="rounded-lg bg-green-500/10 p-2">
                            <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div> */}
                        <div>
                            <p className="text-sm font-medium">Password</p>
                            <p className="text-xs text-muted-foreground">
                              Minimum 6 characters required
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Change Password Dialog */}
            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Key className="h-5 w-5" />
                            Change Password
                        </DialogTitle>
                        <DialogDescription>
                            Enter your current password and choose a new one.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="current-password">Current Password</Label>
                            <Input
                                id="current-password"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Enter current password"
                            />
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <Input
                                id="new-password"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="At least 6 characters"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm New Password</Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter new password"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsPasswordDialogOpen(false)
                                setCurrentPassword("")
                                setNewPassword("")
                                setConfirmPassword("")
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleChangePassword}
                            disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
                        >
                            {isLoading ? "Saving..." : "Update Password"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
