// CIR Work & Responsibility Management System Types

// ==================== Roles & Auth ====================
export type Role = 'ADMIN' | 'MANAGER' | 'STAFF'

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthResponse {
  accessToken: string
  user?: User
}

export interface JWTPayload {
  userId: string
  role: Role
  departmentId?: string
  subDepartmentId?: string
  iat: number
  exp: number
}

// ==================== User / Employee ====================
export interface User {
  id: string
  email: string
  name: string
  role: Role
  subDepartmentId?: string
  departmentId?: string
  createdAt: string
  updatedAt: string
}

export interface Employee {
  id: string
  email: string
  name: string
  role: Role
  departmentId?: string
  department?: Department
  subDepartment?: SubDepartment
  subDepartmentId?: string
  createdAt: string
  updatedAt: string
}

export interface CreateEmployeeDto {
  email: string
  password: string
  name: string
  role: Role
  departmentId?: string
  subDepartmentId?: string
}

export interface UpdateEmployeeDto {
  email?: string
  name?: string
  role?: Role
  departmentId?: string
  subDepartmentId?: string
}

export interface ChangePasswordDto {
  currentPassword: string
  newPassword: string
}

// ==================== Departments ====================
export type DepartmentType = 'TEACHING' | 'NON_TEACHING'

export interface Department {
  id: string
  name: string
  type?: DepartmentType
  description?: string
  subDepartments?: SubDepartment[]
  createdAt: string
  updatedAt: string
}

export interface CreateDepartmentDto {
  name: string
  description?: string
  type?: DepartmentType
}

export interface UpdateDepartmentDto {
  name?: string
  description?: string
  type?: DepartmentType
}

// ==================== Sub-Departments ====================
export type SubDepartmentType = 'QUANTS' | 'VERBALS' | 'SOFTSKILLS' | 'SKILLS' | 'ADMINISTRATION'

export interface SubDepartment {
  id: string
  name: string
  type?: SubDepartmentType
  description?: string
  departmentId: string
  department?: Department
  employees?: Employee[]
  createdAt: string
  updatedAt: string
}

export interface CreateSubDepartmentDto {
  name: string
  description?: string
  departmentId: string
  type?: SubDepartmentType
}

export interface UpdateSubDepartmentDto {
  name?: string
  description?: string
  type?: SubDepartmentType
}

// ==================== Responsibilities ====================
export interface Responsibility {
  id: string
  title: string
  description?: string
  cycle: string // YYYY-MM format
  startDate?: string
  endDate?: string
  subDepartmentId: string
  subDepartment?: SubDepartment
  createdById?: string
  createdBy?: Employee
  isStaffCreated?: boolean
  isActive?: boolean
  createdAt: string
  updatedAt: string
}

// Matches Prisma.ResponsibilityCreateInput structure
export interface CreateResponsibilityDto {
  title: string
  cycle: string // YYYY-MM format - REQUIRED
  createdBy: { connect: { id: number } } // REQUIRED - connect to creator
  subDepartment: { connect: { id: number } } // REQUIRED - connect to sub-department
  description?: string
  startDate?: string // ISO date string
  endDate?: string // ISO date string
  isStaffCreated?: boolean
}

export interface UpdateResponsibilityDto {
  title?: string
  description?: string
  cycle?: string
  startDate?: string
  endDate?: string
}

// ==================== Assignments ====================
export interface Assignment {
  id: string
  responsibilityId: string
  responsibility?: Responsibility
  staffId: string
  staff?: Employee
  status: AssignmentStatus
  dueDate?: string
  assignedAt: string
  updatedAt: string
  workSubmissions?: WorkSubmission[] // One-to-many: daily submissions
}

export type AssignmentStatus = 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED'

export interface CreateAssignmentDto {
  responsibility: { connect: { id: number } }
  staff: { connect: { id: number } }
}

export interface UpdateAssignmentDto {
  status?: AssignmentStatus
}

// ==================== Work Submissions ====================
export interface WorkSubmission {
  id: string
  assignmentId: string
  assignment?: Assignment
  staffId: string
  staff?: Employee
  hoursWorked?: number
  workDate?: string
  workProofType?: 'PDF' | 'IMAGE' | 'TEXT'
  workProofUrl?: string
  workProofText?: string
  staffComment?: string
  managerComment?: string
  status: SubmissionStatus
  submittedAt: string
  verifiedAt?: string
  verifiedById?: string
  verifiedBy?: Employee
  rejectionReason?: string
  comments?: Comment[]
  createdAt: string
  updatedAt: string
}

export type SubmissionStatus = 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED'

