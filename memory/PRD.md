# GovEnforce - UK Council Enforcement Case Management App

## Original Problem Statement
Build an app for an enforcement team in a United Kingdom local government authority council. The team deals with cases such as fly tipping, abandoned vehicles, littering, dog fouling, public spaces protection order enforcement.

## Architecture
- **Frontend**: React with Tailwind CSS, Shadcn UI components, React Leaflet
- **Backend**: FastAPI with MongoDB, httpx for external APIs
- **Authentication**: JWT-based custom auth (no social login)
- **External APIs**: What3Words (optional), OpenStreetMap Nominatim (reverse geocoding)

## User Personas
1. **Officers**: View/update assigned cases, upload evidence, add notes, self-assign, close cases
2. **Supervisors**: Assign/reassign cases, view all cases, close/reopen cases, view FPN reports
3. **Managers/Admin**: Full system access, configuration, user/team management, FPN reports, CSV exports

## What's Been Implemented

### Core Features (Phases 1-3)
- JWT authentication with role-based access
- Case CRUD with workflow (New → Assigned → Investigating → Closed)
- Evidence upload, notes, audit logging
- Public reporting form
- Notifications, Dashboard, Map view
- Teams & team-based visibility
- Multiple case types (Fly Tipping, Abandoned Vehicle, Nuisance Vehicle, Untidy Land, etc.)
- Case closure with mandatory reason/note
- What3Words integration

### Phase 4 - Latest Features
- **Officer "My Cases" Dashboard** - Personalized view for officers
- **Dynamic Branding** - Logo/title from Admin Settings on login page and sidebar
- **Map Defaults from Admin** - Configurable center and zoom
- **Location Auto-fill** - Reverse geocoding from coordinates

- **Fixed Penalty Notice (FPN) Tracking**:
  - "Fixed Penalty Issued" checkbox on all cases
  - "Fixed Penalty" tab with full details:
    - FPN Reference (external paper-based)
    - Date Issued
    - FPN Amount (£)
    - Paid checkbox
    - Date Paid
    - Payment Reference
  - Status summary (Outstanding/Paid)
  - All changes audit logged

- **FPN Reports Page**:
  - Summary statistics:
    - Total FPNs Issued
    - Paid FPNs (count + amount)
    - Outstanding FPNs (count + amount)
    - Payment Rate (%)
  - Financial summary banner
  - Date range filtering
  - **Outstanding FPNs tab**:
    - Sorted by date issued (oldest first)
    - Days outstanding with urgency badges
    - Direct link to case
  - **By Case Type tab**:
    - Breakdown of FPNs by case type
    - Count, paid, payment rate, total amount
  - CSV Export functionality
  - Available to Managers and Supervisors

### Phase 5 - Mobile View & Navigation (Feb 2026)
- **Mobile View Toggle**:
  - Toggle switch in header (desktop view: hidden sm:flex)
  - Toggle in user dropdown for smaller screens
  - Monitor/Smartphone icons with switch
  - State persisted to localStorage
  - Adds/removes `mobile-view` class on body

- **Mobile View Layout**:
  - Sidebar transforms to bottom navigation bar
  - Compact header with logo and branding
  - Touch-friendly form elements (min-height: 44px)
  - Responsive stat cards and tables
  - Compact evidence grid

- **Get Directions Button**:
  - Green button below location map
  - Only visible when case has coordinates
  - Hidden in edit mode
  - Opens Google Maps directions in new tab
  - URL format: `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`

## API Endpoints

### FPN Report Endpoints (NEW)
- `GET /api/stats/fpn` - FPN statistics with date filtering
- `GET /api/stats/fpn/outstanding` - List of outstanding FPNs
- `GET /api/stats/fpn/export-csv` - Export FPN data to CSV

### Other Key Endpoints
- Auth: `/api/auth/login`, `/api/auth/register`, `/api/auth/me`
- Cases: `/api/cases`, `/api/cases/{id}`
- Teams: `/api/teams`
- Settings: `/api/settings`, `/api/settings/public`
- W3W: `/api/w3w/status`, `/api/w3w/convert`
- Geocode: `/api/geocode/reverse`

## Database Schema

### Case (updated)
```
{
  id, reference_number, case_type, status, description, location,
  assigned_to, owning_team, closure_reason, final_note,
  type_specific_fields,
  fpn_issued: boolean,        // NEW
  fpn_details: {              // NEW
    fpn_ref: string,
    date_issued: date,
    fpn_amount: float,
    paid: boolean,
    date_paid: date,
    pay_reference: string
  }
}
```

## Prioritized Backlog

### P0 (Completed)
- ✅ System Configuration & Dynamic Branding
- ✅ Teams & Team-based visibility
- ✅ Case types & custom fields
- ✅ Case closure with mandatory reason
- ✅ W3W integration
- ✅ Officer "My Cases" dashboard
- ✅ Dynamic login page branding
- ✅ Map view admin defaults
- ✅ Location auto-fill
- ✅ Fixed Penalty Notice tracking
- ✅ FPN Reports with statistics & outstanding list
- ✅ Mobile View Toggle (Feb 2026) - Toggle in header and user dropdown, bottom navigation bar in mobile mode
- ✅ Get Directions Button (Feb 2026) - Opens Google Maps with case coordinates from Location tab

### P1 (Next)
- FPN Reporting Enhancements: Aging buckets (0-28 days, 29-56 days, 56+ days)
- Advanced search by case-type fields (vehicle registration)
- Backend mandatory field validation
- FPN payment reminders/notifications

### P2 (Future)
- Advanced reporting dashboard with charts
- GDPR case retention automation
- Email notifications (SendGrid)
- Offline capability
