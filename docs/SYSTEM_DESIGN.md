# IqraaPay - Student Subscription Management System
## Complete System Design Document

---

## 1. Summary

IqraaPay is an admin-only subscription management system for Iqraa Organization to track ~300 students across multiple classes, manage semester-based billing, handle various payment plans (6-month, monthly, scholarship, custom donations), and provide a robust "Due List" workflow for 10 admins + 1 super admin.

### Key Features
- **Semester-based billing**: Course A (Jan 1 → Jul 1) and Course B (Jul 1 → Jan 1)
- **Multiple payment plans**: 6-month, monthly, scholarship/forgiven, custom donation
- **Sibling discounts**: Automatic discount calculation for families
- **Proration**: Daily proration for mid-course enrollments
- **Due List automation**: Auto-refresh based on payment due dates
- **Full audit trail**: Track all admin actions
- **Google Sheets sync**: Initial import + optional ongoing sync

---

## 2. Data Model

### 2.1 Core Entities

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Family      │────<│     Student     │────<│     Payment     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │                        │
                              │                        │
                        ┌─────┴─────┐           ┌──────┴──────┐
                        │Enrollment │           │  AuditLog   │
                        └───────────┘           └─────────────┘
                              │
                        ┌─────┴─────┐
                        │   Admin   │
                        └───────────┘
```

### 2.2 Entity Definitions

#### Family
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| family_name | VARCHAR(100) | Family surname |
| primary_contact_name | VARCHAR(100) | Parent/guardian name |
| primary_phone | VARCHAR(20) | Primary phone number |
| secondary_phone | VARCHAR(20) | Optional secondary phone |
| address | TEXT | Family address |
| notes | TEXT | Admin notes |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |

#### Student
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| family_id | UUID | FK to Family (enables sibling detection) |
| first_name | VARCHAR(50) | Student first name |
| last_name | VARCHAR(50) | Student last name |
| gender | ENUM('male', 'female') | Student gender |
| date_of_birth | DATE | Birth date |
| class_time | VARCHAR(50) | Class schedule (e.g., "Saturday 10AM") |
| class_group | VARCHAR(50) | Class identifier |
| enrollment_date | DATE | When student first enrolled |
| status | ENUM('active', 'paused', 'withdrawn', 'graduated') | Current status |
| payment_plan | ENUM('six_month', 'monthly', 'forgiven', 'custom') | Current plan |
| custom_amount | INTEGER | Amount in IQD (for custom plan) |
| notes | TEXT | Admin notes |
| google_sheet_row_id | VARCHAR(50) | For sync tracking |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |

#### Enrollment (Per-Course Enrollment)
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| student_id | UUID | FK to Student |
| course_code | VARCHAR(10) | e.g., "2026A", "2026B" |
| course_start | DATE | Course start date |
| course_end | DATE | Course end date |
| enrollment_date | DATE | When enrolled this course |
| payment_plan | ENUM | Plan for this course |
| base_amount | INTEGER | Full amount before proration |
| prorated_amount | INTEGER | Actual amount due |
| amount_paid | INTEGER | Total paid so far |
| is_fully_paid | BOOLEAN | Computed: amount_paid >= prorated_amount |
| next_due_date | DATE | When next payment is due |
| status | ENUM('active', 'completed', 'cancelled') | Enrollment status |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |

#### Payment
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| enrollment_id | UUID | FK to Enrollment |
| student_id | UUID | FK to Student |
| amount | INTEGER | Amount in IQD |
| payment_date | DATE | When payment was made |
| payment_method | ENUM('cash', 'bank_transfer', 'other') | Method |
| receipt_number | VARCHAR(50) | Optional receipt reference |
| notes | TEXT | Payment notes |
| recorded_by | UUID | FK to Admin who recorded |
| created_at | TIMESTAMP | Record creation |
| voided | BOOLEAN | If payment was voided |
| voided_by | UUID | FK to Admin who voided |
| voided_at | TIMESTAMP | When voided |
| void_reason | TEXT | Reason for voiding |

#### Admin
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| email | VARCHAR(100) | Login email |
| password_hash | VARCHAR(255) | Bcrypt hash |
| full_name | VARCHAR(100) | Display name |
| role | ENUM('admin', 'super_admin') | Permission level |
| is_active | BOOLEAN | Account status |
| last_login | TIMESTAMP | Last login time |
| created_at | TIMESTAMP | Record creation |
| created_by | UUID | FK to Admin who created |

#### AuditLog
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| admin_id | UUID | FK to Admin |
| action | VARCHAR(50) | Action type |
| entity_type | VARCHAR(50) | What was affected |
| entity_id | UUID | ID of affected entity |
| old_values | JSONB | Previous state |
| new_values | JSONB | New state |
| ip_address | VARCHAR(45) | Admin's IP |
| user_agent | TEXT | Browser info |
| created_at | TIMESTAMP | When action occurred |

---

## 3. Proration Rules & Formulas

### 3.1 Course Dates
```
Course A: January 1 → June 30 (181-182 days depending on leap year)
Course B: July 1 → December 31 (184 days)
```

### 3.2 Base Prices (IQD)
| Plan | Standard | Sibling Discount |
|------|----------|------------------|
| 6-month | 25,000 | 20,000 per student |
| Monthly | 5,000/month | N/A |
| Forgiven | 0 | N/A |
| Custom | Variable | N/A |

### 3.3 Proration Formula

```
PRORATION FORMULA:
==================

