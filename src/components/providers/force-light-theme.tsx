"use client"

import { useTheme } from "next-themes"
import { useEffect } from "react"

/**
 * Forces light theme on auth pages (login, forgot-password, etc.)
 * so dark mode set by a previous user session doesn't leak into auth UI.
 */
export function ForceLightTheme() {
    const { setTheme, resolvedTheme } = useTheme()

    useEffect(() => {
        if (resolvedTheme !== "light") {
            setTheme("light")
        }
    }, [resolvedTheme, setTheme])

    return null
}
