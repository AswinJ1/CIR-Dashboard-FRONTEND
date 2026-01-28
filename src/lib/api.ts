// CIR API Service Layer
// Centralized API client with JWT handling for NestJS backend integration

import {
    LoginCredentials,
    AuthResponse,
    Employee,
    CreateEmployeeDto,
    UpdateEmployeeDto,
    ChangePasswordDto,
    Department,
    CreateDepartmentDto,
    UpdateDepartmentDto,
    SubDepartment,
    CreateSubDepartmentDto,
    UpdateSubDepartmentDto,
    Responsibility,
    CreateResponsibilityDto,
    UpdateResponsibilityDto,
    Assignment,
    CreateAssignmentDto,
    UpdateAssignmentDto,
    WorkSubmission,
    CreateWorkSubmissionDto,
    UpdateWorkSubmissionDto,
    ResubmitWorkSubmissionDto,
    VerifySubmissionDto,
    Comment,
    CreateCommentDto,
    UpdateCommentDto,
    ApiError,
    ResponsibilityGroup,
    CreateResponsibilityGroupDto,
    UpdateResponsibilityGroupDto,
    AddResponsibilitiesToGroupDto,
    AssignGroupToStaffDto,
    GroupAssignmentResult,
    ResponsibilityGroupAssignment,
} from '@/types/cir'

// API Base URL - configurable via environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

// Token storage (memory-based for security, with localStorage + cookie fallback for persistence)
let accessToken: string | null = null

// Cookie utility functions for middleware access
function setCookie(name: string, value: string, days: number = 7): void {
    if (typeof document === 'undefined') return
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString()
    document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}

function deleteCookie(name: string): void {
    if (typeof document === 'undefined') return
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null
    return null
}

// ==================== Token Management ====================
export const getToken = (): string | null => {
    if (accessToken) return accessToken
    if (typeof window !== 'undefined') {
        // Try localStorage first, then cookie
        accessToken = localStorage.getItem('cir_access_token') || getCookie('cir_access_token')
    }
    return accessToken
}

export const setToken = (token: string): void => {
    accessToken = token
    if (typeof window !== 'undefined') {
        localStorage.setItem('cir_access_token', token)
        // Also set as cookie for middleware access
        setCookie('cir_access_token', token, 7)
    }
}

export const clearToken = (): void => {
    accessToken = null
    if (typeof window !== 'undefined') {
        localStorage.removeItem('cir_access_token')
        deleteCookie('cir_access_token')
    }
}

// ==================== Base Fetch Wrapper ====================
async function fetchApi<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getToken()

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    }

    if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    })

    if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({
            statusCode: response.status,
            message: response.statusText,
        }))

        // Handle 401 Unauthorized - clear token and redirect to login
        if (response.status === 401) {
            clearToken()
            if (typeof window !== 'undefined') {
                window.location.href = '/login'
            }
        }

        throw error
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return undefined as T
    }

    return response.json()
}

// ==================== Auth API ====================
export const authApi = {
    login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
        const response = await fetchApi<AuthResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
        })
        if (response.accessToken) {
            setToken(response.accessToken)
        }
        return response
    },

    logout: (): void => {
        clearToken()
    },
}

// ==================== Employees API ====================
export const employeesApi = {
    create: (data: CreateEmployeeDto): Promise<Employee> =>
        fetchApi('/employees', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getAll: (): Promise<Employee[]> =>
        fetchApi('/employees'),

    getById: (id: string): Promise<Employee> =>
        fetchApi(`/employees/${id}`),

    update: (id: string, data: UpdateEmployeeDto): Promise<Employee> =>
        fetchApi(`/employees/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    delete: (id: string): Promise<void> =>
        fetchApi(`/employees/${id}`, {
            method: 'DELETE',
        }),

    changePassword: (data: ChangePasswordDto): Promise<void> =>
        fetchApi('/employees/change-password', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    resetPassword: (id: string, newPassword: string): Promise<{ message: string }> =>
        fetchApi(`/employees/${id}/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ newPassword }),
        }),
}

