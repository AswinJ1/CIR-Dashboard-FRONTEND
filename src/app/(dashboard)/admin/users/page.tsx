"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { Employee, SubDepartment, Department, Role } from "@/types/cir"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RoleBadge } from "@/components/ui/status-badge"
import { Filter, Download } from "lucide-react"
import { ColumnFilter } from "@/components/ui/column-filter"
import * as XLSX from "xlsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, MoreHorizontal, Eye, Pencil, Trash2, UserPlus, KeyRound } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

export default function AdminUsersPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([])
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  // View dialog state
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null)

  // Reset password dialog state
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)
  const [resetPasswordEmployee, setResetPasswordEmployee] = useState<Employee | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isResettingPassword, setIsResettingPassword] = useState(false)

  //Column filter 
  const [roleFilter, setRoleFilter] = useState<string[]>([])
  const [deptFilter, setDeptFilter] = useState<string[]>([])
  const [subDeptFilter, setSubDeptFilter] = useState<string[]>([])
  // Form state for creating a user
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [formRole, setFormRole] = useState<Role>("STAFF")
  const [formDepartmentId, setFormDepartmentId] = useState("")
  const [formSubDepartmentId, setFormSubDepartmentId] = useState("")

  // Edit form state
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editRole, setEditRole] = useState<Role>("STAFF")
  const [editDepartmentId, setEditDepartmentId] = useState("")
  const [editSubDepartmentId, setEditSubDepartmentId] = useState("")

  // Filter sub-departments based on selected department for create form
  const filteredSubDepartmentsForCreate = useMemo(() => {
    if (!formDepartmentId) return []
    return subDepartments.filter(sd => sd.departmentId === formDepartmentId)
  }, [formDepartmentId, subDepartments])

  // Filter sub-departments based on selected department for edit form
  const filteredSubDepartmentsForEdit = useMemo(() => {
    if (!editDepartmentId) return []
    return subDepartments.filter(sd => sd.departmentId === editDepartmentId)
  }, [editDepartmentId, subDepartments])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [employeesData, deptsData, subDeptsData] = await Promise.all([
        api.employees.getAll(),
        api.departments.getAll(),
        api.subDepartments.getAll(),
      ])

      // Enrich employees with department and subDepartment objects
      const enrichedEmployees = employeesData.map(emp => {
        const department = deptsData.find(d => d.id === emp.departmentId)
        const subDepartment = subDeptsData.find(sd => sd.id === emp.subDepartmentId)
        return {
          ...emp,
          department: department || emp.department,
          subDepartment: subDepartment || emp.subDepartment,
        }
      })

      setEmployees(enrichedEmployees)
      setFilteredEmployees(enrichedEmployees)
      setDepartments(deptsData)
      setSubDepartments(subDeptsData)
    } catch (error) {
      console.error("Failed to fetch data:", error)
      toast.error("Failed to load users")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (searchQuery) {
      const filtered = employees.filter(e =>
        e.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredEmployees(filtered)
    } else {
      setFilteredEmployees(employees)
    }
  }, [searchQuery, employees])

  function resetForm() {
    setFormName("")
    setFormEmail("")
    setFormPassword("")
    setFormRole("STAFF")
    setFormDepartmentId("")
    setFormSubDepartmentId("")
  }

  async function handleCreate() {
    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) {
      toast.error("Please fill in all required fields")
      return
    }

    if (formPassword.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    if (!formDepartmentId) {
      toast.error("Please select a department")
      return
    }

    setIsCreating(true)
    try {
      await api.employees.create({
        name: formName,
        email: formEmail,
        password: formPassword,
        role: formRole,
        departmentId: formDepartmentId,
        subDepartmentId: formSubDepartmentId || undefined,
      })
      toast.success("User created successfully")
      setCreateDialogOpen(false)
      resetForm()
      fetchData()
    } catch (error: any) {
      console.error("Failed to create user:", error)
      toast.error(error.message || "Failed to create user")
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this user?")) return

    try {
      await api.employees.delete(id)
      toast.success("User deleted successfully")
      fetchData()
    } catch (error) {
      console.error("Failed to delete employee:", error)
      toast.error("Failed to delete user")
    }
  }

  // Reset password handlers
  function openResetPasswordDialog(employee: Employee) {
    setResetPasswordEmployee(employee)
    setNewPassword("")
    setConfirmPassword("")
    setResetPasswordDialogOpen(true)
  }

  async function handleResetPassword() {
    if (!resetPasswordEmployee) return

    if (!newPassword.trim()) {
      toast.error("Please enter a new password")
      return
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    setIsResettingPassword(true)
    try {
      await api.employees.resetPassword(resetPasswordEmployee.id, newPassword)
      toast.success(`Password reset successfully for ${resetPasswordEmployee.name}`)
      setResetPasswordDialogOpen(false)
      setResetPasswordEmployee(null)
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      console.error("Failed to reset password:", error)
      toast.error(error.message || "Failed to reset password")
    } finally {
      setIsResettingPassword(false)
    }
  }

  // Edit handlers
  function openEditDialog(employee: Employee) {
    setEditingEmployee(employee)
    setEditName(employee.name)
    setEditEmail(employee.email)
    setEditRole(employee.role)
    setEditDepartmentId(employee.departmentId || "")
    setEditSubDepartmentId(employee.subDepartmentId || "")
    setEditDialogOpen(true)
  }

  async function handleUpdate() {
    if (!editingEmployee) return
    if (!editName.trim() || !editEmail.trim()) {
      toast.error("Name and email are required")
      return
    }

    setIsUpdating(true)
    try {
      await api.employees.update(editingEmployee.id, {
        name: editName,
        email: editEmail,
        role: editRole,
        departmentId: editDepartmentId || undefined,
        subDepartmentId: editSubDepartmentId || undefined,
      })
      toast.success("User updated successfully")
      setEditDialogOpen(false)
      setEditingEmployee(null)
      fetchData()
    } catch (error: any) {
      console.error("Failed to update user:", error)
      toast.error(error.message || "Failed to update user")
    } finally {
      setIsUpdating(false)
    }
  }

useEffect(() => {
  let result = employees

  if (searchQuery) {
    result = result.filter(e =>
      e.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  if (roleFilter.length > 0) {
    result = result.filter(e => roleFilter.includes(e.role))
  }

  if (deptFilter.length > 0) {
    result = result.filter(e => deptFilter.includes(e.department?.name || "N/A"))
  }

  if (subDeptFilter.length > 0) {
    result = result.filter(e => subDeptFilter.includes(e.subDepartment?.name || "N/A"))
  }

  setFilteredEmployees(result)
}, [searchQuery, employees, roleFilter, deptFilter,subDeptFilter])


  // View handler
  function openViewDialog(employee: Employee) {
    setViewingEmployee(employee)
    setViewDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage all users in the system
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new employee to the system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name <span className="text-foreground">*</span></Label>
                <Input
                  placeholder="Enter full name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email <span className="text-foreground">*</span></Label>
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Password <span className="text-foreground">*</span></Label>
                <Input
                  type="password"
                  placeholder="Enter password (min 6 characters)"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role <span className="text-foreground">*</span></Label>
                <Select value={formRole} onValueChange={(v) => setFormRole(v as Role)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department <span className="text-foreground">*</span></Label>
                <Select
                  value={formDepartmentId}
                  onValueChange={(v) => {
                    setFormDepartmentId(v)
                    setFormSubDepartmentId("") // Reset sub-department when department changes
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sub-Department</Label>
                <Select
                  value={formSubDepartmentId || "none"}
                  onValueChange={(v) => setFormSubDepartmentId(v === "none" ? "" : v)}
                  disabled={!formDepartmentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formDepartmentId ? "Select sub-department (optional)" : "Select a department first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No sub-department</SelectItem>
                    {filteredSubDepartmentsForCreate.map((sd) => (
                      <SelectItem key={sd.id} value={sd.id}>
                        {sd.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Users Table */}
    <div>
  <div>
    <h2 className="font-semibold text-lg">All Users</h2>
    <p className="p-1">
      {filteredEmployees.length} user{filteredEmployees.length !== 1 ? 's' : ''} found
    </p>
  </div>
  <div className="">
    {filteredEmployees.length === 0 ? (
      <p className="text-muted-foreground text-center py-8">
        No users found
      </p>
    ) : (
      <Table className="border-2 shadow">
        <TableHeader className="bg-white dark:bg-white dark:text-white">
          <TableRow className="hover:bg-transparent border-b-2 border-border">
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>
              <div className="flex items-center gap-1">
                Role
                <ColumnFilter
                  title="Role"
                  options={["ADMIN", "MANAGER", "STAFF"]}
                  selected={roleFilter}
                  onChange={setRoleFilter}
                />
              </div>
            </TableHead>
            <TableHead>
              <div className="flex items-center gap-1">
                Department
                <ColumnFilter
                  title="Department"
                  options={[...new Set(employees.map(e => e.department?.name || "N/A"))]}
                  selected={deptFilter}
                  onChange={setDeptFilter}
                />
              </div>
            </TableHead>
            <TableHead>
            <div className="flex items-center gap-1">
              Sub-Department
              <ColumnFilter
                title="Sub-Department"
                options={[...new Set(employees.map(e => e.subDepartment?.name || "N/A"))]}
                selected={subDeptFilter}
                onChange={setSubDeptFilter}
              />
            </div>
          </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredEmployees.map((employee) => (
            <TableRow key={employee.id} className="hover:bg-muted/40">
              <TableCell className="font-medium">{employee.name}</TableCell>
              <TableCell>{employee.email}</TableCell>
              <TableCell>{employee.role}</TableCell>
              <TableCell>{employee.department?.name || 'N/A'}</TableCell>
              <TableCell>{employee.subDepartment?.name || 'N/A'}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      onClick={() => router.push(`/admin/departments/subdepartments/staff/${employee.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-2" /> View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEditDialog(employee)}>
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openResetPasswordDialog(employee)}>
                      <KeyRound className="h-4 w-4 mr-2" /> Reset Password
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDelete(employee.id)}
                      className=""
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
  </div>
</div>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name <span className="text-foreground">*</span></Label>
              <Input
                placeholder="Enter full name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email <span className="text-foreground">*</span></Label>
              <Input
                type="email"
                placeholder="Enter email address"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role <span className="text-foreground">*</span></Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="STAFF">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={editDepartmentId || "none"}
                onValueChange={(v) => {
                  setEditDepartmentId(v === "none" ? "" : v)
                  setEditSubDepartmentId("") // Reset sub-department when department changes
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sub-Department</Label>
              <Select
                value={editSubDepartmentId || "none"}
                onValueChange={(v) => setEditSubDepartmentId(v === "none" ? "" : v)}
                disabled={!editDepartmentId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={editDepartmentId ? "Select sub-department (optional)" : "Select a department first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No sub-department</SelectItem>
                  {filteredSubDepartmentsForEdit.map((sd) => (
                    <SelectItem key={sd.id} value={sd.id}>
                      {sd.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View User Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {viewingEmployee && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-semibold text-primary">
                    {viewingEmployee.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{viewingEmployee.name}</h3>
                  <RoleBadge role={viewingEmployee.role} />
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{viewingEmployee.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role</span>
                  <RoleBadge role={viewingEmployee.role} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Department</span>
                  <span className="font-medium">{viewingEmployee.department?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sub-Department</span>
                  <span className="font-medium">{viewingEmployee.subDepartment?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">
                    {viewingEmployee.createdAt ? new Date(viewingEmployee.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setViewDialogOpen(false)
              if (viewingEmployee) openEditDialog(viewingEmployee)
            }}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password for {resetPasswordEmployee?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password <span className="text-foreground">*</span></Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password <span className="text-foreground">*</span></Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={isResettingPassword || !newPassword || !confirmPassword}
            >
              {isResettingPassword ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}