import { ForceLightTheme } from "@/components/providers/force-light-theme"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <ForceLightTheme />
      {children}
    </div>
  )
}