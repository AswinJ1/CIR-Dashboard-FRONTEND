'use client'

import { ThemeProvider } from 'next-themes'
import { useAuth } from '@/components/providers/auth-context'

export function ThemedProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth()

    // Use a user-scoped localStorage key so each user gets their own theme preference
    const storageKey = user?.id ? `theme-${user.id}` : 'theme'

    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            storageKey={storageKey}
        >
            {children}
        </ThemeProvider>
    )
}