// Matches Prisma.WorkSubmissionCreateInput structure
export interface CreateWorkSubmissionDto {
  assignment: { connect: { id: number } }
  staff: { connect: { id: number } }
  hoursWorked: number
  workDate?: string // ISO date string, defaults to today
  workProofType?: 'PDF' | 'IMAGE' | 'TEXT'
  workProofUrl?: string
  workProofText?: string
  staffComment?: string
}

export interface UpdateWorkSubmissionDto {
  content?: string
  attachments?: string[]
}

export interface ResubmitWorkSubmissionDto {
  hoursWorked?: number
  staffComment?: string
  workProofType?: 'PDF' | 'IMAGE' | 'TEXT'
  workProofUrl?: string
  workProofText?: string
}

export interface VerifySubmissionDto {
  approved: boolean
  managerComment?: string
}

// ==================== Daily Work Submission Types ====================
export type DayStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'PARTIAL'

export interface DailyWorkEntry {
  assignmentId: string
  responsibilityId: string
  responsibilityTitle: string
  responsibilityDescription?: string
  isStaffCreated: boolean
  hoursWorked: number
  workDescription: string
  workProofType?: 'TEXT' | 'FILE' | 'URL'
  workProofText?: string
  workProofUrl?: string
  submissionId?: string
  submissionStatus?: SubmissionStatus
  isSubmitted: boolean
  isLocked: boolean
}

export interface DailySubmissionSummary {
  date: string
  status: DayStatus
  totalHours: number
  verifiedHours: number
  pendingHours: number
  rejectedCount: number
  submissions: WorkSubmission[]
  isLocked: boolean
}

export interface CalendarDayData {
  date: string
  status: DayStatus
  totalHours: number
  verifiedHours: number
  isLocked: boolean
  hasSubmissions: boolean
}

export interface CreateDailyWorkSubmissionDto {
  assignmentId: number
  hoursWorked: number
  workProofType?: 'PDF' | 'IMAGE' | 'TEXT'
  workProofUrl?: string
  workProofText?: string
  staffComment?: string
}

export interface CreateStaffResponsibilityDto {
  title: string
  description?: string
}

// ==================== Comments ====================
export interface Comment {
  id: string
  workSubmissionId: string
  employeeId: string
  employee?: Employee
  content: string
  createdAt: string
  updatedAt: string
}

// Matches Prisma.CommentCreateInput structure
export interface CreateCommentDto {
  content: string
  submission: { connect: { id: number } }
  author: { connect: { id: number } }
}

export interface UpdateCommentDto {
  content: string
}

// ==================== API Response Types ====================
export interface ApiError {
  statusCode: number
  message: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// ==================== Responsibility Groups ====================
export interface ResponsibilityGroup {
  id: string
  name: string
  description?: string
  cycle?: string
  isActive: boolean
  subDepartmentId: string
  subDepartment?: SubDepartment
  createdById: string
  createdBy?: Employee
  items?: ResponsibilityGroupItem[]
  groupAssignments?: ResponsibilityGroupAssignment[]
  _count?: {
    items: number
    groupAssignments: number
  }
  createdAt: string
  updatedAt: string
}

export interface ResponsibilityGroupItem {
  id: string
  groupId: string
  group?: ResponsibilityGroup
  responsibilityId: string
  responsibility?: Responsibility
  displayOrder: number
  addedAt: string
}

export interface ResponsibilityGroupAssignment {
  id: string
  groupId: string
  group?: ResponsibilityGroup
  staffId: string
  staff?: Employee
  assignedById: string
  assignedBy?: Employee
  assignedAt: string
}

export interface CreateResponsibilityGroupDto {
  name: string
  description?: string
  cycle?: string
  responsibilityIds?: number[]
  newResponsibilities?: {
    title: string
    description?: string
    cycle: string
    startDate?: string
    endDate?: string
  }[]
}

export interface UpdateResponsibilityGroupDto {
  name?: string
  description?: string
  cycle?: string
  isActive?: boolean
}

export interface AddResponsibilitiesToGroupDto {
  responsibilityIds?: number[]
  newResponsibilities?: {
    title: string
    description?: string
    cycle: string
    startDate?: string
    endDate?: string
  }[]
  displayOrderStart?: number
}

export interface AssignGroupToStaffDto {
  staffIds: number[]
  dueDate?: string
}

export interface GroupAssignmentResult {
  groupId: string
  assignedTo: {
    staffId: number
    staffName: string
    assignmentsCreated: number[]
    skipped: number[]
  }[]
  totalAssignmentsCreated: number
  skippedDuplicates: number
}