daily_rate = base_amount / total_course_days
remaining_days = course_end_date - enrollment_date + 1
prorated_amount = daily_rate × remaining_days

ROUNDING: Round to nearest 500 IQD
  - If remainder >= 250: round up
  - If remainder < 250: round down

round_to_500(amount) = round(amount / 500) × 500
```

### 3.4 Proration Examples

#### Example 1: Standard 6-month, mid-course join
```
Student joins: March 15, 2026
Course A ends: June 30, 2026
Total course days: 181 (Jan 1 - Jun 30, 2026)
Remaining days: 108 (Mar 15 - Jun 30)

daily_rate = 25,000 / 181 = 138.12 IQD/day
prorated = 138.12 × 108 = 14,917 IQD
rounded = 15,000 IQD ✓
```

#### Example 2: Sibling discount (2 siblings), mid-course
```
2 siblings join: March 15, 2026
Course A ends: June 30, 2026
Per-student rate: 20,000 IQD (sibling discount)

daily_rate = 20,000 / 181 = 110.50 IQD/day
prorated_per_student = 110.50 × 108 = 11,934 IQD
rounded = 12,000 IQD per student
total = 24,000 IQD for both ✓
```

#### Example 3: Monthly plan, late join
```
Student joins: March 15, 2026 (monthly plan)
Months remaining: Mar (partial), Apr, May, Jun = ~3.5 months

Method A (Daily proration for first month):
- March: 17/31 days × 5,000 = 2,742 → 2,500 IQD
- Apr-Jun: 3 × 5,000 = 15,000 IQD
- Total: 17,500 IQD

Method B (Simpler - charge full months from enrollment):
- Count from April: 3 full months = 15,000 IQD
- Skip March (joined mid-month)
```

### 3.5 Sibling Detection & Discount Logic

```python
def calculate_sibling_discount(family_id, course_code):
    # Count active siblings in same course
    active_siblings = count_active_students_in_family(family_id, course_code)
    
    if active_siblings >= 2:
        return 20_000  # Discounted rate per student
    else:
        return 25_000  # Standard rate
```

---

## 4. Admin Workflow

### 4.1 Due List Logic

```python
def get_due_list():
    """
    Returns students who have unpaid balances and are due for payment.
    """
    today = date.today()
    
    return Enrollment.query.filter(
        Enrollment.status == 'active',
        Enrollment.is_fully_paid == False,
        Enrollment.next_due_date <= today,
        Student.status == 'active',
        Student.payment_plan != 'forgiven'  # Forgiven never appear
    ).order_by(
        Enrollment.next_due_date.asc()  # Oldest due first
    )
