"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type HighlightProps = React.HTMLAttributes<HTMLDivElement> & {
  enabled?: boolean
  hover?: boolean
  controlledItems?: boolean
  mode?: "parent" | "item"
  containerClassName?: string
  forceUpdateBounds?: boolean
  transition?: unknown
}

const Highlight = React.forwardRef<HTMLDivElement, HighlightProps>(
  ({ containerClassName, className, children, ...props }, ref) => {
    const {
      enabled,
      hover,
      controlledItems,
      mode,
      forceUpdateBounds,
      transition,
      ...divProps
    } = props

    return (
      <div ref={ref} className={cn(containerClassName, className)} {...divProps}>
        {children}
      </div>
    )
  }
)
Highlight.displayName = "Highlight"

type HighlightItemProps = React.HTMLAttributes<HTMLDivElement> & {
  activeClassName?: string
}

const HighlightItem = React.forwardRef<HTMLDivElement, HighlightItemProps>(
  ({ className, children, ...props }, ref) => {
    const { activeClassName, ...divProps } = props

    return (
      <div ref={ref} className={className} {...divProps}>
        {children}
      </div>
    )
  }
)
HighlightItem.displayName = "HighlightItem"

export { Highlight, HighlightItem }
