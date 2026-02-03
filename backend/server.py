from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import base64
import aiofiles
import httpx
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'govenforce-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# What3Words API Settings
W3W_API_KEY = os.environ.get('W3W_API_KEY', 'INO2TWLZ')
W3W_API_URL = "https://api.what3words.com/v3"

# Create the main app
app = FastAPI(title="GovEnforce API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# Enums
class UserRole(str, Enum):
    OFFICER = "officer"
    SUPERVISOR = "supervisor"
    MANAGER = "manager"

class TeamType(str, Enum):
    ENFORCEMENT = "enforcement"
    ENVIRONMENTAL_CRIMES = "environmental_crimes"
    WASTE_MANAGEMENT = "waste_management"

class CaseType(str, Enum):
    # Fly-tipping variants
    FLY_TIPPING = "fly_tipping"
    FLY_TIPPING_PRIVATE = "fly_tipping_private"
    FLY_TIPPING_ORGANISED = "fly_tipping_organised"
    # Vehicle related
    ABANDONED_VEHICLE = "abandoned_vehicle"
    NUISANCE_VEHICLE = "nuisance_vehicle"
    NUISANCE_VEHICLE_SELLER = "nuisance_vehicle_seller"
    NUISANCE_VEHICLE_PARKING = "nuisance_vehicle_parking"
    NUISANCE_VEHICLE_ASB = "nuisance_vehicle_asb"
    # General enforcement
    LITTERING = "littering"
    DOG_FOULING = "dog_fouling"
    PSPO_DOG_CONTROL = "pspo_dog_control"
    UNTIDY_LAND = "untidy_land"
    HIGH_HEDGES = "high_hedges"
    WASTE_CARRIER_LICENSING = "waste_carrier_licensing"
    # Environmental crimes
    COMPLEX_ENVIRONMENTAL = "complex_environmental"

# Case type to team visibility mapping - defines which teams can VIEW each case type
CASE_TYPE_VISIBILITY = {
    # Waste Management can only see general fly-tipping
    CaseType.FLY_TIPPING: [TeamType.WASTE_MANAGEMENT, TeamType.ENFORCEMENT, TeamType.ENVIRONMENTAL_CRIMES],
    # Enforcement handles private land and most case types
    CaseType.FLY_TIPPING_PRIVATE: [TeamType.ENFORCEMENT, TeamType.ENVIRONMENTAL_CRIMES],
    CaseType.FLY_TIPPING_ORGANISED: [TeamType.ENFORCEMENT, TeamType.ENVIRONMENTAL_CRIMES],
    CaseType.ABANDONED_VEHICLE: [TeamType.ENFORCEMENT],
    CaseType.NUISANCE_VEHICLE: [TeamType.ENFORCEMENT],
    CaseType.NUISANCE_VEHICLE_SELLER: [TeamType.ENFORCEMENT],
    CaseType.NUISANCE_VEHICLE_PARKING: [TeamType.ENFORCEMENT],
    CaseType.NUISANCE_VEHICLE_ASB: [TeamType.ENFORCEMENT],
    CaseType.LITTERING: [TeamType.ENFORCEMENT],
    CaseType.DOG_FOULING: [TeamType.ENFORCEMENT],
    CaseType.PSPO_DOG_CONTROL: [TeamType.ENFORCEMENT],
    CaseType.UNTIDY_LAND: [TeamType.ENFORCEMENT],
    CaseType.HIGH_HEDGES: [TeamType.ENFORCEMENT],
    CaseType.WASTE_CARRIER_LICENSING: [TeamType.ENFORCEMENT],
    # Environmental crimes has full visibility
    CaseType.COMPLEX_ENVIRONMENTAL: [TeamType.ENVIRONMENTAL_CRIMES],
}

# For backward compatibility - teams that can be assigned cases
CASE_TYPE_TEAMS = CASE_TYPE_VISIBILITY
}

class CaseStatus(str, Enum):
    NEW = "new"
    ASSIGNED = "assigned"
    INVESTIGATING = "investigating"
    CLOSED = "closed"

class WasteType(str, Enum):
    HOUSEHOLD = "household"
    COMMERCIAL = "commercial"
    CONSTRUCTION = "construction"
    MIXED = "mixed"
    UNKNOWN = "unknown"

class TaxMOTStatus(str, Enum):
    VALID = "valid"
    TAXED = "taxed"
    UNTAXED = "untaxed"
    EXPIRED = "expired"
    UNKNOWN = "unknown"

class VehicleCondition(str, Enum):
    GOOD = "good"
    DAMAGED = "damaged"
    VANDALISED = "vandalised"
    BURNT_OUT = "burnt_out"
    UNKNOWN = "unknown"

class LitterType(str, Enum):
    CIGARETTE_END = "cigarette_end"
    FOOD_PACKAGING = "food_packaging"
    GENERAL_WASTE = "general_waste"
    OTHER = "other"

class PSPOBreachType(str, Enum):
    DOGS_OFF_LEAD = "dogs_off_lead"
    DOG_EXCLUSION_ZONE = "dog_exclusion_zone"
    FAILURE_TO_PICK_UP = "failure_to_pick_up"
    EXCEEDING_DOG_LIMIT = "exceeding_dog_limit"
    OTHER = "other"

