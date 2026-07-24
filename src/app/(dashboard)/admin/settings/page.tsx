"use client"

import { useState, useEffect } from "react"
import { Settings, Save, RefreshCw, CalendarDays, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { AppSetting } from "@/types/cir"

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<AppSetting[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)

    // Editable form values keyed by setting key
    const [formValues, setFormValues] = useState<Record<string, string>>({})

    const fetchSettings = async () => {
        setIsLoading(true)
        try {
            const data = await api.settings.getAll()
            setSettings(data)
            const values: Record<string, string> = {}
            for (const s of data) {
                values[s.key] = s.value
            }
            setFormValues(values)
        } catch (error) {
            console.error("Failed to fetch settings:", error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchSettings()
    }, [])

    const handleSave = async () => {
        setIsSaving(true)
        setSaveSuccess(false)
        try {
            for (const setting of settings) {
                const newValue = formValues[setting.key]
                if (newValue !== undefined && newValue !== setting.value) {
                    await api.settings.update(setting.key, newValue)
                }
            }
            await fetchSettings()
            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 3000)
        } catch (error) {
            console.error("Failed to save settings:", error)
            alert("Failed to save settings. Please try again.")
        } finally {
            setIsSaving(false)
        }
    }

    const hasChanges = settings.some(s => formValues[s.key] !== s.value)

    if (isLoading) {
        return (
            <div className="p-6 space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-[300px] w-full max-w-2xl" />
            </div>
        )
    }

    // Get the lookback days setting
    const lookbackSetting = settings.find(s => s.key === 'work_submission_lookback_days')
    const lookbackValue = formValues['work_submission_lookback_days'] ?? '7'

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl tracking-tight flex items-center gap-3">
                        {/* <Settings className="h-7 w-7" /> */}
                        Application Settings
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Configure system-wide settings for work submissions and other features.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchSettings}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="max-w-2xl space-y-6">
                {/* Work Submission Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <CalendarDays className="h-5 w-5" />
                            Work Submission Configuration
                        </CardTitle>
                        <CardDescription>
                            Control how work submissions behave across the system.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Lookback Days */}
                        <div className="space-y-3">
                            <Label htmlFor="lookback-days" className="text-sm font-medium">
                                Submission Lookback Days
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                How many past days staff can submit work for. For example, if set to 7,
                                staff can submit work for the last 7 days including today.
                            </p>
                            <div className="flex items-center gap-3">
                                <Input
                                    id="lookback-days"
                                    type="number"
                                    min={1}
                                    max={90}
                                    value={lookbackValue}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        setFormValues(prev => ({
                                            ...prev,
                                            work_submission_lookback_days: val
                                        }))
                                    }}
                                    className="w-24"
                                />
                                <span className="text-sm text-muted-foreground">days</span>
                            </div>
                            {lookbackSetting && (
                                <p className="text-xs text-muted-foreground">
                                    Current value: {lookbackSetting.value} day{lookbackSetting.value !== '1' ? 's' : ''}
                                </p>
                            )}
                        </div>

                        <Separator />

                        {/* Additional settings can be added here in the future */}
                        <p className="text-xs text-muted-foreground italic">
                            More settings will be available in future updates.
                        </p>
                    </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex items-center gap-3">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || !hasChanges}
                        className="min-w-[120px]"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Save Changes
                            </>
                        )}
                    </Button>
                    {saveSuccess && (
                        <span className="flex items-center gap-1.5 text-sm text-foreground dark:text-green-400 animate-in fade-in">
                            <CheckCircle2 className="h-4 w-4" />
                            Settings saved successfully!
                        </span>
                    )}
                    {!hasChanges && !saveSuccess && (
                        <span className="text-sm text-muted-foreground">
                            No changes to save.
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
