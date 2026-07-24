"use client"

import { useAuth } from "@/components/providers/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { IdCard } from "lucide-react" // or UserCog
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Mail, Building2, Key, Shield, User, Briefcase, Lock } from "lucide-react"
import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { AvatarSelector } from "@/components/avatar-selector"
import { cn } from "@/lib/utils"

interface ProfilePageProps {
    roleKey: "admin" | "manager" | "staff"
}

type ProfileTab = "profile" | "security"

export function ProfilePage({ roleKey }: ProfilePageProps) {
    const { user, role } = useAuth()
    const [activeTab, setActiveTab] = useState<ProfileTab>("profile")
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

    const navItems: { key: ProfileTab; label: string; icon: typeof User }[] = [
        { key: "profile", label: "Profile", icon: User },
        { key: "security", label: "Security", icon: Lock },
    ]

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
            {/* Page header */}
            <div>
                <h1 className="text-2xl sm:text-3xl">Settings</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                    Manage your account settings and preferences
                </p>
            </div>

            {/* Profile Hero Card */}
                <Card>
                    <CardContent className="px-4 sm:px-6 py-6">
                        <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4">
                            <div className="h-32 w-32 sm:h-36 sm:w-36 shrink-0">
                                <AvatarSelector
                                    currentAvatar={avatarUrl}
                                    gender={gender}
                                    onSave={handleAvatarSave}
                                    fallbackInitials={getInitials(displayName)}
                                />
                            </div>
                            <div className="flex-1 text-center sm:text-left">
                                <h2 className="text-xl sm:text-2xl">{displayName}</h2>
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1 text-sm text-muted-foreground">
                                    <span className="capitalize">{role?.toLowerCase()}</span>
                                    {jobTitle && (
                                        <>
                                            <span>·</span>
                                            <span>{jobTitle}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

            {/* Sidebar + Content layout */}
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
                <nav className="space-y-1">
                    {navItems.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={cn(
                                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                                activeTab === key
                                    ? "bg-secondary text-secondary-foreground"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </button>
                    ))}
                </nav>

                <div className="space-y-4">
                    {activeTab === "profile" && (
                        <>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Contact Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs text-muted-foreground">Email</p>
                                            <p className="text-sm truncate">{displayEmail || "Not available"}</p>
                                        </div>
                                    </div>
                                    <Separator />
                                    <div className="flex items-center gap-3">
                                        <IdCard className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs text-muted-foreground">Role</p>
                                            <p className="text-sm capitalize">{role?.toLowerCase() || "Unknown"}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Department</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs text-muted-foreground">Department</p>
                                            <p className="text-sm">{departmentName || "Not assigned"}</p>
                                        </div>
                                    </div>
                                    <Separator />
                                    <div className="flex items-center gap-3">
                                        <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs text-muted-foreground">Sub-Department</p>
                                            <p className="text-sm">{subDepartmentName || "Not assigned"}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {activeTab === "security" && (
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">Security</CardTitle>
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
                                <div className="flex items-center gap-3">
                                    <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div>
                                        <p className="text-sm">Password</p>
                                        <p className="text-xs text-muted-foreground">
                                            Minimum 6 characters required
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Change Password Dialog */}
            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
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