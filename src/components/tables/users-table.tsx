"use client"

import { useState } from "react"
import { Role, Employee } from "@/types/cir"
import { RoleBadge } from "@/components/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Search,
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Eye
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface UsersTableProps {
  users: Employee[]
  onEdit?: (user: Employee) => void
  onDelete?: (user: Employee) => void
  onView?: (user: Employee) => void
  showActions?: boolean
  loading?: boolean
}

export default function UsersTable({
  users,
  onEdit,
  onDelete,
  onView,
  showActions = true,
  loading = false
}: UsersTableProps) {
  const [sortField, setSortField] = useState<keyof Employee>("createdAt")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [filterRole, setFilterRole] = useState<Role | "ALL">("ALL")
  const [searchTerm, setSearchTerm] = useState("")

  const handleSort = (field: keyof Employee) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const filteredAndSortedUsers = users
    .filter(user => {
      const matchesRole = filterRole === "ALL" || user.role === filterRole
      const searchTermLower = searchTerm.toLowerCase()
      const matchesSearch =
        user.name?.toLowerCase().includes(searchTermLower) ||
        user.email?.toLowerCase().includes(searchTermLower) ||
        user.subDepartment?.name?.toLowerCase().includes(searchTermLower)

      return matchesRole && matchesSearch
    })
    .sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]

      // Handle undefined/null values
      if (!aValue && !bValue) return 0
      if (!aValue) return 1
      if (!bValue) return -1

      // Sub-department special handling
      if (sortField === 'subDepartment' as any) {
        const aName = a.subDepartment?.name || ''
        const bName = b.subDepartment?.name || ''
        return sortDirection === 'asc'
          ? aName.localeCompare(bName)
          : bName.localeCompare(aName)
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    })

  const SortIcon = ({ field }: { field: keyof Employee }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />
    return sortDirection === "asc"
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted animate-pulse rounded-md w-full max-w-sm" />
        <div className="rounded-md border">
          <div className="h-[400px] bg-muted/20 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filterRole} onValueChange={(v) => setFilterRole(v as Role | "ALL")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Roles</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="MANAGER">Manager</SelectItem>
              <SelectItem value="STAFF">Staff</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground self-center">
          {filteredAndSortedUsers.length} user{filteredAndSortedUsers.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center font-semibold">
                  Name <SortIcon field="name" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort("email")}
              >
                <div className="flex items-center font-semibold text-primary">
                  Email <SortIcon field="email" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort("role")}
              >
                <div className="flex items-center font-semibold">
                  Role <SortIcon field="role" />
                </div>
              </TableHead>
              <TableHead>
                Sub-Department
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 transition-colors text-right"
                onClick={() => handleSort("createdAt")}
              >
                <div className="flex items-center justify-end font-semibold">
                  Joined <SortIcon field="createdAt" />
                </div>
              </TableHead>
              {showActions && <TableHead className="w-[100px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showActions ? 6 : 5} className="h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs  text-primary">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                      <span>{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell>
                    {user.subDepartment?.name || (
                      <span className="text-muted-foreground italic text-xs">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  {showActions && (
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {onView && (
                          <Button variant="ghost" size="icon" onClick={() => onView(user)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {onEdit && (
                          <Button variant="ghost" size="icon" onClick={() => onEdit(user)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && user.role !== 'ADMIN' && (
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete(user)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
