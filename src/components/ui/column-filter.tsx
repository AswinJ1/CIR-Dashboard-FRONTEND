// components/ui/column-filter.tsx
"use client"

import { Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

interface ColumnFilterProps {
  title: string
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function ColumnFilter({ title, options, selected, onChange }: ColumnFilterProps) {
  const isActive = selected.length > 0 && selected.length < options.length

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-6 w-6 ml-1 ${isActive ? "text-primary" : "text-muted-foreground"}`}
        >
          <Filter className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Filter {title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={selected.length === 0 || selected.includes(option)}
            onCheckedChange={() => toggle(option)}
          >
            {option}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}