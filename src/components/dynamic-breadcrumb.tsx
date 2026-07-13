"use client"

import * as React from "react"
import { Home } from "lucide-react"
import { usePathname } from "next/navigation"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export function DynamicBreadcrumb() {
    const pathname = usePathname()
    
    // Do not show breadcrumbs on root dashboard pages or login
    if (!pathname || pathname === "/admin" || pathname === "/manager" || pathname === "/staff" || pathname === "/login" || pathname === "/") {
        return null
    }

    const segments = pathname.split('/').filter(Boolean)
    
    // Format text nicely: capitalize first letter, handle dashes, identify IDs
    const formatSegment = (segment: string) => {
        // If it looks like a numeric ID, we can format it as "Details" or leave it. 
        // Here we just keep it as is unless it's very long (like a UUID)
        if (segment.length > 25) return "Details"
        
        return segment
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
    }

    return (
        <Breadcrumb className="px-4 py-3 md:px-6 bg-background border-b">
            <BreadcrumbList className="text-sm font-medium">
                <BreadcrumbItem>
                    <BreadcrumbLink href={`/${segments[0]}`} className="flex items-center gap-1.5 hover:text-primary">
                        <Home className="h-4 w-4" />
                    </BreadcrumbLink>
                </BreadcrumbItem>
                {segments.length > 1 && segments.slice(1).map((segment, index) => {
                    const isLast = index === segments.slice(1).length - 1
                    // The actual path for the breadcrumb link
                    const href = `/${segments.slice(0, index + 2).join('/')}`
                    
                    return (
                        <React.Fragment key={href}>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                {isLast ? (
                                    <BreadcrumbPage>{formatSegment(segment)}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink href={href}>{formatSegment(segment)}</BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                        </React.Fragment>
                    )
                })}
            </BreadcrumbList>
        </Breadcrumb>
    )
}
