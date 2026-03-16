'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Role, User, JWTPayload, LoginCredentials } from '@/types/cir'
import { authApi, getToken, clearToken } from '@/lib/api'

interface AuthContextType {
    user: User | null
    role: Role | null
    isAuthenticated: boolean
    isLoading: boolean
    login: (credentials: LoginCredentials) => Promise<void>
    logout: () => void
    checkAuth: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Decode JWT without verification (validation happens on backend)
function decodeJWT(token: string | undefined | null): JWTPayload | null {
    if (!token) return null
    try {
        const base64Url = token.split('.')[1]
        if (!base64Url) return null
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        )
        return JSON.parse(jsonPayload)
    } catch {
        return null
    }
}

// Check if token is expired
function isTokenExpired(payload: JWTPayload): boolean {
    const currentTime = Math.floor(Date.now() / 1000)
    return payload.exp < currentTime
}

// Get dashboard URL based on role
export function getDashboardUrl(role: Role): string {
    switch (role) {
        case 'ADMIN':
            return '/admin'
        case 'MANAGER':
            return '/manager'
        case 'STAFF':
            return '/staff'
        default:
            return '/login'
    }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [role, setRole] = useState<Role | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    const checkAuth = useCallback(() => {
        const token = getToken()

        if (!token) {
            setUser(null)
            setRole(null)
            setIsLoading(false)
            return
        }

        const payload = decodeJWT(token)

        if (!payload || isTokenExpired(payload)) {
            clearToken()
            setUser(null)
            setRole(null)
            setIsLoading(false)
            return
        }

        // Set user from JWT payload
        // Note: JWT doesn't include email, so we use placeholder
        // In a real app, you might fetch user details from /auth/me endpoint
        setUser({
            id: payload.userId,
            email: '', // Not available in JWT, could fetch from API
            name: 'User',
            role: payload.role,
            departmentId: payload.departmentId,
            subDepartmentId: payload.subDepartmentId,
            createdAt: '',
            updatedAt: '',
        })
        setRole(payload.role)
        setIsLoading(false)
    }, [])

    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    const login = async (credentials: LoginCredentials) => {
        setIsLoading(true)
        try {
            const response = await authApi.login(credentials)

            // Validate response has accessToken
            if (!response?.accessToken) {
                throw new Error('Invalid login response: missing access token')
            }

            // Decode JWT to get user info (backend only returns accessToken)
            const payload = decodeJWT(response.accessToken)
            if (!payload) {
                throw new Error('Invalid token format')
            }

            setUser({
                id: payload.userId,
                email: credentials.email, // Use credentials since JWT doesn't include email
                name: credentials.email?.split('@')[0] || 'User',
                role: payload.role,
                departmentId: payload.departmentId,
                subDepartmentId: payload.subDepartmentId,
                createdAt: '',
                updatedAt: '',
            })
            setRole(payload.role)

            // Redirect to appropriate dashboard
            router.push(getDashboardUrl(payload.role))
        } finally {
            setIsLoading(false)
        }
    }

    const logout = () => {
        // Clear user-scoped theme key before nulling user
        if (user?.id) {
            try { localStorage.removeItem(`theme-${user.id}`) } catch {}
        }
        // Clear generic theme key and remove dark class
        try {
            localStorage.removeItem('theme')
            document.documentElement.classList.remove('dark')
        } catch {}

        authApi.logout()
        setUser(null)
        setRole(null)
        router.push('/login')
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                role,
                isAuthenticated: !!user,
                isLoading,
                login,
                logout,
                checkAuth,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

// Role check utilities
export function useRole() {
    const { role } = useAuth()

    return {
        role,
        isAdmin: role === 'ADMIN',
        isManager: role === 'MANAGER',
        isStaff: role === 'STAFF',
        canManageUsers: role === 'ADMIN',
        canManageDepartments: role === 'ADMIN',
        canAssignWork: role === 'ADMIN' || role === 'MANAGER',
        canVerifyWork: role === 'MANAGER',
        canSubmitWork: role === 'STAFF',
        canViewAllData: role === 'ADMIN',
        canViewSubDeptData: role === 'ADMIN' || role === 'MANAGER',
    }
}
