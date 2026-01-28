// app/(auth)/login/page.tsx
import { LoginForm } from "@/components/auth/login-form"
import Image from "next/image"

export default function LoginPage() {
  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full  overflow-hidden">
      {/* Left image (hidden on small screens) */}
      <div className="w-full md:w-1/2 hidden md:inline-block relative">
        <Image
          src="/image.avif"
          className="h-full w-full object-cover"
          alt="Login Background"
          fill
          priority
        />
      </div>

      {/* Right side - Your LoginForm */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center px-4 py-8 md:py-0 ">
        <div className="w-full max-w-md flex flex-col items-center justify-center">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
