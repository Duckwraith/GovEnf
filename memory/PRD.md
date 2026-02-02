# GovEnforce - UK Council Enforcement Case Management App

## Original Problem Statement
Build an app for an enforcement team in a United Kingdom local government authority council. The team deals with cases such as fly tipping, abandoned vehicles, littering, dog fouling, public spaces protection order enforcement.

## Architecture
- **Frontend**: React with Tailwind CSS, Shadcn UI components
- **Backend**: FastAPI with MongoDB
- **Authentication**: JWT-based custom auth (no social login)

## User Personas
1. **Officers**: View/update assigned cases, upload evidence, add notes, self-assign from unassigned pool
2. **Supervisors**: Assign/reassign cases, view all cases, close cases
3. **Managers/Admin**: Reporting, configuration, user management, CSV export

## Core Requirements
- Role-based access control (Officer, Supervisor, Manager)
- Case management with workflow (New → Assigned → Investigating → Closed)
- Evidence upload (photos, documents)
- Case notes and audit timeline
- Public reporting form (no login required)
- In-app notifications
- Map view with location data
- Basic statistics and CSV export

## What's Been Implemented
### Phase 1 (2026-02-02)
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
- Default demo users on startup

### Phase 2 (2026-02-02)
- **Case-type specific custom fields**:
  - Fly Tipping: waste description, quantity, type, offender details, vehicle details
  - Abandoned Vehicle: registration, make, model, colour, tax/MOT status, condition
  - Littering: litter type, witnessed, offender description
  - Dog Fouling: occurrence datetime, repeat status, offender/dog description
  - PSPO: breach nature, location, signage, exemptions, officer notes
- Conditional field rendering in all forms
- Details tab in case detail page

## Prioritized Backlog
### P0 (Critical)
- ✅ Authentication & authorization
- ✅ Case management CRUD
- ✅ Evidence upload
- ✅ Public reporting
- ✅ Case-type specific fields

### P1 (High Priority)
- Postcode geocoding for map markers
- Fixed Penalty Notice generation
- Case search by vehicle registration
- Email notifications (optional)

### P2 (Medium Priority)
- Advanced reporting dashboards
- Batch case assignment
- Case templates
- Print-friendly case reports

### P3 (Future Enhancements)
- Mobile app version
- Integration with DVLA for vehicle checks
- PDF export with branding
- Multi-council tenancy

## Demo Credentials
- Manager: admin@council.gov.uk / admin123
- Supervisor: supervisor@council.gov.uk / super123
- Officer: officer@council.gov.uk / officer123
