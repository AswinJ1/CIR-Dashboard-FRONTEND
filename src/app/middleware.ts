// middleware.ts - Role-based route protection for CIR Work Management System

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Define role-based route access
const roleAccess: Record<string, string[]> = {
  ADMIN: ["/admin"],
  MANAGER: ["/manager"],
  STAFF: ["/staff"],
}

// Public routes that don't require authentication
const publicRoutes = ["/", "/login", "/forgot-password"]

// Decode JWT payload without verification (verification happens on backend)
function decodeJWTPayload(token: string): { role: string; exp: number } | null {
  try {
    const base64Url = token.split('.')[1]
    if (!base64Url) return null

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8')
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

// Get dashboard URL based on role
function getDashboardUrl(role: string): string {
  switch (role) {
    case "ADMIN":
      return "/admin"
    case "MANAGER":
      return "/manager"
    case "STAFF":
      return "/staff"
    default:
      return "/login"
  }
}

// Check if user has access to the route
function checkRouteAccess(pathname: string, role: string): boolean {
  const allowedRoutes = roleAccess[role]
  if (!allowedRoutes) return false

  return allowedRoutes.some(route => pathname.startsWith(route))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if route is public
  const isPublicRoute = publicRoutes.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  )

  // Get token from localStorage via cookie (we use a cookie for middleware access)
  const token = request.cookies.get('cir_access_token')?.value

  // Also check Authorization header for API routes
  const authHeader = request.headers.get('authorization')
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  const accessToken = token || headerToken

  // Decode token to get role
  const payload = accessToken ? decodeJWTPayload(accessToken) : null
  const isValidToken = payload && payload.exp * 1000 > Date.now()

  // Redirect to login if accessing protected route without valid token
  if (!isPublicRoute && !isValidToken) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If user is logged in and trying to access login page, redirect to dashboard
  if (isValidToken && pathname === "/login") {
    const dashboardUrl = getDashboardUrl(payload.role)
    return NextResponse.redirect(new URL(dashboardUrl, request.url))
  }

  // Check role-based access for protected routes
  if (isValidToken && !isPublicRoute) {
    const userRole = payload.role
    const hasAccess = checkRouteAccess(pathname, userRole)

    if (!hasAccess) {
      // Redirect to appropriate dashboard if user doesn't have access
      const dashboardUrl = getDashboardUrl(userRole)
      return NextResponse.redirect(new URL(dashboardUrl, request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     * - api routes (handled separately)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api).*)",
  ],
}
