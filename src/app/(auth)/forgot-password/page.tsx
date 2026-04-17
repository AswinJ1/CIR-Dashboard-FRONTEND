"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowLeft, 
  Mail, 
  KeyRound,
  Shield,
  Clock,
  HelpCircle
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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[60%_40%]">

      {/* LEFT : Illustration */}
      <div className="relative hidden lg:flex items-center justify-center">
        <Image
          src="/amma.jpg"
          alt="Forgot Password"
          fill
          priority
          className="object-cover"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-black/10" />
        <div className="relative z-10 max-w-lg px-12 text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Account Recovery</h2>
              <p className="text-white/70 text-sm">CIR Management System</p>
            </div>
          </div>
          <p className="text-white/80 text-lg leading-relaxed">
            We take your account security seriously. Contact our support team to get your password reset securely.
          </p>
        </div>
      </div>

      {/* RIGHT : Content */}
      <div className="flex items-center justify-center bg-background px-6 sm:px-10">
        <div className="w-full max-w-[420px] space-y-8">

          {/* Logo & Branding */}
          <div className="text-center space-y-3">
            <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center shadow-sm">
              <KeyRound className="h-9 w-9 text-primary" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Forgot Password?</h1>
              <p className="text-muted-foreground text-sm">
                Don't worry — reach out to our support team and we'll help you regain access
              </p>
            </div>
          </div>

          {/* Main Card */}
          <Card className="border border-border/50 shadow-lg shadow-black/5">
            <CardContent className="pt-6 space-y-5">

              {/* Info Steps */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Send a request</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Click the button below to compose a password reset email</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Include your details</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Add your registered email and UID in the email body</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">3</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Get your new password</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Our admin team will reset and share your credentials</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* CTA Button */}
              <a href={generateMailtoLink()} className="block">
                <Button className="w-full gap-2.5 h-11 text-sm font-medium" size="lg">
                  <Mail className="h-4 w-4" />
                  Send Password Reset Request
                </Button>
              </a>

              {/* Support Info */}
              <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Typical response time: within 24 hours</span>
              </div>

            </CardContent>
          </Card>

          {/* Footer Actions */}
          <div className="space-y-3">
            <Link href="/login">
              <Button variant="outline" className="w-full gap-2 h-10">
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </Button>
            </Link>

            <p className="text-center text-xs text-muted-foreground">
              Remember your password?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>

        </div>
      </div>

    </div>
  )
}