class YesNoUnknown(str, Enum):
    YES = "yes"
    NO = "no"
    UNKNOWN = "unknown"

class ReportingSource(str, Enum):
    PUBLIC = "public"
    OFFICER = "officer"
    OTHER = "other"

# Case-Type Specific Field Models
class VehicleDetails(BaseModel):
    registration_number: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    colour: Optional[str] = None

class FlyTippingDetails(BaseModel):
    waste_description: Optional[str] = None
    estimated_quantity: Optional[str] = None
    waste_type: Optional[WasteType] = None
    offender_witnessed: Optional[bool] = None
    offender_description: Optional[str] = None
    vehicle_details: Optional[VehicleDetails] = None
    identifying_evidence: Optional[str] = None
    no_evidence_available: Optional[bool] = None  # Checkbox for no evidence

class AbandonedVehicleDetails(BaseModel):
    registration_number: Optional[str] = None
    registration_not_visible: Optional[bool] = None  # Checkbox when reg not visible
    make: Optional[str] = None
    model: Optional[str] = None
    colour: Optional[str] = None
    tax_status: Optional[TaxMOTStatus] = None
    mot_status: Optional[TaxMOTStatus] = None
    condition: Optional[VehicleCondition] = None
    estimated_time_at_location: Optional[str] = None
    causing_obstruction: Optional[bool] = None

class LitteringDetails(BaseModel):
    litter_type: Optional[LitterType] = None
    offence_witnessed: Optional[bool] = None
    offender_description: Optional[str] = None
    supporting_evidence: Optional[str] = None

class DogFoulingDetails(BaseModel):
    occurrence_datetime: Optional[str] = None
    repeat_occurrence: Optional[YesNoUnknown] = None
    offender_description: Optional[str] = None
    dog_description: Optional[str] = None
    additional_info: Optional[str] = None

class PSPODetails(BaseModel):
    breach_nature: Optional[PSPOBreachType] = None
    location_within_area: Optional[str] = None
    signage_present: Optional[YesNoUnknown] = None
    exemptions_claimed: Optional[str] = None
    officer_notes: Optional[str] = None

# New case type specific fields
class UntidyLandDetails(BaseModel):
    land_type: Optional[str] = None  # residential, commercial, public
    land_ownership: Optional[str] = None
    issues_identified: Optional[List[str]] = None  # overgrown, debris, waste, etc.
    previous_notices: Optional[bool] = None
    notice_date: Optional[str] = None
    compliance_deadline: Optional[str] = None
    additional_notes: Optional[str] = None

class HighHedgesDetails(BaseModel):
    hedge_type: Optional[str] = None
    hedge_height_meters: Optional[float] = None
    complainant_details: Optional[str] = None
    affected_property: Optional[str] = None
    hedge_owner_details: Optional[str] = None
    previous_complaints: Optional[bool] = None
    mediation_attempted: Optional[bool] = None
    additional_notes: Optional[str] = None

class WasteCarrierDetails(BaseModel):
    business_name: Optional[str] = None
    carrier_license_number: Optional[str] = None
    license_status: Optional[str] = None  # valid, expired, none
    vehicle_registration: Optional[str] = None
    waste_types_carried: Optional[List[str]] = None
    breach_details: Optional[str] = None
    evidence_collected: Optional[str] = None

class NuisanceVehicleDetails(BaseModel):
    vehicle_registration: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_colour: Optional[str] = None
    nuisance_type: Optional[str] = None  # on_street_seller, parking, asb
    location_frequency: Optional[str] = None  # daily, weekly, occasional
    business_activity: Optional[str] = None  # if on_street_seller
    obstruction_caused: Optional[bool] = None
    previous_warnings: Optional[int] = None
    additional_notes: Optional[str] = None

# Waste Management clearance outcome (for fly-tipping cases)
class ClearanceOutcome(BaseModel):
    items_cleared: Optional[bool] = None  # Yes/No mandatory for WM
    reason_not_cleared: Optional[str] = None  # Mandatory if items_cleared = False
    clearance_date: Optional[str] = None
    cleared_by: Optional[str] = None
    disposal_method: Optional[str] = None

# Case closure details
class CaseClosureDetails(BaseModel):
    closure_reason: str
    final_note: str
    closed_by: Optional[str] = None
    closed_at: Optional[str] = None

class CaseTypeSpecificFields(BaseModel):
    fly_tipping: Optional[FlyTippingDetails] = None
    abandoned_vehicle: Optional[AbandonedVehicleDetails] = None
    littering: Optional[LitteringDetails] = None
    dog_fouling: Optional[DogFoulingDetails] = None
    pspo_dog_control: Optional[PSPODetails] = None
    untidy_land: Optional[UntidyLandDetails] = None
    high_hedges: Optional[HighHedgesDetails] = None
    waste_carrier: Optional[WasteCarrierDetails] = None
    nuisance_vehicle: Optional[NuisanceVehicleDetails] = None
    clearance_outcome: Optional[ClearanceOutcome] = None  # For WM fly-tipping

# Pydantic Models

# System Settings Model
class MapSettings(BaseModel):
    default_latitude: float = 51.5074
    default_longitude: float = -0.1278
    default_zoom: int = 12

class SystemSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "system_settings"  # Singleton
    app_title: str = "GovEnforce"
    organisation_name: str = "Local Council"
    organisation_address: str = ""
    contact_email: str = ""
    logo_base64: Optional[str] = None
    map_settings: MapSettings = Field(default_factory=MapSettings)
    # Optional settings
    case_retention_days: int = 2555  # ~7 years for GDPR
    default_working_area_postcode: str = ""
    enable_what3words: bool = True
    enable_public_reporting: bool = True
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

class SystemSettingsUpdate(BaseModel):
    app_title: Optional[str] = None
    organisation_name: Optional[str] = None
    organisation_address: Optional[str] = None
    contact_email: Optional[str] = None
    logo_base64: Optional[str] = None
    map_settings: Optional[MapSettings] = None
    case_retention_days: Optional[int] = None
    default_working_area_postcode: Optional[str] = None
    enable_what3words: Optional[bool] = None
    enable_public_reporting: Optional[bool] = None

# Team Models
class Team(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    team_type: TeamType
    description: str = ""
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TeamCreate(BaseModel):
    name: str
    team_type: TeamType
    description: str = ""

class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

# User Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole
    teams: List[str] = []  # List of team IDs
    cross_team_access: bool = False  # For supervisors with cross-team visibility

class UserCreate(UserBase):
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class LocationData(BaseModel):
    postcode: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    what3words: Optional[str] = None  # what3words reference

class LocationUpdate(BaseModel):
    """Separate model for location updates to track changes"""
    postcode: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    what3words: Optional[str] = None

class CaseCreate(BaseModel):
    case_type: CaseType
    description: str
    location: LocationData
    reporter_name: Optional[str] = None
    reporter_contact: Optional[str] = None
    type_specific_fields: Optional[CaseTypeSpecificFields] = None
    reporting_source: Optional[ReportingSource] = ReportingSource.OFFICER
    owning_team: Optional[str] = None  # Team ID

class CaseUpdate(BaseModel):
    description: Optional[str] = None
    status: Optional[CaseStatus] = None
    assigned_to: Optional[str] = None
    location: Optional[LocationData] = None
    type_specific_fields: Optional[CaseTypeSpecificFields] = None
    owning_team: Optional[str] = None  # Can reassign team

class Case(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reference_number: str = ""
    case_type: CaseType
    status: CaseStatus = CaseStatus.NEW
    description: str
    location: LocationData
    reporter_name: Optional[str] = None
    reporter_contact: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    closed_at: Optional[datetime] = None
    created_by: Optional[str] = None
    type_specific_fields: Optional[CaseTypeSpecificFields] = None
    reporting_source: Optional[ReportingSource] = ReportingSource.OFFICER
    location_history: Optional[List[dict]] = None  # Track location changes
    owning_team: Optional[str] = None  # Team ID
    owning_team_name: Optional[str] = None  # Team name for display

class CaseNote(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    case_id: str
    content: str
    created_by: str
    created_by_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CaseNoteCreate(BaseModel):
    content: str

class CaseEvidence(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    case_id: str
    filename: str
    file_type: str
    file_data: str  # Base64 encoded
    uploaded_by: str
    uploaded_by_name: str
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    case_id: str
    action: str
    details: str
    performed_by: str
    performed_by_name: str
    performed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    message: str
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    case_id: Optional[str] = None

class PublicReport(BaseModel):
    case_type: CaseType
    description: str
    location: LocationData
    reporter_name: Optional[str] = None
    reporter_contact: Optional[str] = None
    evidence_files: Optional[List[str]] = None  # Base64 encoded files
    type_specific_fields: Optional[CaseTypeSpecificFields] = None

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_role(roles: List[UserRole], user: dict = Depends(get_current_user)) -> dict:
    if user["role"] not in [r.value for r in roles]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return user

async def generate_reference_number(case_type: CaseType) -> str:
    prefix_map = {
        CaseType.FLY_TIPPING: "FT",
        CaseType.FLY_TIPPING_PRIVATE: "FP",
        CaseType.FLY_TIPPING_ORGANISED: "FO",
        CaseType.ABANDONED_VEHICLE: "AV",
        CaseType.LITTERING: "LT",
        CaseType.DOG_FOULING: "DF",
        CaseType.PSPO_DOG_CONTROL: "PS",
        CaseType.UNTIDY_LAND: "UL",
        CaseType.HIGH_HEDGES: "HH",
        CaseType.WASTE_CARRIER_LICENSING: "WC",
        CaseType.NUISANCE_VEHICLE: "NV",
        CaseType.COMPLEX_ENVIRONMENTAL: "CE"
    }
    prefix = prefix_map.get(case_type, "GE")
    year = datetime.now().strftime("%y")
    count = await db.cases.count_documents({}) + 1
    return f"{prefix}-{year}-{count:05d}"

async def create_audit_log(case_id: str, action: str, details: str, user: dict):
    log = AuditLog(
        case_id=case_id,
        action=action,
        details=details,
        performed_by=user["id"],
        performed_by_name=user["name"]
    )
    doc = log.model_dump()
    doc['performed_at'] = doc['performed_at'].isoformat()
    await db.audit_logs.insert_one(doc)

async def log_access_decision(user: dict, resource: str, action: str, allowed: bool, reason: str):
    """Log all access decisions for audit purposes"""
    log = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_role": user["role"],
        "resource": resource,
        "action": action,
        "allowed": allowed,
        "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.access_logs.insert_one(log)

async def get_user_team_ids(user: dict) -> List[str]:
    """Get list of team IDs the user belongs to"""
    return user.get("teams", [])

async def can_user_access_case(user: dict, case: dict) -> bool:
    """Check if user can access a case based on team membership"""
    # Managers always have access
    if user["role"] == UserRole.MANAGER.value:
        return True
    
    # Supervisors with cross-team access can see all
    if user["role"] == UserRole.SUPERVISOR.value and user.get("cross_team_access", False):
        return True
    
    # Check team membership
    user_teams = user.get("teams", [])
    case_team = case.get("owning_team")
    
    if not user_teams:
        # Users without team assignment can see all (backward compatibility)
        return True
    
    if not case_team:
        # Cases without team assignment are visible to all
        return True
    
    return case_team in user_teams

async def get_teams_for_case_type(case_type: CaseType) -> List[str]:
    """Get team IDs that can handle a case type"""
    allowed_team_types = CASE_TYPE_TEAMS.get(case_type, [])
    teams = await db.teams.find(
        {"team_type": {"$in": [t.value for t in allowed_team_types]}, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    return [t["id"] for t in teams]

async def create_notification(user_id: str, title: str, message: str, case_id: Optional[str] = None):
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        case_id=case_id
    )
    doc = notification.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.notifications.insert_one(doc)

# Auth Endpoints
@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is disabled")
    
    token = create_token(user["id"], user["email"], user["role"])
    user_data = {k: v for k, v in user.items() if k != "password"}
    return TokenResponse(access_token=token, user=user_data)

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

@api_router.post("/auth/register", response_model=User)
async def register_user(user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    # Only managers can create users
    if current_user["role"] != UserRole.MANAGER.value:
        raise HTTPException(status_code=403, detail="Only managers can create users")
    
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(**user_data.model_dump(exclude={"password"}))
    doc = user.model_dump()
    doc["password"] = hash_password(user_data.password)
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    return user

# User Management Endpoints
@api_router.get("/users", response_model=List[User])
async def get_users(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.MANAGER.value, UserRole.SUPERVISOR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return users

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.MANAGER.value:
        raise HTTPException(status_code=403, detail="Only managers can update users")
    
    allowed_fields = ["name", "role", "is_active", "teams", "cross_team_access"]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    # Validate team IDs if provided
    if "teams" in update_data:
        team_ids = update_data["teams"]
        if team_ids:
            valid_teams = await db.teams.find({"id": {"$in": team_ids}}, {"_id": 0}).to_list(100)
            valid_team_ids = [t["id"] for t in valid_teams]
            invalid_ids = [tid for tid in team_ids if tid not in valid_team_ids]
            if invalid_ids:
                raise HTTPException(status_code=400, detail=f"Invalid team IDs: {invalid_ids}")
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await log_access_decision(current_user, f"user:{user_id}", "update", True, f"Updated fields: {list(update_data.keys())}")
    
    return {"message": "User updated successfully"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.MANAGER.value:
        raise HTTPException(status_code=403, detail="Only managers can delete users")
    
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

# System Settings Endpoints
@api_router.get("/settings")
async def get_system_settings(current_user: dict = Depends(get_current_user)):
    """Get system settings - all authenticated users can view"""
    settings = await db.system_settings.find_one({"id": "system_settings"}, {"_id": 0})
    if not settings:
        # Return defaults if not configured
        default_settings = SystemSettings()
        return default_settings.model_dump()
    return settings

@api_router.put("/settings")
async def update_system_settings(updates: SystemSettingsUpdate, current_user: dict = Depends(get_current_user)):
    """Update system settings - managers only"""
    if current_user["role"] != UserRole.MANAGER.value:
        raise HTTPException(status_code=403, detail="Only managers can update settings")
    
    existing = await db.system_settings.find_one({"id": "system_settings"}, {"_id": 0})
    
    update_data = {k: v for k, v in updates.model_dump(exclude_none=True).items()}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    
    if updates.map_settings:
        update_data["map_settings"] = updates.map_settings.model_dump()
    
    if existing:
        await db.system_settings.update_one({"id": "system_settings"}, {"$set": update_data})
    else:
        new_settings = SystemSettings(**update_data)
        doc = new_settings.model_dump()
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.system_settings.insert_one(doc)
    
    await log_access_decision(current_user, "system_settings", "update", True, "Manager updated settings")
    
    return {"message": "Settings updated successfully"}

# Team Endpoints
@api_router.get("/teams")
async def get_teams(current_user: dict = Depends(get_current_user)):
    """Get all teams - all authenticated users can view"""
    teams = await db.teams.find({}, {"_id": 0}).to_list(100)
    return teams

@api_router.get("/teams/{team_id}")
async def get_team(team_id: str, current_user: dict = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team

@api_router.post("/teams", response_model=Team)
async def create_team(team_data: TeamCreate, current_user: dict = Depends(get_current_user)):
    """Create a new team - managers only"""
    if current_user["role"] != UserRole.MANAGER.value:
        raise HTTPException(status_code=403, detail="Only managers can create teams")
    
    # Check for duplicate name
    existing = await db.teams.find_one({"name": team_data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Team with this name already exists")
    
    team = Team(**team_data.model_dump())
    doc = team.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.teams.insert_one(doc)
    await log_access_decision(current_user, f"team:{team.id}", "create", True, f"Created team {team.name}")
    
    return team

@api_router.put("/teams/{team_id}")
async def update_team(team_id: str, updates: TeamUpdate, current_user: dict = Depends(get_current_user)):
    """Update a team - managers only"""
    if current_user["role"] != UserRole.MANAGER.value:
        raise HTTPException(status_code=403, detail="Only managers can update teams")
    
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    update_data = {k: v for k, v in updates.model_dump(exclude_none=True).items()}
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    await db.teams.update_one({"id": team_id}, {"$set": update_data})
    await log_access_decision(current_user, f"team:{team_id}", "update", True, f"Updated team {team['name']}")
    
    return {"message": "Team updated successfully"}

@api_router.delete("/teams/{team_id}")
async def delete_team(team_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a team - managers only"""
    if current_user["role"] != UserRole.MANAGER.value:
        raise HTTPException(status_code=403, detail="Only managers can delete teams")
    
    # Check if team has assigned cases
    case_count = await db.cases.count_documents({"owning_team": team_id})
    if case_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete team with {case_count} assigned cases")
    
    result = await db.teams.delete_one({"id": team_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Remove team from users
    await db.users.update_many({"teams": team_id}, {"$pull": {"teams": team_id}})
    
    await log_access_decision(current_user, f"team:{team_id}", "delete", True, "Deleted team")
    
    return {"message": "Team deleted successfully"}

@api_router.get("/teams/{team_id}/members")
async def get_team_members(team_id: str, current_user: dict = Depends(get_current_user)):
    """Get members of a team"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    members = await db.users.find({"teams": team_id}, {"_id": 0, "password": 0}).to_list(1000)
    return members

@api_router.get("/case-types/teams")
async def get_case_type_team_mapping(current_user: dict = Depends(get_current_user)):
    """Get mapping of case types to allowed teams"""
    result = {}
    for case_type, team_types in CASE_TYPE_TEAMS.items():
        teams = await db.teams.find(
            {"team_type": {"$in": [t.value for t in team_types]}, "is_active": True},
            {"_id": 0}
        ).to_list(100)
        result[case_type.value] = {
            "allowed_team_types": [t.value for t in team_types],
            "available_teams": teams
        }
    return result

# Case Endpoints
@api_router.get("/cases")
async def get_cases(
    status: Optional[CaseStatus] = None,
    case_type: Optional[CaseType] = None,
    assigned_to: Optional[str] = None,
    unassigned: Optional[bool] = None,
    team_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    # Team-based filtering
    user_teams = current_user.get("teams", [])
    has_cross_team = current_user.get("cross_team_access", False)
    
    # Managers always see all cases
    # Supervisors with cross_team_access see all cases
    # Others see only cases from their teams (or unassigned teams for backward compat)
    if current_user["role"] != UserRole.MANAGER.value:
        if not (current_user["role"] == UserRole.SUPERVISOR.value and has_cross_team):
            if user_teams:
                # Filter by user's teams or cases without team assignment
                query["$or"] = [
                    {"owning_team": {"$in": user_teams}},
                    {"owning_team": None},
                    {"owning_team": {"$exists": False}}
                ]
    
    # Officers can only see assigned cases or unassigned pool
    if current_user["role"] == UserRole.OFFICER.value:
        team_filter = query.get("$or", [])
        if unassigned:
            query["assigned_to"] = None
        else:
            # Combine team filter with assignment filter
            assignment_conditions = [
                {"assigned_to": current_user["id"]},
                {"assigned_to": None}
            ]
            if team_filter:
                # Must match both team AND assignment
                query["$and"] = [
                    {"$or": team_filter},
                    {"$or": assignment_conditions}
                ]
                del query["$or"]
            else:
                query["$or"] = assignment_conditions
    
    if status:
        query["status"] = status.value
    if case_type:
        query["case_type"] = case_type.value
    if assigned_to:
        query["assigned_to"] = assigned_to
    if unassigned and current_user["role"] != UserRole.OFFICER.value:
        query["assigned_to"] = None
    if team_id:
        query["owning_team"] = team_id
    
    cases = await db.cases.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return cases

@api_router.get("/cases/{case_id}")
async def get_case(case_id: str, current_user: dict = Depends(get_current_user)):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check team-based access
    if not await can_user_access_case(current_user, case):
        await log_access_decision(current_user, f"case:{case_id}", "view", False, "Team access denied")
        raise HTTPException(status_code=403, detail="Not authorized to view this case - team access denied")
    
    # Officers can only view assigned cases or unassigned ones
    if current_user["role"] == UserRole.OFFICER.value:
        if case.get("assigned_to") and case["assigned_to"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to view this case")
    
    return case

@api_router.post("/cases", response_model=Case)
async def create_case(case_data: CaseCreate, current_user: dict = Depends(get_current_user)):
    ref_number = await generate_reference_number(case_data.case_type)
    
    # Determine owning team
    owning_team = case_data.owning_team
    owning_team_name = None
    
    # If no team specified, auto-assign based on user's team or case type mapping
    if not owning_team:
        user_teams = current_user.get("teams", [])
        if user_teams:
            owning_team = user_teams[0]  # Default to user's first team
    
    # Get team name if team is assigned
    if owning_team:
        team = await db.teams.find_one({"id": owning_team}, {"_id": 0})
        if team:
            owning_team_name = team["name"]
    
    case = Case(
        **case_data.model_dump(exclude={"owning_team"}),
        reference_number=ref_number,
        created_by=current_user["id"],
        owning_team=owning_team,
        owning_team_name=owning_team_name
    )
    
    doc = case.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    doc['location'] = case_data.location.model_dump()
    if case_data.type_specific_fields:
        doc['type_specific_fields'] = case_data.type_specific_fields.model_dump()
    
    await db.cases.insert_one(doc)
    await create_audit_log(case.id, "CREATED", f"Case {ref_number} created", current_user)
    
    return case

@api_router.put("/cases/{case_id}")
async def update_case(case_id: str, updates: CaseUpdate, current_user: dict = Depends(get_current_user)):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check team-based access
    if not await can_user_access_case(current_user, case):
        await log_access_decision(current_user, f"case:{case_id}", "update", False, "Team access denied")
        raise HTTPException(status_code=403, detail="Not authorized to update this case - team access denied")
    
    # Permission checks
    if current_user["role"] == UserRole.OFFICER.value:
        if case.get("assigned_to") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Can only update assigned cases")
        # Officers can't change assignment or close cases
        if updates.assigned_to:
            raise HTTPException(status_code=403, detail="Officers cannot reassign cases")
        if updates.status == CaseStatus.CLOSED:
            raise HTTPException(status_code=403, detail="Officers cannot close cases")
    
    update_data = {k: v for k, v in updates.model_dump(exclude_none=True).items()}
    audit_details = []
    
    # Handle team reassignment (manager/supervisor only)
    if updates.owning_team:
        if current_user["role"] == UserRole.OFFICER.value:
            raise HTTPException(status_code=403, detail="Officers cannot reassign case teams")
        team = await db.teams.find_one({"id": updates.owning_team}, {"_id": 0})
        if team:
            update_data["owning_team_name"] = team["name"]
            audit_details.append(f"Team changed to {team['name']}")
        else:
            raise HTTPException(status_code=400, detail="Invalid team ID")
    
    # Handle location updates with history tracking
    if updates.location:
        new_location = updates.location.model_dump()
        old_location = case.get("location", {})
        
        # Check if location actually changed
        location_changed = (
            new_location.get("latitude") != old_location.get("latitude") or
            new_location.get("longitude") != old_location.get("longitude") or
            new_location.get("address") != old_location.get("address") or
            new_location.get("postcode") != old_location.get("postcode") or
            new_location.get("what3words") != old_location.get("what3words")
        )
        
        if location_changed:
            # Store location history
            location_history = case.get("location_history", []) or []
            if old_location:
                location_history.append({
                    "location": old_location,
                    "changed_by": current_user["id"],
                    "changed_by_name": current_user["name"],
                    "changed_at": datetime.now(timezone.utc).isoformat()
                })
            update_data["location_history"] = location_history
            update_data["location"] = new_location
            audit_details.append(f"Location updated from {old_location.get('address', 'unknown')} to {new_location.get('address', 'unknown')}")
    
    # Handle type-specific fields
    if updates.type_specific_fields:
        update_data["type_specific_fields"] = updates.type_specific_fields.model_dump()
        audit_details.append("Case-specific details updated")
    
    # Handle description update
    if updates.description and updates.description != case.get("description"):
        audit_details.append(f"Description updated")
    
    # Handle status changes (supervisor/manager only for closing)
    if updates.status:
        update_data["status"] = updates.status.value
        if updates.status == CaseStatus.CLOSED:
            update_data["closed_at"] = datetime.now(timezone.utc).isoformat()
        audit_details.append(f"Status changed to {updates.status.value}")
    
    # Handle assignment (supervisor/manager only)
    if updates.assigned_to:
        if updates.assigned_to == "unassigned":
            update_data["assigned_to"] = None
            update_data["assigned_to_name"] = None
            audit_details.append("Case unassigned")
        else:
            assignee = await db.users.find_one({"id": updates.assigned_to}, {"_id": 0, "password": 0})
            if assignee:
                update_data["assigned_to_name"] = assignee["name"]
                # Create notification for assignee
                await create_notification(
                    updates.assigned_to,
                    "Case Assigned",
                    f"Case {case['reference_number']} has been assigned to you",
                    case_id
                )
                audit_details.append(f"Assigned to {assignee['name']}")
            if case.get("status") == CaseStatus.NEW.value:
                update_data["status"] = CaseStatus.ASSIGNED.value
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.cases.update_one({"id": case_id}, {"$set": update_data})
    
    # Create audit log with detailed changes
    if audit_details:
        await create_audit_log(case_id, "UPDATED", "; ".join(audit_details), current_user)
    
    updated_case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    return updated_case

# Dedicated location update endpoint for map pin dragging
@api_router.put("/cases/{case_id}/location")
async def update_case_location(case_id: str, location: LocationUpdate, current_user: dict = Depends(get_current_user)):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Officers can only update location for assigned cases
    if current_user["role"] == UserRole.OFFICER.value:
        if case.get("assigned_to") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Can only update assigned cases")
    
    new_location = location.model_dump()
    old_location = case.get("location", {})
    
    # Store location history
    location_history = case.get("location_history", []) or []
    if old_location:
        location_history.append({
            "location": old_location,
            "changed_by": current_user["id"],
            "changed_by_name": current_user["name"],
            "changed_at": datetime.now(timezone.utc).isoformat()
        })
    
    await db.cases.update_one(
        {"id": case_id},
        {
            "$set": {
                "location": new_location,
                "location_history": location_history,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Detailed audit log for location change
    old_coords = f"({old_location.get('latitude', 'N/A')}, {old_location.get('longitude', 'N/A')})"
    new_coords = f"({new_location.get('latitude', 'N/A')}, {new_location.get('longitude', 'N/A')})"
    await create_audit_log(
        case_id, 
        "LOCATION_UPDATED", 
        f"Location changed from {old_coords} to {new_coords}. Address: {new_location.get('address', 'N/A')}",
        current_user
    )
    
    updated_case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    return updated_case

@api_router.post("/cases/{case_id}/self-assign")
async def self_assign_case(case_id: str, current_user: dict = Depends(get_current_user)):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    if case.get("assigned_to"):
        raise HTTPException(status_code=400, detail="Case is already assigned")
    
    await db.cases.update_one(
        {"id": case_id},
        {
            "$set": {
                "assigned_to": current_user["id"],
                "assigned_to_name": current_user["name"],
                "status": CaseStatus.ASSIGNED.value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    await create_audit_log(case_id, "SELF_ASSIGNED", f"Self-assigned by {current_user['name']}", current_user)
    
    return {"message": "Case assigned successfully"}

# Case Notes
@api_router.get("/cases/{case_id}/notes")
async def get_case_notes(case_id: str, current_user: dict = Depends(get_current_user)):
    notes = await db.case_notes.find({"case_id": case_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return notes

@api_router.post("/cases/{case_id}/notes")
async def add_case_note(case_id: str, note_data: CaseNoteCreate, current_user: dict = Depends(get_current_user)):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    note = CaseNote(
        case_id=case_id,
        content=note_data.content,
        created_by=current_user["id"],
        created_by_name=current_user["name"]
    )
    
    doc = note.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.case_notes.insert_one(doc)
    await create_audit_log(case_id, "NOTE_ADDED", "Added a note", current_user)
    
    return note

# Case Evidence
@api_router.get("/cases/{case_id}/evidence")
async def get_case_evidence(case_id: str, current_user: dict = Depends(get_current_user)):
    evidence = await db.case_evidence.find({"case_id": case_id}, {"_id": 0}).sort("uploaded_at", -1).to_list(100)
    return evidence

@api_router.post("/cases/{case_id}/evidence")
async def upload_evidence(
    case_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Read and encode file
    content = await file.read()
    encoded = base64.b64encode(content).decode('utf-8')
    
    evidence = CaseEvidence(
        case_id=case_id,
        filename=file.filename,
        file_type=file.content_type,
        file_data=encoded,
        uploaded_by=current_user["id"],
        uploaded_by_name=current_user["name"]
    )
    
    doc = evidence.model_dump()
    doc['uploaded_at'] = doc['uploaded_at'].isoformat()
    
    await db.case_evidence.insert_one(doc)
    await create_audit_log(case_id, "EVIDENCE_UPLOADED", f"Uploaded: {file.filename}", current_user)
    
    # Return without file_data for response
    return {
        "id": evidence.id,
        "filename": evidence.filename,
        "file_type": evidence.file_type,
        "uploaded_by_name": evidence.uploaded_by_name,
        "uploaded_at": evidence.uploaded_at.isoformat()
    }

@api_router.delete("/cases/{case_id}/evidence/{evidence_id}")
async def delete_evidence(case_id: str, evidence_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == UserRole.OFFICER.value:
        raise HTTPException(status_code=403, detail="Officers cannot delete evidence")
    
    result = await db.case_evidence.delete_one({"id": evidence_id, "case_id": case_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Evidence not found")
    
    await create_audit_log(case_id, "EVIDENCE_DELETED", f"Deleted evidence {evidence_id}", current_user)
    return {"message": "Evidence deleted"}

# Audit Log
@api_router.get("/cases/{case_id}/audit-log")
async def get_audit_log(case_id: str, current_user: dict = Depends(get_current_user)):
    logs = await db.audit_logs.find({"case_id": case_id}, {"_id": 0}).sort("performed_at", -1).to_list(100)
    return logs

# Notifications
@api_router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"is_read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}

@api_router.put("/notifications/mark-all-read")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

# Public Report Endpoint (No Auth Required)
@api_router.post("/public/report")
async def submit_public_report(report: PublicReport):
    ref_number = await generate_reference_number(report.case_type)
    
    case = Case(
        case_type=report.case_type,
        description=report.description,
        location=report.location,
        reporter_name=report.reporter_name,
        reporter_contact=report.reporter_contact,
        reference_number=ref_number,
        type_specific_fields=report.type_specific_fields,
        reporting_source=ReportingSource.PUBLIC
    )
    
    doc = case.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    doc['location'] = report.location.model_dump()
    doc['reporting_source'] = ReportingSource.PUBLIC.value
    if report.type_specific_fields:
        doc['type_specific_fields'] = report.type_specific_fields.model_dump()
    
    await db.cases.insert_one(doc)
    
    # Store evidence if provided
    if report.evidence_files:
        for i, file_data in enumerate(report.evidence_files):
            evidence = CaseEvidence(
                case_id=case.id,
                filename=f"public_upload_{i+1}",
                file_type="image/jpeg",
                file_data=file_data,
                uploaded_by="public",
                uploaded_by_name="Public Reporter"
            )
            ev_doc = evidence.model_dump()
            ev_doc['uploaded_at'] = ev_doc['uploaded_at'].isoformat()
            await db.case_evidence.insert_one(ev_doc)
    
    # Notify supervisors about new public report
    supervisors = await db.users.find({"role": UserRole.SUPERVISOR.value}, {"_id": 0}).to_list(100)
    for supervisor in supervisors:
        await create_notification(
            supervisor["id"],
            "New Public Report",
            f"A new {report.case_type.value.replace('_', ' ')} report ({ref_number}) has been submitted",
            case.id
        )
    
    return {
        "message": "Report submitted successfully",
        "reference_number": ref_number
    }

# Statistics Endpoints
@api_router.get("/stats/overview")
async def get_stats_overview(current_user: dict = Depends(get_current_user)):
    total_cases = await db.cases.count_documents({})
    open_cases = await db.cases.count_documents({"status": {"$ne": CaseStatus.CLOSED.value}})
    closed_cases = await db.cases.count_documents({"status": CaseStatus.CLOSED.value})
    unassigned_cases = await db.cases.count_documents({"assigned_to": None})
    
    # Cases by type
    pipeline = [
        {"$group": {"_id": "$case_type", "count": {"$sum": 1}}}
    ]
    by_type = await db.cases.aggregate(pipeline).to_list(20)
    cases_by_type = {item["_id"]: item["count"] for item in by_type}
    
    # Cases by status
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    by_status = await db.cases.aggregate(pipeline).to_list(20)
    cases_by_status = {item["_id"]: item["count"] for item in by_status}
    
    return {
        "total_cases": total_cases,
        "open_cases": open_cases,
        "closed_cases": closed_cases,
        "unassigned_cases": unassigned_cases,
        "cases_by_type": cases_by_type,
        "cases_by_status": cases_by_status
    }

@api_router.get("/stats/officer-workload")
async def get_officer_workload(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.MANAGER.value, UserRole.SUPERVISOR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    pipeline = [
        {"$match": {"assigned_to": {"$ne": None}}},
        {"$group": {
            "_id": "$assigned_to",
            "assigned_name": {"$first": "$assigned_to_name"},
            "total": {"$sum": 1},
            "open": {"$sum": {"$cond": [{"$ne": ["$status", CaseStatus.CLOSED.value]}, 1, 0]}},
            "closed": {"$sum": {"$cond": [{"$eq": ["$status", CaseStatus.CLOSED.value]}, 1, 0]}}
        }}
    ]
    
    workload = await db.cases.aggregate(pipeline).to_list(100)
    return workload

@api_router.get("/stats/export-csv")
async def export_cases_csv(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != UserRole.MANAGER.value:
        raise HTTPException(status_code=403, detail="Only managers can export data")
    
    query = {}
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    cases = await db.cases.find(query, {"_id": 0}).to_list(10000)
    
    # Generate CSV
    import csv
    import io
    
    output = io.StringIO()
    if cases:
        fieldnames = ["reference_number", "case_type", "status", "description", "assigned_to_name", "created_at", "updated_at", "closed_at"]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        for case in cases:
            writer.writerow(case)
    
    return {
        "csv_data": output.getvalue(),
        "filename": f"cases_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    }

# Initialize default admin user on startup
@app.on_event("startup")
async def startup_event():
    # Create default admin if no users exist
    user_count = await db.users.count_documents({})
    if user_count == 0:
        admin_user = User(
            email="admin@council.gov.uk",
            name="System Admin",
            role=UserRole.MANAGER
        )
        doc = admin_user.model_dump()
        doc["password"] = hash_password("admin123")
        doc['created_at'] = doc['created_at'].isoformat()
        await db.users.insert_one(doc)
        
        # Also create demo users
        demo_users = [
            {"email": "supervisor@council.gov.uk", "name": "Jane Smith", "role": UserRole.SUPERVISOR, "password": "super123"},
            {"email": "officer@council.gov.uk", "name": "John Officer", "role": UserRole.OFFICER, "password": "officer123"},
        ]
        for user_data in demo_users:
            user = User(**{k: v for k, v in user_data.items() if k != "password"})
            doc = user.model_dump()
            doc["password"] = hash_password(user_data["password"])
            doc['created_at'] = doc['created_at'].isoformat()
            await db.users.insert_one(doc)
        
        logging.info("Default users created")

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
