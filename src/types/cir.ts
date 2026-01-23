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
export interface Department {
  id: string
  name: string
  description?: string
  subDepartments?: SubDepartment[]
  createdAt: string
  updatedAt: string
}

export interface CreateDepartmentDto {
  name: string
  description?: string
}

export interface UpdateDepartmentDto {
  name?: string
  description?: string
}

// ==================== Sub-Departments ====================
export interface SubDepartment {
  id: string
  name: string
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
}

export interface UpdateSubDepartmentDto {
  name?: string
  description?: string
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