// ==================== Departments API ====================
export const departmentsApi = {
    create: (data: CreateDepartmentDto): Promise<Department> =>
        fetchApi('/departments', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getAll: (): Promise<Department[]> =>
        fetchApi('/departments'),

    getById: (id: string): Promise<Department> =>
        fetchApi(`/departments/${id}`),

    update: (id: string, data: UpdateDepartmentDto): Promise<Department> =>
        fetchApi(`/departments/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    delete: (id: string): Promise<void> =>
        fetchApi(`/departments/${id}`, {
            method: 'DELETE',
        }),
}

// ==================== Sub-Departments API ====================
export const subDepartmentsApi = {
    create: (data: CreateSubDepartmentDto): Promise<SubDepartment> =>
        fetchApi('/sub-departments', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getAll: (): Promise<SubDepartment[]> =>
        fetchApi('/sub-departments'),

    getById: (id: string): Promise<SubDepartment> =>
        fetchApi(`/sub-departments/${id}`),

    update: (id: string, data: UpdateSubDepartmentDto): Promise<SubDepartment> =>
        fetchApi(`/sub-departments/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    delete: (id: string): Promise<void> =>
        fetchApi(`/sub-departments/${id}`, {
            method: 'DELETE',
        }),
}

// ==================== Responsibilities API ====================
export const responsibilitiesApi = {
    create: (data: CreateResponsibilityDto): Promise<Responsibility> =>
        fetchApi('/responsibilities', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getAll: (): Promise<Responsibility[]> =>
        fetchApi('/responsibilities'),

    getById: (id: string): Promise<Responsibility> =>
        fetchApi(`/responsibilities/${id}`),

    getEmployees: (id: string): Promise<Employee[]> =>
        fetchApi(`/responsibilities/${id}/employees`),

    update: (id: string, data: UpdateResponsibilityDto): Promise<Responsibility> =>
        fetchApi(`/responsibilities/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    delete: (id: string): Promise<void> =>
        fetchApi(`/responsibilities/${id}`, {
            method: 'DELETE',
        }),

    // Daily workflow endpoints
    getActiveToday: (): Promise<Responsibility[]> =>
        fetchApi('/responsibilities/active/today'),

    getActiveForDate: (date: string): Promise<Responsibility[]> =>
        fetchApi(`/responsibilities/active/${date}`),
}

// ==================== Assignments API ====================
export const assignmentsApi = {
    create: (data: CreateAssignmentDto): Promise<Assignment> =>
        fetchApi('/assignment', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getAll: (): Promise<Assignment[]> =>
        fetchApi('/assignment'),

    getById: (id: string): Promise<Assignment> =>
        fetchApi(`/assignment/${id}`),

    update: (id: string, data: UpdateAssignmentDto): Promise<Assignment> =>
        fetchApi(`/assignment/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    delete: (id: string): Promise<void> =>
        fetchApi(`/assignment/${id}`, {
            method: 'DELETE',
        }),
}

// ==================== Work Submissions API ====================
export const workSubmissionsApi = {
    create: (data: CreateWorkSubmissionDto): Promise<WorkSubmission> =>
        fetchApi('/work-submission', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getAll: (): Promise<WorkSubmission[]> =>
        fetchApi('/work-submission'),

    getById: (id: string): Promise<WorkSubmission> =>
        fetchApi(`/work-submission/${id}`),

    update: (id: string, data: UpdateWorkSubmissionDto): Promise<WorkSubmission> =>
        fetchApi(`/work-submission/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    delete: (id: string): Promise<void> =>
        fetchApi(`/work-submission/${id}`, {
            method: 'DELETE',
        }),

    verify: (id: string, data: VerifySubmissionDto): Promise<WorkSubmission> =>
        fetchApi(`/work-submission/${id}/verify`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    resubmit: (id: string, data: ResubmitWorkSubmissionDto): Promise<WorkSubmission> =>
        fetchApi(`/work-submission/${id}/resubmit`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // Daily workflow endpoints
    getToday: (): Promise<WorkSubmission[]> =>
        fetchApi('/work-submission/today'),

    getByDate: (date: string): Promise<WorkSubmission[]> =>
        fetchApi(`/work-submission/daily/${date}`),

    getDailyHours: (staffId: string, date: string): Promise<{ totalHours: number; verifiedHours: number; pendingHours: number }> =>
        fetchApi(`/work-submission/daily-hours/${staffId}/${date}`),

    getCalendarView: (staffId: string, startDate: string, endDate: string): Promise<{
        date: string;
        submissions: WorkSubmission[];
        totalHours: number;
        verifiedHours: number;
        isLocked: boolean;
    }[]> =>
        fetchApi(`/work-submission/calendar/${staffId}?startDate=${startDate}&endDate=${endDate}`),
}

// ==================== Comments API ====================
export const commentsApi = {
    getBySubmissionId: (submissionId: string): Promise<Comment[]> =>
        fetchApi(`/comments?submissionId=${submissionId}`),

    create: (data: CreateCommentDto): Promise<Comment> =>
        fetchApi('/comments', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getAll: (): Promise<Comment[]> =>
        fetchApi('/comments'),

    getById: (id: string): Promise<Comment> =>
        fetchApi(`/comments/${id}`),

    update: (id: string, data: UpdateCommentDto): Promise<Comment> =>
        fetchApi(`/comments/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    delete: (id: string): Promise<void> =>
        fetchApi(`/comments/${id}`, {
            method: 'DELETE',
        }),
}

// ==================== Responsibility Groups API ====================
export const responsibilityGroupsApi = {
    create: (data: CreateResponsibilityGroupDto): Promise<ResponsibilityGroup> =>
        fetchApi('/responsibility-groups', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getAll: (): Promise<ResponsibilityGroup[]> =>
        fetchApi('/responsibility-groups'),

    getById: (id: string): Promise<ResponsibilityGroup> =>
        fetchApi(`/responsibility-groups/${id}`),

    update: (id: string, data: UpdateResponsibilityGroupDto): Promise<ResponsibilityGroup> =>
        fetchApi(`/responsibility-groups/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    delete: (id: string): Promise<void> =>
        fetchApi(`/responsibility-groups/${id}`, {
            method: 'DELETE',
        }),

    // Add responsibilities to a group
    addResponsibilities: (groupId: string, data: AddResponsibilitiesToGroupDto): Promise<{
        groupId: number
        addedItems: any[]
        totalAdded: number
    }> =>
        fetchApi(`/responsibility-groups/${groupId}/responsibilities`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // Remove a responsibility from a group
    removeResponsibility: (groupId: string, responsibilityId: string): Promise<void> =>
        fetchApi(`/responsibility-groups/${groupId}/responsibilities/${responsibilityId}`, {
            method: 'DELETE',
        }),

    // Assign a group to staff members (creates individual ResponsibilityAssignments)
    assignToStaff: (groupId: string, data: AssignGroupToStaffDto): Promise<GroupAssignmentResult> =>
        fetchApi(`/responsibility-groups/${groupId}/assign`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // Get staff assigned to a group
    getAssignedStaff: (groupId: string): Promise<ResponsibilityGroupAssignment[]> =>
        fetchApi(`/responsibility-groups/${groupId}/staff`),

    // Unassign a group from a staff member
    unassignFromStaff: (groupId: string, staffId: string): Promise<void> =>
        fetchApi(`/responsibility-groups/${groupId}/staff/${staffId}`, {
            method: 'DELETE',
        }),
}

// ==================== Unified API Export ====================
export const api = {
    auth: authApi,
    employees: employeesApi,
    departments: departmentsApi,
    subDepartments: subDepartmentsApi,
    responsibilities: responsibilitiesApi,
    assignments: assignmentsApi,
    workSubmissions: workSubmissionsApi,
    comments: commentsApi,
    responsibilityGroups: responsibilityGroupsApi,
}

export default api