```

### 4.2 Payment Recording Flow

```
1. Admin opens Due List
2. Clicks on student row
3. System shows:
   - Student details
   - Current enrollment
   - Amount due (with breakdown)
   - Payment history
4. Admin clicks "Record Payment"
5. Modal appears:
   - Amount (pre-filled with due amount)
   - Payment date (default: today)
   - Payment method
   - Receipt number (optional)
   - Notes (optional)
6. Admin confirms
7. System:
   - Creates Payment record
   - Updates Enrollment.amount_paid
   - Recalculates is_fully_paid
   - Updates next_due_date (for monthly plans)
   - Logs to AuditLog
   - Student disappears from Due List (if fully paid)
```

### 4.3 Next Due Date Calculation

```python
def calculate_next_due_date(enrollment, payment_date):
    if enrollment.payment_plan == 'six_month':
        # Due at enrollment, then at course end
        if enrollment.is_fully_paid:
            return enrollment.course_end  # No more due
        else:
            return enrollment.enrollment_date  # Due immediately
    
    elif enrollment.payment_plan == 'monthly':
        # Due on 1st of each month
        paid_months = enrollment.amount_paid // 5000
        next_month = enrollment.enrollment_date + months(paid_months)
        return max(next_month.replace(day=1), date.today())
    
    elif enrollment.payment_plan == 'forgiven':
        return None  # Never due
    
    elif enrollment.payment_plan == 'custom':
        if enrollment.is_fully_paid:
            return None
        else:
            return enrollment.enrollment_date  # Due immediately
```

---

## 5. UX Screens

### 5.1 Screen Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN PORTAL                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Due List │  │ Students │  │ Families │  │ Reports/Export   │ │
│  │ (Home)   │  │  List    │  │   List   │  │                  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
│       │             │             │                  │           │
│       ▼             ▼             ▼                  ▼           │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Payment │  │ Student  │  │  Family  │  │ - Revenue Report │  │
│  │  Modal  │  │ Profile  │  │  Detail  │  │ - Due Report     │  │
│  └─────────┘  └──────────┘  └──────────┘  │ - Export CSV     │  │
│                                           └──────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   SUPER ADMIN ONLY                          ││
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ ││
│  │  │ Manage     │  │ Audit Logs │  │ System Settings        │ ││
│  │  │ Admins     │  │            │  │ (Prices, Dates, Sync)  │ ││
│  │  └────────────┘  └────────────┘  └────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Due List Screen (Home)

```
┌─────────────────────────────────────────────────────────────────────┐
│ IQRAAPAY                                    [Ahmed Admin ▼] [Logout]│
├─────────────────────────────────────────────────────────────────────┤
│ 📋 Due List                                          Course: 2026A  │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search name/phone...          [Filters ▼]                    │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ Filters: Class [All ▼] Gender [All ▼] Plan [All ▼] Overdue [All ▼] │
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ #  │ Student Name  │ Class    │ Plan      │ Due    │ Overdue │   │
│ ├───────────────────────────────────────────────────────────────┤   │
│ │ 1  │ Ali Hassan    │ Sat 10AM │ 6-month   │ 25,000 │ 15 days │   │
│ │ 2  │ Fatima Ahmed  │ Sun 2PM  │ Monthly   │  5,000 │ 10 days │   │
│ │ 3  │ Omar Khalid   │ Sat 10AM │ Custom    │ 30,000 │  5 days │   │
│ │ 4  │ Sara Mohammed │ Sun 4PM  │ 6-mo Sib  │ 20,000 │  3 days │   │
│ │ 5  │ Yusuf Ibrahim │ Sat 12PM │ Monthly   │  5,000 │  1 day  │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Showing 5 of 42 students due    [◀ Prev] Page 1 of 9 [Next ▶]     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 Record Payment Modal

