# Classroom Booking Module - Documentation

## Overview
Complete role-based classroom management system for Admin Dashboard with CRUD operations, booking management, and recurring bookings support.

## Route
- **Page Route**: `/dashboard/classrooms`
- **File Location**: `src/app/(dashboard)/dashboard/classrooms/page.tsx`

---

## Role-Based Access Control

### ADMIN Role
**Full Access** - Can manage all aspects across all departments

#### Capabilities:
1. ✅ Create Classroom
2. ✅ Edit Classroom (name, capacity, description)
3. ✅ Enable/Disable Classroom
4. ✅ Delete Classroom
5. ✅ View All Classrooms
6. ✅ View All Bookings (across all users/departments)
7. ✅ Edit Any Booking
8. ✅ Cancel Any Booking
9. ✅ Book Classroom
10. ✅ Create Recurring Bookings
11. ✅ Manage Allotments

#### UI Features:
- "Create Classroom" button in header
- Full classroom table with Edit/Delete actions
- Can see all bookings from all users
- Filter bookings by department/subdepartment
- Edit and cancel any booking

---

### MANAGER Role
**Department-Scoped Access** - Can manage within their department

#### Capabilities:
1. ❌ Create Classroom (Only Admin)
2. ✅ Edit Classroom (name, capacity, description)
3. ✅ Enable/Disable Classroom
4. ❌ Delete Classroom (Only Admin)
5. ✅ View All Classrooms
6. ✅ View Department Bookings (only staff under their dept)
7. ✅ Edit Department Bookings
8. ✅ Cancel Department Bookings
9. ✅ Book Classroom
10. ✅ Create Recurring Bookings
11. ✅ Manage Allotments

#### UI Features:
- No "Create Classroom" button
- Classroom table with Edit action only (no delete)
- Bookings filtered to show only their department staff
- Can edit/cancel bookings from their team

---

### STAFF Role
**Self-Service Only** - Can only manage their own bookings

#### Capabilities:
1. ❌ Create Classroom
2. ❌ Edit Classroom
3. ❌ Enable/Disable Classroom
4. ❌ Delete Classroom
5. ✅ View Available Classrooms
6. ✅ View Own Bookings Only
7. ✅ Edit Own Booking
8. ✅ Cancel Own Booking
9. ✅ Book Classroom
10. ✅ Create Recurring Bookings

#### UI Features:
- No classroom management buttons
- Read-only classroom table with "Book" button
- "My Bookings" tab shows only their bookings
- Can edit/cancel only their own bookings

---

## Component Structure

```
ClassroomPage (page.tsx)
├── HeaderSection
│   ├── Title & Description (role-based)
│   └── Create Classroom Button (Admin only)
│
├── Tabs
│   ├── Classrooms Tab
│   │   └── ClassroomTable
│   │       ├── Search & Filters
│   │       ├── Classroom List
│   │       └── Actions (Edit/Delete/Book/Allot)
│   │
│   ├── Allotments Tab (Admin/Manager only)
│   │   └── AllotmentTable
│   │       ├── Search & Filters
│   │       └── Allotment List
│   │
│   └── Bookings Tab
│       └── BookingTable
│           ├── Search & Filters
│           ├── Booking List (filtered by role)
│           └── Actions (Edit/Cancel)
│
└── Modals
    ├── CreateClassroomModal
    ├── EditClassroomModal
    ├── BookClassroomModal
    ├── EditBookingModal
    └── AllotmentModal
```

---

## Components

### 1. ClassroomTable
**Location**: `src/components/classrooms/classroom-table.tsx`

**Props**:
- `classrooms[]` - Array of classroom objects
- `isLoading` - Loading state
- `userRole` - Current user's role for conditional rendering
- `onEdit` - Edit classroom callback (Admin/Manager)
- `onDelete` - Delete classroom callback (Admin only)
- `onBook` - Book classroom callback (All roles)
- `onAllot` - Allot classroom callback (Admin/Manager)

**Features**:
- Search by classroom name or block
- Status badges (Free/Booked)
- Department display
- Role-based action buttons
- Empty state handling
- Loading skeletons

---

### 2. BookingTable
**Location**: `src/components/classrooms/booking-table.tsx`

**Props**:
- `bookings[]` - Array of booking objects
- `isLoading` - Loading state
- `userRole` - Current user's role
- `onEdit` - Edit booking callback
- `onCancel` - Cancel booking callback

