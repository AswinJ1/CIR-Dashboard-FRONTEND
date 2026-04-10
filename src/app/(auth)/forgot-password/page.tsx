"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  ArrowLeft, 
  Mail, 
  KeyRound
} from "lucide-react"

export default function ForgotPasswordPage() {
  const supportEmail = "icpc@am.amrita.edu"

  const generateMailtoLink = () => {
    const subject = encodeURIComponent("Password Reset Request")
    const body = encodeURIComponent(
      `Hello,\n\nI would like to request a password reset for my account.\n\nRegistered Email: \nUID: \n\nThank you.`
    )
    return `mailto:${supportEmail}?subject=${subject}&body=${body}`
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
            <KeyRound className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl ">Forgot Password?</CardTitle>
          <CardDescription className="text-base">
            Please click the button below to mail us
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <a href={generateMailtoLink()} className="block">
            <Button className="w-full gap-2" size="lg">
              <Mail className="h-5 w-5" />
              Mail Us
            </Button>
          </a>

          <div className="pt-2">
            <Link href="/login">
              <Button variant="outline" className="w-full gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </Button>
            </Link>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Remember your password?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}