```
┌─────────────────────────────────────────────────────┐
│ 💰 Record Payment                              [X]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Student: Ali Hassan                                 │
│ Family: Hassan Family (2 siblings enrolled)         │
│ Course: 2026A                                       │
│ Plan: 6-month (Sibling Discount)                    │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Amount Due:           20,000 IQD                │ │
│ │ Previously Paid:           0 IQD                │ │
│ │ Remaining:            20,000 IQD                │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Payment Amount:    [20,000        ] IQD             │
│ Payment Date:      [2026-01-15    ] 📅              │
│ Payment Method:    [Cash ▼]                         │
│ Receipt #:         [_____________ ] (optional)      │
│ Notes:             [_____________ ] (optional)      │
│                                                     │
│         [Cancel]              [✓ Record Payment]    │
└─────────────────────────────────────────────────────┘
```

### 5.4 Student Profile Screen

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back to List                                                      │
├─────────────────────────────────────────────────────────────────────┤
│ 👤 Ali Hassan                                    [Edit] [Actions ▼] │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐ ┌─────────────────────────────────┐ │
│ │ STUDENT INFO                │ │ FAMILY INFO                     │ │
│ ├─────────────────────────────┤ ├─────────────────────────────────┤ │
│ │ Gender: Male                │ │ Family: Hassan Family           │ │
│ │ Age: 12                     │ │ Contact: Mohammed Hassan        │ │
│ │ Class: Saturday 10:00 AM    │ │ Phone: +964 770 123 4567        │ │
│ │ Enrolled: Jan 5, 2025       │ │ Siblings: Sara Hassan (active)  │ │
│ │ Status: Active              │ │           Omar Hassan (active)  │ │
│ └─────────────────────────────┘ └─────────────────────────────────┘ │
│                                                                     │
│ 📊 CURRENT ENROLLMENT (Course 2026A)                                │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Plan: 6-month (Sibling Discount)                                │ │
│ │ Base Amount: 20,000 IQD    Prorated: 20,000 IQD                 │ │
│ │ Paid: 0 IQD                Remaining: 20,000 IQD                │ │
│ │ Status: ⚠️ UNPAID (Due since: Jan 5, 2026)                      │ │
│ │                                          [Record Payment]       │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ 📜 PAYMENT HISTORY                                                  │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Date       │ Course │ Amount  │ Method │ Recorded By │ Receipt │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ 2025-07-01 │ 2025B  │ 20,000  │ Cash   │ Ahmed       │ R-1234  │ │
│ │ 2025-01-10 │ 2025A  │ 20,000  │ Cash   │ Fatima      │ R-1122  │ │
│ │ 2024-07-05 │ 2024B  │ 25,000  │ Bank   │ Omar        │ T-9988  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Architecture