**Features**:
- Search by classroom or user name
- Filter by status (Active/Cancelled/Completed)
- Display booking schedule
- Recurring booking indicator
- Role-based visibility (Staff sees only their bookings)
- Confirmation dialog before cancellation

---

### 3. CreateClassroomModal
**Location**: `src/components/classrooms/create-classroom-modal.tsx`

**Form Fields**:
- `name` (required) - Classroom name
- `capacity` (required) - Max capacity
- `block` (optional) - Building/block location
- `description` (optional) - Additional details

**Validation**:
- Name cannot be empty
- Capacity must be > 0 and <= 1000
- Shows field-level error messages

---

### 4. EditClassroomModal
**Location**: `src/components/classrooms/edit-classroom-modal.tsx`

**Form Fields**:
- `name` - Classroom name
- `capacity` - Max capacity
- `block` - Building/block location
- `description` - Additional details
- `isEnabled` - Enable/disable toggle

**Features**:
- Pre-populated with current classroom data
- Enable/disable classroom availability
- Same validation as create modal

---

### 5. BookClassroomModal
**Location**: `src/components/classrooms/book-classroom-modal.tsx`

**Form Fields**:

**Non-Recurring Booking**:
- `date` - Single date
- `startTime` - Start time
- `endTime` - End time

**Recurring Booking**:
- `isRecurring` - Toggle for recurring
- `dayOfWeek` - Day of week (Monday-Sunday)
- `startDate` - Start date for recurring
- `endDate` - End date for recurring
- `startTime` - Start time
- `endTime` - End time

**Validation**:
- Date/times required
- End time must be after start time
- For recurring: end date must be after start date
- Shows field-level error messages

---

### 6. EditBookingModal
**Location**: `src/components/classrooms/edit-booking-modal.tsx`

**Form Fields**:
- `date` - Booking date
- `startTime` - Start time
- `endTime` - End time

**Features**:
- Pre-populated with current booking data
- Permission check (Staff can only edit their own)
- Warning for recurring bookings
- Admin/Manager notes about reassignment

---

## API Functions

### Location
`src/lib/api.ts`

### classroomApi

```typescript
classroomApi.getAll() // Get all classrooms
classroomApi.getById(id) // Get classroom by ID
classroomApi.create(data) // Create classroom (Admin)
classroomApi.update(id, data) // Update classroom (Admin/Manager)
classroomApi.delete(id) // Delete classroom (Admin)
```

### bookingApi

```typescript
bookingApi.getAll() // Get all bookings (Admin/Manager)
bookingApi.getMyBookings() // Get current user's bookings (Staff)
bookingApi.create(data) // Create booking (All roles)
bookingApi.update(id, data) // Update booking
bookingApi.cancel(id) // Cancel booking
```

### Current State
All API functions use **mock data** for now. Replace with actual backend calls when ready.

---

## State Management

### Main Page State
```typescript
- classrooms: Classroom[] // All classrooms
- bookings: ClassroomBooking[] // All/My bookings (filtered by role)
- allotments: ClassroomAllotment[] // Classroom allotments
- selectedClassroom: Classroom | null // Selected for editing/booking
- selectedBooking: ClassroomBooking | null // Selected for editing
- isLoading: boolean // Loading state for classrooms
- isLoadingBookings: boolean // Loading state for bookings
- [modal]Open: boolean // Modal visibility states
```

---

## TypeScript Types

### Location
`src/types/cir.ts`

### Key Interfaces

```typescript
interface Classroom {
  id: string
  name: string
  capacity: number
  block?: string
  description?: string
  status: 'FREE' | 'ALLOTTED'
  departmentId?: string
  department?: Department
  createdAt: string
  updatedAt: string
}

interface ClassroomBooking {
  id: string
  classroomId: string
  classroom?: Classroom
  userId: string
  user?: Employee
  date?: string // For non-recurring
  startDate?: string // For recurring
  endDate?: string // For recurring
  startTime: string
  endTime: string
  isRecurring: boolean
  dayOfWeek?: DayOfWeek
  status: 'ACTIVE' | 'CANCELLED' | 'COMPLETED'
  createdAt: string
  updatedAt: string
}

interface ClassroomAllotment {
  id: string
  classroomId: string
  classroom?: Classroom
  allottedTo: string // Department/User name
  allottedToId?: string
  date: string
  startTime: string
  endTime: string
  status: 'ACTIVE' | 'CANCELLED' | 'COMPLETED'
  createdAt: string
  updatedAt: string
}

type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'
```

