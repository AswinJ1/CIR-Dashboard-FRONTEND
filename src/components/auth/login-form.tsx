"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import Image from "next/image"
import { Eye, EyeOff } from "lucide-react"

import { useAuth } from "@/components/providers/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"

/* ---------------- Validation ---------------- */
const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
})

type LoginFormData = z.infer<typeof loginSchema>

/* ---------------- Component ---------------- */
export function LoginForm() {
  const router = useRouter()
  const { login, isLoading: authLoading } = useAuth()

  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError(null)
    try {
      await login(data)
    } catch (err: any) {
      setError(err?.message || "Invalid credentials")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      
      {/* Logo (UNCHANGED) */}
      <div className="mb-10">
        <Image
          src="/logo.png"
          alt="Amrita Logo"
          width={150}
          height={40}
          priority
        />
      </div>

      {/* Heading */}
      <h1 className="text-2xl  text-foreground">
        Login to your CIR Account
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
  Everything you need to manage work, people, and responsibilities in one place.
</p>


      {/* Form */}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-8 space-y-6"
          noValidate
        >
          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <label className="text-sm  text-foreground">
                  Email
                </label>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="mail@abc.com"
                    className="h-11 mt-1 rounded-none"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <label className="text-sm  text-foreground">
                  Password
                </label>
                <FormControl>
                  <div className="relative mt-1">
                    <Input
                      {...field}
                      type={showPassword ? "text" : "password"}
                      className="h-11 pr-10 rounded-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Error */}
          {error && (
            <p className="text-sm text-foreground">{error}</p>
          )}

          {/* Forgot */}
          <div className="text-right text-sm">
            <Link
              href="/forgot-password"
              className="text-[#7A1F5C] hover:underline"
            >
              Forgot Password?
            </Link>
          </div>

          {/* Button */}
          <Button
            type="submit"
            disabled={isLoading || authLoading}
            className="w-full h-11 bg-[#7A1F5C] hover:bg-[#65194B] rounded-none"
          >
            {isLoading || authLoading ? "Logging in..." : "Login"}
          </Button>
        </form>
      </Form>
    </div>
  )
}