### 6.1 Recommended Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                         VPS SERVER                               │
│                     (Ubuntu 22.04 LTS)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐│
│  │   NGINX     │────▶│   Next.js   │────▶│    PostgreSQL       ││
│  │  (Reverse   │     │   (App)     │     │    (Database)       ││
│  │   Proxy)    │     │  Port 3000  │     │    Port 5432        ││
│  │  Port 443   │     └─────────────┘     └─────────────────────┘│
│  └─────────────┘            │                     │             │
│        │                    │                     │             │
│        │              ┌─────┴─────┐         ┌─────┴─────┐       │
│        │              │   Prisma  │         │  Backups  │       │
│        │              │   (ORM)   │         │  (Daily)  │       │
│   SSL/TLS             └───────────┘         └───────────┘       │
│   (Let's Encrypt)                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
         │
         │ (Optional Sync)
         ▼
┌─────────────────┐
│  Google Sheets  │
│  (Data Source)  │
└─────────────────┘
```

### 6.2 Technology Choices

| Component | Choice | Reason |
|-----------|--------|--------|
| **Backend/Frontend** | Next.js 14 (App Router) | Full-stack, SSR, API routes, TypeScript |
| **Database** | PostgreSQL 15 | Robust, JSONB for audit logs, reliable |
| **ORM** | Prisma | Type-safe, migrations, great DX |
| **Auth** | NextAuth.js | Session-based, secure, easy setup |
| **UI** | Tailwind CSS + shadcn/ui | Fast development, professional look |
| **Deployment** | Docker + Docker Compose | Easy deployment, reproducible |
| **Reverse Proxy** | Nginx | SSL termination, caching |
| **Backup** | pg_dump + cron | Daily automated backups |

### 6.3 Google Sheets Integration

**Recommended Approach: One-time import + app as source of truth**

```
PHASE 1: Import
- Export Google Sheet as CSV
- Run import script to seed database
- Validate data integrity

PHASE 2: Optional Bidirectional Sync
- Use Google Sheets API with Service Account
- Scheduled sync job (every 15 min or on-demand)
- Conflict resolution: App data wins
- Sheet becomes read-only reference

WHY APP AS SOURCE OF TRUTH:
- Multi-admin safety (DB transactions)
- Audit trails
- Complex business logic
- Faster queries
- No API rate limits
```

### 6.4 Security Measures

1. **Authentication**: Session-based with secure cookies
2. **Authorization**: Role-based (admin vs super_admin)
3. **HTTPS**: Let's Encrypt SSL certificates
4. **Database**: Password-protected, not exposed publicly
5. **Input validation**: Zod schemas on all inputs
6. **CSRF protection**: Built into NextAuth
7. **Rate limiting**: Nginx level
8. **Audit logging**: All mutations logged

---

## 7. API Endpoints & Pseudocode

### 7.1 Core API Endpoints

```
AUTHENTICATION
POST   /api/auth/login          - Admin login
POST   /api/auth/logout         - Admin logout
GET    /api/auth/me             - Get current admin

STUDENTS
GET    /api/students            - List students (with filters)
GET    /api/students/:id        - Get student details
POST   /api/students            - Create student
PUT    /api/students/:id        - Update student
DELETE /api/students/:id        - Soft delete student

FAMILIES
GET    /api/families            - List families
GET    /api/families/:id        - Get family with members
POST   /api/families            - Create family
PUT    /api/families/:id        - Update family

ENROLLMENTS
GET    /api/enrollments         - List enrollments
POST   /api/enrollments         - Create enrollment (with proration)
PUT    /api/enrollments/:id     - Update enrollment
GET    /api/enrollments/due     - Get due list

PAYMENTS
GET    /api/payments            - List payments (with filters)
POST   /api/payments            - Record payment
PUT    /api/payments/:id/void   - Void payment (super admin)

ADMIN (Super Admin only)
GET    /api/admins              - List admins
POST   /api/admins              - Create admin
PUT    /api/admins/:id          - Update admin
DELETE /api/admins/:id          - Deactivate admin
GET    /api/audit-logs          - View audit logs

REPORTS
GET    /api/reports/revenue     - Revenue summary
GET    /api/reports/due         - Due summary
GET    /api/reports/export      - Export CSV
```

### 7.2 Core Business Logic Pseudocode

```typescript
// ============================================
// CALCULATE AMOUNT DUE
// ============================================
function calculateAmountDue(
  student: Student,
  courseCode: string,
  enrollmentDate: Date
): CalculationResult {
  const course = getCourse(courseCode);
  const totalDays = daysBetween(course.startDate, course.endDate);
  const remainingDays = daysBetween(enrollmentDate, course.endDate);
  
  // Determine base amount based on plan
  let baseAmount: number;
  
  switch (student.paymentPlan) {
    case 'six_month':
      // Check for siblings
      const siblingCount = countActiveSiblingsInCourse(
        student.familyId, 
        courseCode
      );
      baseAmount = siblingCount >= 2 ? 20_000 : 25_000;
      break;
      
    case 'monthly':
      const monthsRemaining = Math.ceil(remainingDays / 30);
      baseAmount = 5_000 * monthsRemaining;
      // No proration needed - already per-month
      return {
        baseAmount,
        proratedAmount: baseAmount,
        dailyRate: null,
        totalDays,
        remainingDays,
        monthsCharged: monthsRemaining
      };
      
    case 'forgiven':
      return {
        baseAmount: 0,
        proratedAmount: 0,
        dailyRate: 0,
        totalDays,
        remainingDays
      };
      
    case 'custom':
      baseAmount = student.customAmount;
      break;
  }
  
  // Calculate proration for 6-month and custom plans
  const dailyRate = baseAmount / totalDays;
  const proratedRaw = dailyRate * remainingDays;
  const proratedAmount = roundToNearest500(proratedRaw);
  
  return {
    baseAmount,
    proratedAmount,
    dailyRate,
    totalDays,
    remainingDays
  };
}

// ============================================
// ROUND TO NEAREST 500 IQD
// ============================================
function roundToNearest500(amount: number): number {
  return Math.round(amount / 500) * 500;
}

// ============================================
// GET DUE LIST
// ============================================
function getDueList(filters: DueListFilters): DueListItem[] {
  const today = new Date();
  const currentCourse = getCurrentCourse(today);
  
  return db.enrollment
    .findMany({
      where: {
        courseCode: currentCourse.code,
        status: 'active',
        student: {
          status: 'active',
          paymentPlan: { not: 'forgiven' }
        },
        OR: [
          { isFullyPaid: false, nextDueDate: { lte: today } },
          // Monthly: check if new month started
          { 
            student: { paymentPlan: 'monthly' },
            // Amount paid < expected for months elapsed
          }
        ]
      },
      include: {
        student: { include: { family: true } },
        payments: true
      },
      orderBy: { nextDueDate: 'asc' }
    })
    .map(enrollment => ({
      ...enrollment,
      overdueDays: daysBetween(enrollment.nextDueDate, today),
      amountDue: enrollment.proratedAmount - enrollment.amountPaid
    }));
}

// ============================================
// RECORD PAYMENT
// ============================================
async function recordPayment(
  enrollmentId: string,
  amount: number,
  paymentDate: Date,
  method: PaymentMethod,
  adminId: string,
  receiptNumber?: string,
  notes?: string
): Promise<Payment> {
  return db.$transaction(async (tx) => {
    // Get enrollment
    const enrollment = await tx.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { student: true }
    });
    
    if (!enrollment) throw new Error('Enrollment not found');
    
    // Create payment record
    const payment = await tx.payment.create({
      data: {
        enrollmentId,
        studentId: enrollment.studentId,
        amount,
        paymentDate,
        paymentMethod: method,
        receiptNumber,
        notes,
        recordedBy: adminId
      }
    });
    
    // Update enrollment
    const newAmountPaid = enrollment.amountPaid + amount;
    const isFullyPaid = newAmountPaid >= enrollment.proratedAmount;
    const nextDueDate = calculateNextDueDate(enrollment, newAmountPaid);
    
    await tx.enrollment.update({
      where: { id: enrollmentId },
      data: {
        amountPaid: newAmountPaid,
        isFullyPaid,
        nextDueDate
      }
    });
    
    // Create audit log
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'PAYMENT_RECORDED',
        entityType: 'payment',
        entityId: payment.id,
        newValues: { amount, method, enrollmentId }
      }
    });
    
    return payment;
  });
}

