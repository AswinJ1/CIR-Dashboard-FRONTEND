"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Save, AlertCircle, Eye, EyeOff, MapPin, CheckCircle2, XCircle, Info, Shield } from "lucide-react"
import { Separator } from "@/components/ui/separator"

interface UserFormProps {
  editingUser?: any
  onSuccess?: () => void
}

export default function UserForm({ editingUser, onSuccess }: UserFormProps) {
  const { data: session } = useSession()
  const isSuperAdmin = session?.user?.isSuperAdmin || false
  const isOwnAccount = editingUser && session?.user?.id === editingUser.id  // Add this check
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showSiteVerification, setShowSiteVerification] = useState(false)
  const [selectedVerificationSite, setSelectedVerificationSite] = useState("")
  const [siteVerificationError, setSiteVerificationError] = useState<string | null>(null)
  const [pendingFormData, setPendingFormData] = useState<any>(null)
  const [lockedSiteName, setLockedSiteName] = useState<string>("")
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    newPassword: "",
    uid: "",
    role: "PARTICIPANT",
    name: "",
    college: "",
    siteName: "",
    teamName: "",
    hostelName: "",
    roomNumber: "",
    wifiusername: "",
    wifiPassword: "",
    hostelLocation: "",
    contactNumber: "",
    gender: "male",
  })

  const siteLocations = ["Mysuru", "Amritapuri", "Coimbatore", "Bangalore"]

  useEffect(() => {
    if (editingUser) {
      const existingSiteName = editingUser.participant?.siteName || ""
      
      // Lock the site name if it exists
      if (existingSiteName && existingSiteName.trim() !== "") {
        setLockedSiteName(existingSiteName.trim())
      }
      
      setFormData({
        email: editingUser.email,
        password: "",
        newPassword: "",
        uid: editingUser.uid || "",
        role: editingUser.role,
        name: editingUser.participant?.name || editingUser.admin?.name || "",
        college: editingUser.participant?.college || "",
        siteName: existingSiteName,
        teamName: editingUser.participant?.teamName || "",
        hostelName: editingUser.participant?.hostelName || "",
        roomNumber: editingUser.participant?.roomNumber || "",
        wifiusername: editingUser.participant?.wifiusername || "",
        wifiPassword: editingUser.participant?.wifiPassword || "",
        hostelLocation: editingUser.participant?.hostelLocation || "",
        contactNumber: editingUser.participant?.contactNumber || "",
        gender: editingUser.participant?.gender || editingUser.admin?.gender || "male",
      })
    } else {
      // Reset for new user
      setLockedSiteName("")
    }
  }, [editingUser])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError(null)
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check permissions - Allow if it's their own account OR if they're super admin
    if (!isOwnAccount && !isSuperAdmin && formData.role === "ADMIN") {
      setError("Only Super Admins can create or manage other Admin users")
      return
    }
    
    // If editing a participant with a site set, ALWAYS require verification
    if (editingUser && editingUser.role === "PARTICIPANT" && lockedSiteName) {
      setPendingFormData(formData)
      setShowSiteVerification(true)
      setSiteVerificationError(null)
      setSelectedVerificationSite("")
      return
    }

    // For new users, non-participants, or participants without site, proceed directly
    await submitUserData(formData)
  }

  const handleSiteVerification = async () => {
    if (!selectedVerificationSite) {
      setSiteVerificationError("Please select a site location to verify")
      return
    }

    // Verify if selected site matches the locked site name
    if (selectedVerificationSite !== lockedSiteName) {
      setSiteVerificationError(
        `Site verification failed! The selected site (${selectedVerificationSite}) does not match the participant's registered site (${lockedSiteName}). Please select the correct site to proceed.`
      )
      return
    }

    // Site verified successfully, proceed with update
    setShowSiteVerification(false)
    await submitUserData(pendingFormData)
  }

  const submitUserData = async (data: any) => {
    setIsLoading(true)
    setError(null)

    try {
      const url = editingUser
        ? `/api/users?userId=${editingUser.id}`
        : "/api/users"
      
      const method = editingUser ? "PATCH" : "POST"

      const body: any = {
        name: data.name,
        gender: data.gender,
      }

      if (!editingUser) {
        // Creating new user
        body.email = data.email
        body.password = data.password
        body.uid = data.uid
        body.role = data.role
        
        // Add participant fields for new users
        if (data.role === "PARTICIPANT") {
          body.college = data.college
          body.siteName = data.siteName
          body.teamName = data.teamName
          body.hostelName = data.hostelName
          body.roomNumber = data.roomNumber
          body.wifiusername = data.wifiusername
          body.wifiPassword = data.wifiPassword
          body.hostelLocation = data.hostelLocation
          body.contactNumber = data.contactNumber
        }
      } else {
        // Updating existing user
        
        // Add password update if provided
        if (data.newPassword && data.newPassword.trim() !== "") {
          body.newPassword = data.newPassword
        }

        // Add participant fields if user is a participant
        if (editingUser.role === "PARTICIPANT") {
          body.college = data.college
          // IMPORTANT: Always send the locked siteName, never allow it to change
          body.siteName = lockedSiteName || data.siteName
          body.teamName = data.teamName
          body.hostelName = data.hostelName
          body.roomNumber = data.roomNumber
          body.wifiusername = data.wifiusername
          body.wifiPassword = data.wifiPassword
          body.hostelLocation = data.hostelLocation
          body.contactNumber = data.contactNumber
        }
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      const responseData = await response.json()

      if (response.ok) {
        // If this was a new participant and siteName was just set, lock it
        if (!editingUser && data.role === "PARTICIPANT" && data.siteName) {
          setLockedSiteName(data.siteName)
        }
        
        if (onSuccess) {
          onSuccess()
        }
      } else {
        setError(responseData.error || "Failed to save user")
      }
    } catch (error) {
      console.error("Form submission error:", error)
      setError("An error occurred while saving the user")
    } finally {
      setIsLoading(false)
      setPendingFormData(null)
    }
  }

  // Site is disabled if locked
  const isSiteDisabled = !!lockedSiteName

  // Show warning only if editing another admin user (not own account)
  const showAdminWarning = editingUser && editingUser.role === "ADMIN" && !isSuperAdmin && !isOwnAccount

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Show warning only when trying to edit ANOTHER admin's account */}
        {showAdminWarning && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
              Only Super Admins can create or manage Admin users
          </Alert>
        )}

        {/* Super Admin Badge - Show at top for new users */}
      

        {/* Show "Editing Own Account" badge */}
        {isOwnAccount && (
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
            <Info className="h-4 w-4 text-foreground" />
              You are editing your own account information.
        
          </Alert>
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Basic Information</h3>
          
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="user@example.com"
              required
              disabled={!!editingUser}
            />
            {editingUser && (
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            )}
          </div>

          {!editingUser && (
            <>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="uid">UID</Label>
                <Input
                  id="uid"
                  name="uid"
                  value={formData.uid}
                  onChange={handleInputChange}
                  placeholder="Unique identifier (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="flex items-center gap-2">
                  Role *
                  {!isSuperAdmin && (
                    <span className="text-xs text-muted-foreground font-normal">
                      (Admin creation requires Super Admin)
                    </span>
                  )}
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleSelectChange("role", value)}
                  disabled={!isSuperAdmin && formData.role === "ADMIN"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PARTICIPANT">Participant</SelectItem>
                    <SelectItem value="ADMIN" disabled={!isSuperAdmin}>
                      <div className="flex items-center justify-between w-full">
                        <span>Admin</span>
                        {!isSuperAdmin && (
                          <Shield className="h-3 w-3 ml-2 text-muted-foreground" />
                        )}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {!isSuperAdmin && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Only Super Admins can create Admin users
                  </p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="gender">Gender *</Label>
            <Select
              value={formData.gender}
              onValueChange={(value) => handleSelectChange("gender", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Password Update Section (Only for editing) */}
        {editingUser && (
          <>
            <Separator />
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Update Password</h3>
                <p className="text-sm text-muted-foreground">Leave blank to keep current password</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    placeholder="Enter new password (optional)"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {formData.newPassword && (
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 6 characters
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Participant Details */}
        {formData.role === "PARTICIPANT" && (
          <>
            <Separator />
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Participant Details</h3>
              
              <div className="space-y-2">
                <Label htmlFor="college">College *</Label>
                <Input
                  id="college"
                  name="college"
                  value={formData.college}
                  onChange={handleInputChange}
                  placeholder="College name"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="siteName">Site Name</Label>
                  <Select
                    value={formData.siteName}
                    onValueChange={(value) => handleSelectChange("siteName", value)}
                    disabled={isSiteDisabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mysuru">Mysuru</SelectItem>
                      <SelectItem value="Amritapuri">Amritapuri</SelectItem>
                      <SelectItem value="Coimbatore">Coimbatore</SelectItem>
                      <SelectItem value="Bangalore">Bangalore</SelectItem>
                    </SelectContent>
                  </Select>
                  {isSiteDisabled && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Site cannot be changed once set
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teamName">Team Name</Label>
                  <Input
                    id="teamName"
                    name="teamName"
                    value={formData.teamName}
                    onChange={handleInputChange}
                    placeholder="Team name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hostelName">Hostel Name</Label>
                  <Input
                    id="hostelName"
                    name="hostelName"
                    value={formData.hostelName}
                    onChange={handleInputChange}
                    placeholder="Hostel name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="roomNumber">Room Number</Label>
                  <Input
                    id="roomNumber"
                    name="roomNumber"
                    value={formData.roomNumber}
                    onChange={handleInputChange}
                    placeholder="Room number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wifiusername">WiFi Username</Label>
                  <Input
                    id="wifiusername"
                    name="wifiusername"
                    value={formData.wifiusername}
                    onChange={handleInputChange}
                    placeholder="WiFi username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wifiPassword">WiFi Password</Label>
                  <Input
                    id="wifiPassword"
                    name="wifiPassword"
                    value={formData.wifiPassword}
                    onChange={handleInputChange}
                    placeholder="WiFi password"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hostelLocation">Hostel Location URL</Label>
                <Input
                  id="hostelLocation"
                  name="hostelLocation"
                  value={formData.hostelLocation}
                  onChange={handleInputChange}
                  placeholder="https://maps.google.com/..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactNumber">Contact Number</Label>
                <Input
                  id="contactNumber"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  placeholder="Phone number"
                />
              </div>
            </div>
          </>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {editingUser ? "Update User" : "Create User"}
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Site Verification Dialog */}
      <Dialog open={showSiteVerification} onOpenChange={setShowSiteVerification}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-foreground" />
              Verify Site Location
            </DialogTitle>
            <DialogDescription>
              Please verify the participant's site location before updating their details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Site Info */}
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    Participant Information:
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <span className="font-medium">Name:</span> {editingUser?.participant?.name}
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            {/* Site Selection */}
            <div className="space-y-2">
              <Label htmlFor="verificationSite">Select Site to Verify *</Label>
              <Select
                value={selectedVerificationSite}
                onValueChange={(value) => {
                  setSelectedVerificationSite(value)
                  setSiteVerificationError(null)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a site location" />
                </SelectTrigger>
                <SelectContent>
                  {siteLocations.map((site) => (
                    <SelectItem key={site} value={site}>
                      {site}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the site that matches the participant's registered location
              </p>
            </div>

            {/* Error Display */}
            {siteVerificationError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {siteVerificationError}
                </AlertDescription>
              </Alert>
            )}

            {/* Success Preview */}
            {selectedVerificationSite && 
             selectedVerificationSite === lockedSiteName && (
              <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-foreground" />
                <AlertDescription className="text-sm text-green-800 dark:text-green-200">
                  ✓ Site verified successfully! You can proceed with the update.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowSiteVerification(false)
                setSiteVerificationError(null)
                setSelectedVerificationSite("")
              }}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSiteVerification}
              disabled={!selectedVerificationSite || isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Verify & Update
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}