---

## UI Behavior

### Loading States
- Skeleton loaders during API calls
- Disabled buttons while submitting
- "Loading..." text for initial page load

### Success/Error Handling
- Toast notifications for all actions
- Success: Green toast with confirmation
- Error: Red toast with error message
- Form validation errors inline with fields

### Confirmation Dialogs
- Delete classroom confirmation
- Cancel booking confirmation
- Cannot be undone warning messages

### Empty States
- "No classrooms found" with icon
- "No bookings found" with icon
- Helpful messages based on filters

---

## Conditional Rendering Examples

### Create Button (Admin Only)
```tsx
{role === "ADMIN" && (
  <Button onClick={() => setCreateClassroomModalOpen(true)}>
    Create Classroom
  </Button>
)}
```

### Edit Actions (Admin/Manager)
```tsx
{(role === "ADMIN" || role === "MANAGER") && (
  <Button onClick={() => handleEdit(classroom)}>
    Edit
  </Button>
)}
```

### Bookings Tab Label
```tsx
<TabsTrigger value="bookings">
  {role === "STAFF" ? "My Bookings" : "All Bookings"}
</TabsTrigger>
```

---

## Backend Integration Checklist

When connecting to real backend:

### 1. API Endpoints to Create
- [ ] `GET /api/classrooms` - List all classrooms
- [ ] `GET /api/classrooms/:id` - Get classroom details
- [ ] `POST /api/classrooms` - Create classroom
- [ ] `PATCH /api/classrooms/:id` - Update classroom
- [ ] `DELETE /api/classrooms/:id` - Delete classroom
- [ ] `GET /api/classroom-bookings` - List all bookings
- [ ] `GET /api/classroom-bookings/my-bookings` - Get user's bookings
- [ ] `POST /api/classroom-bookings` - Create booking
- [ ] `PATCH /api/classroom-bookings/:id` - Update booking
- [ ] `POST /api/classroom-bookings/:id/cancel` - Cancel booking

### 2. Update API Functions
Replace mock implementations in `src/lib/api.ts`:
```typescript
// Change from:
return Promise.resolve([...mockData])

// To:
return fetchApi('/classrooms')
```

### 3. Add Permission Checks
Backend should validate:
- Admin can create/delete classrooms
- Manager can edit classrooms in their department
- Staff can only edit their own bookings
- Manager can only see their department's bookings

### 4. Add Filtering Support
Backend should support query params:
- Department filter
- SubDepartment filter
- Date range filter
- Status filter

---

## Styling

### Theme
- Uses shadcn/ui components
- Tailwind CSS for styling
- Consistent spacing and colors
- Responsive design

### Professional Look
- Card-based layout
- Clean table designs
- Icon usage for visual clarity
- Badge components for status
- Proper hover states

---

## Testing Checklist

### Admin Testing
- [ ] Can create classroom
- [ ] Can edit any classroom
- [ ] Can delete classroom
- [ ] Can see all bookings
- [ ] Can edit any booking
- [ ] Can cancel any booking

### Manager Testing
- [ ] Cannot create classroom
- [ ] Can edit classroom
- [ ] Cannot delete classroom
- [ ] Sees only department bookings
- [ ] Can edit department bookings

### Staff Testing
- [ ] Cannot create/edit/delete classrooms
- [ ] Can book classroom
- [ ] Can create recurring booking
- [ ] Sees only their bookings
- [ ] Can edit own booking
- [ ] Can cancel own booking

---

## Future Enhancements

### Potential Features
1. Conflict detection (overlapping bookings)
2. Calendar view for bookings
3. Email notifications
4. Bulk booking upload
5. Booking approval workflow
6. Classroom equipment tracking
7. Usage analytics and reports
8. Mobile-responsive improvements
9. Export bookings to CSV/PDF
10. Integration with calendar apps

---

## Support

For issues or questions:
1. Check TypeScript errors in IDE
2. Review browser console for errors
3. Verify role permissions
4. Check API mock data structure
5. Validate form inputs

---

**Last Updated**: February 20, 2026
**Version**: 1.0.0
**Status**: ✅ Complete - Ready for backend integration