// ============================================
// HANDLE PLAN SWITCH MID-COURSE
// ============================================
async function switchPlan(
  enrollmentId: string,
  newPlan: PaymentPlan,
  customAmount: number | null,
  adminId: string
): Promise<Enrollment> {
  return db.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { student: true }
    });
    
    // Calculate new prorated amount from today
    const today = new Date();
    const remainingDays = daysBetween(today, enrollment.courseEnd);
    
    let newProratedAmount: number;
    if (newPlan === 'forgiven') {
      newProratedAmount = 0;
    } else if (newPlan === 'custom') {
      newProratedAmount = calculateProratedCustom(customAmount, enrollment, today);
    } else {
      newProratedAmount = calculateAmountDue(
        { ...enrollment.student, paymentPlan: newPlan },
        enrollment.courseCode,
        today
      ).proratedAmount;
    }
    
    // Credit already paid amount
    const remainingDue = Math.max(0, newProratedAmount - enrollment.amountPaid);
    
    // Update enrollment
    const updated = await tx.enrollment.update({
      where: { id: enrollmentId },
      data: {
        paymentPlan: newPlan,
        proratedAmount: newProratedAmount,
        isFullyPaid: remainingDue <= 0,
        nextDueDate: remainingDue > 0 ? today : null
      }
    });
    
    // Update student's current plan
    await tx.student.update({
      where: { id: enrollment.studentId },
      data: { 
        paymentPlan: newPlan,
        customAmount: newPlan === 'custom' ? customAmount : null
      }
    });
    
    // Audit log
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'PLAN_SWITCHED',
        entityType: 'enrollment',
        entityId: enrollmentId,
        oldValues: { plan: enrollment.paymentPlan },
        newValues: { plan: newPlan, newAmount: newProratedAmount }
      }
    });
    
    return updated;
  });
}
```

---

## 8. Implementation Plan

### Phase 1: Foundation (Week 1)
- [ ] Set up Next.js project with TypeScript
- [ ] Configure Prisma with PostgreSQL
- [ ] Create database schema and migrations
- [ ] Implement authentication (NextAuth.js)
- [ ] Create base UI layout with Tailwind/shadcn

### Phase 2: Core Features (Week 2)
- [ ] Build student CRUD operations
- [ ] Build family management
- [ ] Implement enrollment system
- [ ] Create proration calculation engine
- [ ] Build payment recording system

### Phase 3: Due List & Workflow (Week 3)
- [ ] Implement due list with filters
- [ ] Build payment modal
- [ ] Create student profile page
- [ ] Implement search functionality
- [ ] Add bulk operations

### Phase 4: Admin & Reporting (Week 4)
- [ ] Super admin panel
- [ ] Admin management
- [ ] Audit log viewer
- [ ] Reports (revenue, due summary)
- [ ] CSV export

### Phase 5: Polish & Deploy (Week 5)
- [ ] Google Sheets import script
- [ ] Docker containerization
- [ ] Nginx configuration
- [ ] SSL setup
- [ ] Backup automation
- [ ] Testing & bug fixes

### Phase 6: Go Live
- [ ] Import production data
- [ ] Admin training
- [ ] Monitor and iterate

---

## 9. Google Sheets Column Layout

If keeping Sheets as reference:

| Column | Field | Notes |
|--------|-------|-------|
| A | student_id | Generated UUID |
| B | first_name | Required |
| C | last_name | Required |
| D | gender | male/female |
| E | date_of_birth | YYYY-MM-DD |
| F | family_id | Links siblings |
| G | family_name | Family surname |
| H | parent_name | Primary contact |
| I | phone_primary | With country code |
| J | phone_secondary | Optional |
| K | class_time | e.g., "Sat 10AM" |
| L | class_group | e.g., "Boys-A" |
| M | status | active/paused/withdrawn |
| N | payment_plan | six_month/monthly/forgiven/custom |
| O | custom_amount | Only if plan=custom |
| P | enrollment_date | When first joined |
| Q | last_synced | Timestamp |
| R | notes | Admin notes |

---

## 10. Edge Cases Handled

| Scenario | Resolution |
|----------|------------|
| Student switches plan mid-course | Recalculate from switch date, credit previous payments |
| Donation exceeds expected | Record full amount, mark as fully paid, log excess |
| Forgiven students | Never appear in due list, marked paid automatically |
| Student pauses | Set status='paused', stop appearing in due list |
| Student rejoins | Create new enrollment for current course |
| Duplicate names | Use full name + family + class to distinguish |
| Multiple payments in advance | Payments credited to current enrollment, overflow to notes |
| Sibling enrolls/withdraws | Recalculate discount for remaining siblings (future enrollments only) |
| Refunds | Super admin can void payment with reason |
| Course transition | Batch job to create new enrollments at course start |

---

*Document Version: 1.0*
*Last Updated: January 2026*
