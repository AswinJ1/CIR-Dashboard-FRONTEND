"use client"

import { useState, useRef } from "react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, Image as ImageIcon } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import { API_BASE_URL, getToken } from "@/lib/api"

interface AvatarSelectorProps {
  currentAvatar?: string
  gender: "male" | "female"
  onSave: (avatarUrl: string, gender: "male" | "female") => Promise<void>
  fallbackInitials: string
}

const MALE_AVATARS = [
  "https://api.dicebear.com/9.x/lorelei/svg?seed=Leo",
  "https://api.dicebear.com/9.x/lorelei/svg?seed=Oliver",
  "https://api.dicebear.com/9.x/lorelei/svg?seed=Avery",
  "https://api.dicebear.com/9.x/lorelei/svg?seed=Alexander",
  "https://api.dicebear.com/9.x/lorelei/svg?seed=Ryan"
]

const FEMALE_AVATARS = [
  "https://api.dicebear.com/9.x/lorelei/svg?seed=Ryker",
  "https://api.dicebear.com/9.x/lorelei/svg?seed=Katherine",
  "https://api.dicebear.com/9.x/lorelei/svg?seed=Sophia",
  "https://api.dicebear.com/9.x/lorelei/svg?seed=Luis",
  "https://api.dicebear.com/9.x/lorelei/svg?seed=Andrea",
]

export function AvatarSelector({
  currentAvatar,
  gender,
  onSave,
  fallbackInitials,
}: AvatarSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar || "")
  const [selectedGender, setSelectedGender] = useState<"male" | "female">(gender)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      alert("Invalid file type. Only JPEG, PNG, and WebP are allowed")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File too large. Maximum size is 5MB")
      return
    }

    setUploadedFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setUploadPreview(reader.result as string)
      setSelectedAvatar(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)

      if (uploadedFile) {
        // Upload custom image
        const formData = new FormData()
        formData.append("file", uploadedFile)
        formData.append("gender", selectedGender)

        const token = getToken()
        const response = await fetch(`${API_BASE_URL}/profile/avatar/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Upload failed")
        }

        const data = await response.json()
        await onSave(data.avatarUrl, selectedGender)
      } else {
        // Use pre-made avatar
        await onSave(selectedAvatar, selectedGender)
      }

      setIsOpen(false)
      setUploadPreview(null)
      setUploadedFile(null)
    } catch (error) {
      console.error("Error saving avatar:", error)
      alert(error instanceof Error ? error.message : "Failed to save avatar")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="relative">
        <Avatar className="h-24 w-24 mb-4 cursor-pointer border-4 border-white shadow-lg" onClick={() => setIsOpen(true)}>
          {currentAvatar ? (
            <AvatarImage src={currentAvatar} alt="Profile avatar" />
          ) : (
            <AvatarFallback className="bg-blue-600 text-white text-2xl">
              {fallbackInitials}
            </AvatarFallback>
          )}
        </Avatar>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="mt-2"
        >
          Change Avatar
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Choose Your Avatar</DialogTitle>
            <DialogDescription>
              Upload your own image or select a pre-made avatar
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload">
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="male">Male</TabsTrigger>
              <TabsTrigger value="female">Female</TabsTrigger>
            </TabsList>

            {/* Upload Tab */}
            <TabsContent value="upload" className="space-y-4">
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-blue-500 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {uploadPreview ? (
                  <div className="space-y-4">
                    <Avatar className="h-32 w-32 mx-auto">
                      <AvatarImage src={uploadPreview} alt="Upload preview" />
                    </Avatar>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose Different Image
                    </Button>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="mx-auto h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Upload your photo</p>
                      <p className="text-xs text-gray-500 mt-1">
                        PNG, JPG, WebP up to 5MB
                      </p>
                    </div>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-4"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Select Image
                    </Button>
                  </div>
                )}
              </div>

              {/* Gender Selection for Upload */}
              <div className="space-y-2">
                <Label>Select Gender</Label>
                <RadioGroup
                  value={selectedGender}
                  onValueChange={(value) => setSelectedGender(value as "male" | "female")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="male" id="gender-male" />
                    <Label htmlFor="gender-male" className="cursor-pointer">Male</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="female" id="gender-female" />
                    <Label htmlFor="gender-female" className="cursor-pointer">Female</Label>
                  </div>
                </RadioGroup>
              </div>
            </TabsContent>

            {/* Male Avatars Tab */}
            <TabsContent value="male">
              <RadioGroup
                value={selectedAvatar}
                onValueChange={(value) => {
                  setSelectedAvatar(value)
                  setSelectedGender("male")
                  setUploadPreview(null)
                  setUploadedFile(null)
                }}
              >
                <div className="grid grid-cols-4 gap-4 py-4">
                  {MALE_AVATARS.map((avatarUrl, index) => (
                    <div key={index} className="flex flex-col items-center gap-2">
                      <RadioGroupItem
                        value={avatarUrl}
                        id={`male-avatar-${index}`}
                        className="sr-only"
                      />
                      <Label
                        htmlFor={`male-avatar-${index}`}
                        className={`cursor-pointer rounded-full p-1 transition-all ${selectedAvatar === avatarUrl && !uploadPreview
                            ? "ring-4 ring-blue-600 ring-offset-2"
                            : "hover:ring-2 hover:ring-gray-300"
                          }`}
                      >
                        <Avatar className="h-20 w-20">
                          <AvatarImage src={avatarUrl} alt={`Male Avatar ${index + 1}`} />
                          <AvatarFallback>{fallbackInitials}</AvatarFallback>
                        </Avatar>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </TabsContent>

            {/* Female Avatars Tab */}
            <TabsContent value="female">
              <RadioGroup
                value={selectedAvatar}
                onValueChange={(value) => {
                  setSelectedAvatar(value)
                  setSelectedGender("female")
                  setUploadPreview(null)
                  setUploadedFile(null)
                }}
              >
                <div className="grid grid-cols-4 gap-4 py-4">
                  {FEMALE_AVATARS.map((avatarUrl, index) => (
                    <div key={index} className="flex flex-col items-center gap-2">
                      <RadioGroupItem
                        value={avatarUrl}
                        id={`female-avatar-${index}`}
                        className="sr-only"
                      />
                      <Label
                        htmlFor={`female-avatar-${index}`}
                        className={`cursor-pointer rounded-full p-1 transition-all ${selectedAvatar === avatarUrl && !uploadPreview
                            ? "ring-4 ring-blue-600 ring-offset-2"
                            : "hover:ring-2 hover:ring-gray-300"
                          }`}
                      >
                        <Avatar className="h-20 w-20">
                          <AvatarImage src={avatarUrl} alt={`Female Avatar ${index + 1}`} />
                          <AvatarFallback>{fallbackInitials}</AvatarFallback>
                        </Avatar>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !selectedAvatar}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Avatar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}