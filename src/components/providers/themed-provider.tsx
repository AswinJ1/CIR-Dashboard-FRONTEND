'use client'

import { ThemeProvider } from 'next-themes'

export function ThemedProvider({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            storageKey="cir-theme"
        >
            {children}
        </ThemeProvider>
    )
}
