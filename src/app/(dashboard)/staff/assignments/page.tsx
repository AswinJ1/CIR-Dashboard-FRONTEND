"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Calendar, Info } from "lucide-react"

/**
 * This page has been deprecated in favor of the daily work submission workflow.
 * Staff now submit all their work for the current day from the main dashboard.
 */
export default function StaffAssignmentsPage() {
    const router = useRouter()

    useEffect(() => {
        // Redirect to main dashboard after a brief moment
        const timeout = setTimeout(() => {
            router.push('/staff')
        }, 5000)

        return () => clearTimeout(timeout)
    }, [router])
    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl  tracking-tight">Assignments</h1>
                <p className="text-muted-foreground">
                    Work submission workflow has been updated
                </p>
            </div>

            <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                        <Info className="h-5 w-5" />
                        New Daily Work Submission
                    </CardTitle>
                    <CardDescription className="text-blue-600 dark:text-blue-400">
                        We've updated the work submission process to be simpler and more efficient.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium text-blue-800 dark:text-blue-300">Daily Submissions</p>
                                <p className="text-sm text-blue-700 dark:text-blue-400">
                                    Instead of submitting work per assignment, you now submit all your work once per day.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium text-blue-800 dark:text-blue-300">Calendar View</p>
                                <p className="text-sm text-blue-700 dark:text-blue-400">
                                    View your submission history in a convenient calendar format on the dashboard.
                                </p>
                            </div>
                        </div>
                    </div>

                    <Button onClick={() => router.push('/staff')} className="w-full mt-4">
                        Go to Dashboard
                        <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>

                    <p className="text-xs text-center text-blue-600 dark:text-blue-400">
                        You will be redirected automatically in a few seconds...
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
