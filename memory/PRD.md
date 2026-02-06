# GovEnforce - UK Council Enforcement Case Management App

## Original Problem Statement
Build an app for an enforcement team in a United Kingdom local government authority council. The team deals with cases such as fly tipping, abandoned vehicles, littering, dog fouling, public spaces protection order enforcement.

## Architecture
- **Frontend**: React with Tailwind CSS, Shadcn UI components, React Leaflet
- **Backend**: FastAPI with MongoDB, httpx for external APIs
- **Authentication**: JWT-based custom auth (no social login)
- **External APIs**: What3Words (optional, graceful degradation), OpenStreetMap Nominatim (reverse geocoding)

## User Personas
1. **Officers**: View/update assigned cases, upload evidence, add notes, self-assign from unassigned pool, close cases with reason. Dashboard shows "My Cases" only
2. **Supervisors**: Assign/reassign cases, view all cases, close cases, reopen cases
3. **Managers/Admin**: Reporting, configuration, user management, team management, CSV export

## Core Requirements
- Role-based access control (Officer, Supervisor, Manager)
- Team-based case visibility
- Case management with workflow (New → Assigned → Investigating → Closed)
- Evidence upload (photos, documents)
- Case notes and audit timeline
- Public reporting form (no login required)
- In-app notifications
- Map view with location data and admin-configurable defaults
- What3Words integration (optional)
- Fixed Penalty Notice (FPN) tracking
- Basic statistics and CSV export

## What's Been Implemented

### Phase 1-3 (Previous Sessions)
- Complete authentication system with JWT
- Role-based access control
- Case CRUD operations with filtering
- Evidence upload and management
- Case notes functionality
- Audit trail logging
- Public report submission
- Notification system
- Dashboard with statistics
- Map view with Leaflet
- User management (admin)
- CSV export functionality
- Case-type specific custom fields
- Location Tab with interactive map
- System Configuration (Admin Settings)
- Teams & Team-based visibility
- New case types (Untidy Land, High Hedges, Waste Carrier, Nuisance Vehicles, etc.)
- Case closure with mandatory reason/note
- W3W integration (with graceful fallback)

### Phase 4 (2026-02-03)
- **Officer "My Cases" Dashboard**:
  - Officers see only their assigned cases
  - Personalized stats (My Cases, Investigating, Closed by Me, New Assigned)

- **Dynamic Branding**:
  - Sidebar logo/title from Admin Settings
  - Login page shows configured logo, app title, organization name
  - Public settings endpoint (`/api/settings/public`)

- **Map View Admin Defaults**:
  - Uses admin-configured center and zoom
  - No longer defaults to London

- **Location Auto-fill**:
  - Reverse geocoding via OpenStreetMap Nominatim
  - Auto-fills address/postcode when coordinates change
  - "Lookup Address from Coordinates" button

- **Fixed Penalty Notice (FPN) Feature**:
  - "Fixed Penalty Issued" checkbox on all cases
  - When checked, "Fixed Penalty" tab appears
  - FPN Tab includes:
    - FPN Reference (external paper-based ref)
    - Date Issued
    - FPN Amount (£)
    - Paid checkbox
    - Date Paid (shown when paid)
    - Payment Reference
  - Status summary shows Outstanding/Paid with amount
  - All FPN changes audit logged

## Database Schema
- **users**: id, email, name, role, teams[], cross_team_access, is_active
- **cases**: id, reference_number, case_type, status, description, location, assigned_to, owning_team, closure_reason, final_note, type_specific_fields, **fpn_issued**, **fpn_details**
- **teams**: id, name, team_type, description, is_active
- **system_settings**: Singleton document for global configuration
- **audit_logs**: case_id, user_id, action, timestamp, details
- **notes**: case_id, content, created_by
- **evidence**: case_id, filename, file_data, file_type
- **notifications**: user_id, title, message, read

## API Endpoints
- Auth: POST /api/auth/login, /api/auth/register, GET /api/auth/me
- Cases: GET/POST /api/cases, GET/PUT /api/cases/{id}
- Teams: GET/POST /api/teams, PUT/DELETE /api/teams/{id}
- Settings: GET/PUT /api/settings, GET /api/settings/public
- W3W: GET /api/w3w/status, POST /api/w3w/convert
- Geocode: GET /api/geocode/reverse
- Notes: GET/POST /api/cases/{id}/notes
- Evidence: GET/POST /api/cases/{id}/evidence
- Users: GET /api/users, PUT /api/users/{id}
- Reports: GET /api/reports, /api/reports/csv
- Public: POST /api/public/report

## Prioritized Backlog

### P0 (Completed)
- ✅ System Configuration & Dynamic Branding
- ✅ Teams & Team-based visibility
- ✅ New case types
- ✅ Case closure with mandatory reason
- ✅ W3W integration
- ✅ Officer "My Cases" dashboard
- ✅ Login page dynamic branding
- ✅ Map view uses admin defaults
- ✅ Location auto-fill from coordinates
- ✅ Fixed Penalty Notice (FPN) tracking

### P1 (Next)
- Advanced search by case-type specific fields (e.g., vehicle registration)
- Backend mandatory field validation for case creation
- FPN payment reports/statistics

### P2 (Future)
- Advanced reporting dashboard with charts
- GDPR case retention automation
- Email notifications (SendGrid integration)
- Mobile-optimized views
- Offline capability for officers
- FPN payment reminders

## Known Limitations
- W3W API may return 402 (Payment Required) - feature works gracefully when unavailable
- Backend is a monolithic server.py - consider refactoring for larger deployments
