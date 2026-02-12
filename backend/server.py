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

# Fixed Penalty Notice Model
class FixedPenaltyNotice(BaseModel):
    fpn_ref: Optional[str] = None
    date_issued: Optional[str] = None
    fpn_amount: Optional[float] = None
    paid: bool = False
    date_paid: Optional[str] = None
    pay_reference: Optional[str] = None

class CaseUpdate(BaseModel):
    description: Optional[str] = None
    status: Optional[CaseStatus] = None
    assigned_to: Optional[str] = None
    location: Optional[LocationData] = None
    type_specific_fields: Optional[CaseTypeSpecificFields] = None
    owning_team: Optional[str] = None  # Can reassign team
    closure_reason: Optional[str] = None  # Required when closing
    final_note: Optional[str] = None  # Required when closing
    fpn_issued: Optional[bool] = None  # Fixed Penalty Issued checkbox
    fpn_details: Optional[FixedPenaltyNotice] = None  # FPN details

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
    # Closure details
    closure_reason: Optional[str] = None
    final_note: Optional[str] = None
    closed_by: Optional[str] = None
    closed_by_name: Optional[str] = None
    # W3W cache
    w3w_cached_at: Optional[str] = None  # Timestamp of last W3W lookup
    # Fixed Penalty Notice
    fpn_issued: bool = False
    fpn_details: Optional[FixedPenaltyNotice] = None

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

# Person Models (Reporters/Offenders)
class PersonType(str, Enum):
    REPORTER = "reporter"
    OFFENDER = "offender"
    BOTH = "both"

class PersonTitle(str, Enum):
    MR = "Mr"
    MRS = "Mrs"
    MS = "Ms"
    MISS = "Miss"
    DR = "Dr"
    OTHER = "Other"

class PersonAddress(BaseModel):
    line1: Optional[str] = None
    line2: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    postcode: Optional[str] = None

class Person(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    person_type: PersonType = PersonType.REPORTER
    title: Optional[PersonTitle] = None
    first_name: str
    last_name: str
    date_of_birth: Optional[str] = None
    address: Optional[PersonAddress] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    id_type: Optional[str] = None  # driving_license, passport, national_id, other
    id_number: Optional[str] = None
    notes: Optional[str] = None
    linked_cases: List[str] = Field(default_factory=list)  # List of case IDs
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None

class PersonCreate(BaseModel):
    person_type: PersonType = PersonType.REPORTER
    title: Optional[PersonTitle] = None
    first_name: str
    last_name: str
    date_of_birth: Optional[str] = None
    address: Optional[PersonAddress] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    notes: Optional[str] = None

class PersonUpdate(BaseModel):
    person_type: Optional[PersonType] = None
    title: Optional[PersonTitle] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[PersonAddress] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    notes: Optional[str] = None

# Case-Person link
class CasePersonLink(BaseModel):
    case_id: str
    person_id: str
    role: PersonType  # reporter or offender for this specific case

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

# What3Words Helper Functions
async def w3w_convert_to_coordinates(words: str) -> Optional[Dict[str, Any]]:
    """Convert what3words address to coordinates"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{W3W_API_URL}/convert-to-coordinates",
                params={"words": words, "key": W3W_API_KEY}
            )
            if response.status_code == 200:
                data = response.json()
                if "coordinates" in data:
                    return {
                        "latitude": data["coordinates"]["lat"],
                        "longitude": data["coordinates"]["lng"],
                        "words": data["words"],
                        "nearestPlace": data.get("nearestPlace", ""),
                        "country": data.get("country", "")
                    }
            return None
    except Exception as e:
        logging.error(f"W3W API error (convert-to-coordinates): {e}")
        return None

async def w3w_convert_to_3wa(lat: float, lng: float) -> Optional[str]:
    """Convert coordinates to what3words address"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{W3W_API_URL}/convert-to-3wa",
                params={"coordinates": f"{lat},{lng}", "key": W3W_API_KEY}
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("words")
            elif response.status_code == 402:
                logging.warning("W3W API: Payment required or quota exceeded")
            else:
                logging.warning(f"W3W API returned status {response.status_code}")
            return None
    except Exception as e:
        logging.error(f"W3W API error (convert-to-3wa): {e}")
        return None

async def get_user_team_types(user: dict) -> List[str]:
    """Get the team types for a user's assigned teams"""
    user_team_ids = user.get("teams", [])
    if not user_team_ids:
        return []
    teams = await db.teams.find({"id": {"$in": user_team_ids}}, {"_id": 0}).to_list(100)
    return [t["team_type"] for t in teams]

async def can_user_view_case_type(user: dict, case_type: str) -> bool:
    """Check if user can view a specific case type based on team visibility rules"""
    # Managers and supervisors with cross-team access can see all
    if user["role"] == UserRole.MANAGER.value:
        return True
    if user["role"] == UserRole.SUPERVISOR.value and user.get("cross_team_access", False):
        return True
    
    # Get user's team types
    user_team_types = await get_user_team_types(user)
    if not user_team_types:
        return True  # Backward compatibility - no teams = see all
    
    # Check if any of user's team types can view this case type
    try:
        case_type_enum = CaseType(case_type)
        allowed_team_types = CASE_TYPE_VISIBILITY.get(case_type_enum, [])
        for team_type in user_team_types:
            if TeamType(team_type) in allowed_team_types:
                return True
    except ValueError:
        return True  # Unknown case type - allow view
    
    return False

def is_fly_tipping_case(case_type: str) -> bool:
    """Check if case type is a fly-tipping variant"""
    return case_type in [
        CaseType.FLY_TIPPING.value,
        CaseType.FLY_TIPPING_PRIVATE.value,
        CaseType.FLY_TIPPING_ORGANISED.value
    ]

async def is_user_waste_management(user: dict) -> bool:
    """Check if user belongs to Waste Management team"""
    user_team_types = await get_user_team_types(user)
    return TeamType.WASTE_MANAGEMENT.value in user_team_types

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

# Public settings endpoint (for login page branding)
@api_router.get("/settings/public")
async def get_public_settings():
    """Get public settings (no auth required) - for login page branding"""
    settings = await db.system_settings.find_one({"id": "system_settings"}, {"_id": 0})
    if not settings:
        default_settings = SystemSettings()
        settings = default_settings.model_dump()
    
    # Only return safe public fields
    return {
        "app_title": settings.get("app_title", "GovEnforce"),
        "organisation_name": settings.get("organisation_name", "Council Enforcement"),
        "logo_base64": settings.get("logo_base64"),
        "enable_public_reporting": settings.get("enable_public_reporting", True)
    }

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

# What3Words Endpoints
class W3WConvertRequest(BaseModel):
    words: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

@api_router.post("/w3w/convert")
async def convert_w3w(request: W3WConvertRequest, current_user: dict = Depends(get_current_user)):
    """Convert between what3words and coordinates. Only one direction per call."""
    # Check if W3W is enabled
    settings = await db.system_settings.find_one({"id": "system_settings"}, {"_id": 0})
    if settings and not settings.get("enable_what3words", True):
        raise HTTPException(status_code=400, detail="What3Words is disabled in system settings")
    
    if request.words:
        # Convert W3W to coordinates
        result = await w3w_convert_to_coordinates(request.words)
        if result:
            return {
                "success": True,
                "words": result["words"],
                "latitude": result["latitude"],
                "longitude": result["longitude"],
                "nearestPlace": result.get("nearestPlace", "")
            }
        return {"success": False, "error": "Could not convert what3words address"}
    
    elif request.latitude is not None and request.longitude is not None:
        # Convert coordinates to W3W
        words = await w3w_convert_to_3wa(request.latitude, request.longitude)
        if words:
            return {
                "success": True,
                "words": words,
                "latitude": request.latitude,
                "longitude": request.longitude
            }
        return {"success": False, "error": "Could not convert coordinates to what3words"}
    
    raise HTTPException(status_code=400, detail="Provide either 'words' or 'latitude' and 'longitude'")

@api_router.get("/w3w/status")
async def get_w3w_status(current_user: dict = Depends(get_current_user)):
    """Check if What3Words is enabled and API is available"""
    settings = await db.system_settings.find_one({"id": "system_settings"}, {"_id": 0})
    enabled = settings.get("enable_what3words", True) if settings else True
    
    # Quick API health check
    api_available = False
    if enabled:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{W3W_API_URL}/available-languages",
                    params={"key": W3W_API_KEY}
                )
                api_available = response.status_code == 200
        except Exception:
            api_available = False
    
    return {
        "enabled": enabled,
        "api_available": api_available
    }

# Reverse Geocoding Endpoint (using OpenStreetMap Nominatim - free)
@api_router.get("/geocode/reverse")
async def reverse_geocode(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    current_user: dict = Depends(get_current_user)
):
    """Convert coordinates to address using OpenStreetMap Nominatim"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={
                    "lat": lat,
                    "lon": lng,
                    "format": "json",
                    "addressdetails": 1
                },
                headers={"User-Agent": "GovEnforce/1.0"}
            )
            if response.status_code == 200:
                data = response.json()
                address = data.get("address", {})
                
                # Build formatted address
                parts = []
                if address.get("house_number"):
                    parts.append(address["house_number"])
                if address.get("road"):
                    parts.append(address["road"])
                if address.get("suburb"):
                    parts.append(address["suburb"])
                if address.get("city") or address.get("town") or address.get("village"):
                    parts.append(address.get("city") or address.get("town") or address.get("village"))
                if address.get("county"):
                    parts.append(address["county"])
                
                return {
                    "success": True,
                    "address": ", ".join(parts) if parts else data.get("display_name", ""),
                    "postcode": address.get("postcode", ""),
                    "display_name": data.get("display_name", "")
                }
            return {"success": False, "error": "Could not geocode location"}
    except Exception as e:
        logging.error(f"Reverse geocoding error: {e}")
        return {"success": False, "error": "Geocoding service unavailable"}

# Case Endpoints
@api_router.get("/cases")
async def get_cases(
    status: Optional[CaseStatus] = None,
    case_type: Optional[CaseType] = None,
    assigned_to: Optional[str] = None,
    unassigned: Optional[bool] = None,
    team_id: Optional[str] = None,
    exclude_closed: Optional[bool] = None,
    vrm_search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    and_conditions = []
    
    # Exclude closed cases if requested (for live map)
    if exclude_closed:
        query["status"] = {"$ne": CaseStatus.CLOSED.value}
    
    # VRM search across all vehicle case types
    if vrm_search:
        normalized_vrm = vrm_search.replace(" ", "").upper()
        regex_pattern = "".join([c + r"\s*" for c in normalized_vrm]).rstrip(r"\s*")
        vrm_filter = {"$or": [
            {"type_specific_fields.abandoned_vehicle.registration_number": {"$regex": regex_pattern, "$options": "i"}},
            {"type_specific_fields.nuisance_vehicle.registration_number": {"$regex": regex_pattern, "$options": "i"}},
            {"type_specific_fields.registration_number": {"$regex": regex_pattern, "$options": "i"}}
        ]}
        and_conditions.append(vrm_filter)
    
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
                team_filter = {"$or": [
                    {"owning_team": {"$in": user_teams}},
                    {"owning_team": None},
                    {"owning_team": {"$exists": False}}
                ]}
                and_conditions.append(team_filter)
    
    # Officers can only see assigned cases or unassigned pool
    if current_user["role"] == UserRole.OFFICER.value:
        if unassigned:
            query["assigned_to"] = None
        else:
            # Combine with assignment filter
            assignment_filter = {"$or": [
                {"assigned_to": current_user["id"]},
                {"assigned_to": None}
            ]}
            and_conditions.append(assignment_filter)
    
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
    
    # Combine all $and conditions if any
    if and_conditions:
        if len(and_conditions) == 1:
            query.update(and_conditions[0])
        else:
            query["$and"] = and_conditions
    
    cases = await db.cases.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return cases

# IMPORTANT: This route must be before /cases/{case_id} to avoid path matching issues
@api_router.get("/cases/check-duplicate-vrm")
async def check_duplicate_vrm_route(
    vrm: str,
    case_type: str,
    exclude_case_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Check if a VRM already exists in cases of the same type"""
    if not vrm:
        return {"duplicates": [], "count": 0}
    
    # Normalize VRM - remove spaces and convert to uppercase
    normalized_vrm = vrm.replace(" ", "").upper()
    
    # Create a regex pattern that matches the VRM with or without spaces
    # e.g., "XY99ZAB" should match "XY99 ZAB", "XY 99 ZAB", etc.
    # Insert optional space between each character
    regex_pattern = "".join([c + r"\s*" for c in normalized_vrm]).rstrip(r"\s*")
    
    # Determine the nested field path based on case type
    if case_type == "abandoned_vehicle":
        vrm_field = "type_specific_fields.abandoned_vehicle.registration_number"
    elif case_type in ["nuisance_vehicle", "nuisance_vehicle_sale", "nuisance_vehicle_repair", "nuisance_vehicle_abandoned"]:
        vrm_field = "type_specific_fields.nuisance_vehicle.registration_number"
    else:
        vrm_field = "type_specific_fields.registration_number"
    
    query = {
        "case_type": case_type,
        vrm_field: {"$regex": f"^{regex_pattern}$", "$options": "i"}
    }
    
    if exclude_case_id:
        query["id"] = {"$ne": exclude_case_id}
    
    duplicates = await db.cases.find(
        query,
        {"_id": 0, "id": 1, "reference_number": 1, "status": 1, "created_at": 1, 
         "location": 1, "description": 1}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "duplicates": duplicates,
        "count": len(duplicates),
        "vrm": normalized_vrm
    }

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
    
    # Permission checks for officers
    if current_user["role"] == UserRole.OFFICER.value:
        if case.get("assigned_to") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Can only update assigned cases")
        # Officers can't change assignment
        if updates.assigned_to:
            raise HTTPException(status_code=403, detail="Officers cannot reassign cases")
    
    # ALL users must provide closure_reason and final_note when closing a case
    if updates.status == CaseStatus.CLOSED:
        if not updates.closure_reason or not updates.final_note:
            raise HTTPException(
                status_code=400, 
                detail="Closure reason and final note are required when closing a case"
            )
    
    # Only supervisors/managers can reopen closed cases
    if case.get("status") == CaseStatus.CLOSED.value:
        if updates.status and updates.status != CaseStatus.CLOSED:
            if current_user["role"] == UserRole.OFFICER.value:
                raise HTTPException(status_code=403, detail="Officers cannot reopen closed cases")
    
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
            # Cache W3W timestamp
            update_data["w3w_cached_at"] = datetime.now(timezone.utc).isoformat()
            audit_details.append(f"Location updated from {old_location.get('address', 'unknown')} to {new_location.get('address', 'unknown')}")
    
    # Handle type-specific fields
    if updates.type_specific_fields:
        # Check clearance outcome permissions for fly-tipping cases
        if is_fly_tipping_case(case.get("case_type", "")):
            clearance = updates.type_specific_fields.clearance_outcome
            if clearance:
                # Validate clearance fields
                if clearance.items_cleared is False and not clearance.reason_not_cleared:
                    raise HTTPException(
                        status_code=400,
                        detail="Reason not cleared is required when items are not cleared"
                    )
        update_data["type_specific_fields"] = updates.type_specific_fields.model_dump()
        audit_details.append("Case-specific details updated")
    
    # Handle FPN updates
    if updates.fpn_issued is not None:
        update_data["fpn_issued"] = updates.fpn_issued
        if updates.fpn_issued:
            audit_details.append("Fixed Penalty Notice issued")
        else:
            audit_details.append("Fixed Penalty Notice removed")
    
    if updates.fpn_details:
        update_data["fpn_details"] = updates.fpn_details.model_dump()
        audit_details.append("FPN details updated")
    
    # Handle description update
    if updates.description and updates.description != case.get("description"):
        audit_details.append(f"Description updated")
    
    # Handle status changes
    if updates.status:
        update_data["status"] = updates.status.value
        if updates.status == CaseStatus.CLOSED:
            update_data["closed_at"] = datetime.now(timezone.utc).isoformat()
            update_data["closed_by"] = current_user["id"]
            update_data["closed_by_name"] = current_user["name"]
            if updates.closure_reason:
                update_data["closure_reason"] = updates.closure_reason
            if updates.final_note:
                update_data["final_note"] = updates.final_note
            audit_details.append(f"Case CLOSED. Reason: {updates.closure_reason}")
        elif case.get("status") == CaseStatus.CLOSED.value:
            # Reopening a case
            update_data["closed_at"] = None
            update_data["closed_by"] = None
            update_data["closed_by_name"] = None
            audit_details.append(f"Case REOPENED by {current_user['name']}")
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

# FPN Reports
@api_router.get("/stats/fpn")
async def get_fpn_stats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get FPN statistics and summary"""
    if current_user["role"] not in [UserRole.MANAGER.value, UserRole.SUPERVISOR.value]:
        raise HTTPException(status_code=403, detail="Only managers and supervisors can view FPN reports")
    
    # Build query for date range
    query = {"fpn_issued": True}
    if start_date:
        query["fpn_details.date_issued"] = {"$gte": start_date}
    if end_date:
        if "fpn_details.date_issued" in query:
            query["fpn_details.date_issued"]["$lte"] = end_date
        else:
            query["fpn_details.date_issued"] = {"$lte": end_date}
    
    # Get all FPN cases
    fpn_cases = await db.cases.find(query, {"_id": 0}).to_list(10000)
    
    # Calculate statistics
    total_fpns = len(fpn_cases)
    paid_fpns = [c for c in fpn_cases if c.get("fpn_details", {}).get("paid", False)]
    outstanding_fpns = [c for c in fpn_cases if not c.get("fpn_details", {}).get("paid", False)]
    
    total_amount_due = sum(
        c.get("fpn_details", {}).get("fpn_amount", 0) or 0 
        for c in fpn_cases
    )
    total_collected = sum(
        c.get("fpn_details", {}).get("fpn_amount", 0) or 0 
        for c in paid_fpns
    )
    total_outstanding = sum(
        c.get("fpn_details", {}).get("fpn_amount", 0) or 0 
        for c in outstanding_fpns
    )
    
    # Payment rate
    payment_rate = (len(paid_fpns) / total_fpns * 100) if total_fpns > 0 else 0
    
    # FPNs by case type
    by_case_type = {}
    for c in fpn_cases:
        ct = c.get("case_type", "unknown")
        if ct not in by_case_type:
            by_case_type[ct] = {"count": 0, "amount": 0, "paid": 0}
        by_case_type[ct]["count"] += 1
        by_case_type[ct]["amount"] += c.get("fpn_details", {}).get("fpn_amount", 0) or 0
        if c.get("fpn_details", {}).get("paid", False):
            by_case_type[ct]["paid"] += 1
    
    # Monthly breakdown (last 12 months)
    from collections import defaultdict
    monthly_stats = defaultdict(lambda: {"issued": 0, "paid": 0, "amount": 0})
    for c in fpn_cases:
        date_issued = c.get("fpn_details", {}).get("date_issued")
        if date_issued:
            month_key = date_issued[:7]  # YYYY-MM
            monthly_stats[month_key]["issued"] += 1
            monthly_stats[month_key]["amount"] += c.get("fpn_details", {}).get("fpn_amount", 0) or 0
            if c.get("fpn_details", {}).get("paid", False):
                monthly_stats[month_key]["paid"] += 1
    
    return {
        "summary": {
            "total_fpns": total_fpns,
            "paid_fpns": len(paid_fpns),
            "outstanding_fpns": len(outstanding_fpns),
            "total_amount_due": total_amount_due,
            "total_collected": total_collected,
            "total_outstanding": total_outstanding,
            "payment_rate": round(payment_rate, 1)
        },
        "by_case_type": by_case_type,
        "monthly_breakdown": dict(monthly_stats)
    }

@api_router.get("/stats/fpn/outstanding")
async def get_outstanding_fpns(
    current_user: dict = Depends(get_current_user)
):
    """Get list of outstanding (unpaid) FPNs for follow-up"""
    if current_user["role"] not in [UserRole.MANAGER.value, UserRole.SUPERVISOR.value]:
        raise HTTPException(status_code=403, detail="Only managers and supervisors can view FPN reports")
    
    # Get outstanding FPNs sorted by date issued (oldest first)
    outstanding = await db.cases.find(
        {"fpn_issued": True, "fpn_details.paid": {"$ne": True}},
        {"_id": 0}
    ).sort("fpn_details.date_issued", 1).to_list(1000)
    
    # Calculate days outstanding for each
    today = datetime.now(timezone.utc).date()
    for case in outstanding:
        date_issued = case.get("fpn_details", {}).get("date_issued")
        if date_issued:
            try:
                issued_date = datetime.strptime(date_issued, "%Y-%m-%d").date()
                case["days_outstanding"] = (today - issued_date).days
            except:
                case["days_outstanding"] = None
        else:
            case["days_outstanding"] = None
    
    return outstanding

@api_router.get("/stats/fpn/export-csv")
async def export_fpn_csv(
    current_user: dict = Depends(get_current_user)
):
    """Export FPN data to CSV"""
    if current_user["role"] != UserRole.MANAGER.value:
        raise HTTPException(status_code=403, detail="Only managers can export data")
    
    fpn_cases = await db.cases.find({"fpn_issued": True}, {"_id": 0}).to_list(10000)
    
    import csv
    import io
    
    output = io.StringIO()
    fieldnames = [
        "reference_number", "case_type", "status", "fpn_ref", "date_issued", 
        "fpn_amount", "paid", "date_paid", "pay_reference", "assigned_to_name"
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    
    for case in fpn_cases:
        fpn_details = case.get("fpn_details", {}) or {}
        row = {
            "reference_number": case.get("reference_number"),
            "case_type": case.get("case_type"),
            "status": case.get("status"),
            "fpn_ref": fpn_details.get("fpn_ref"),
            "date_issued": fpn_details.get("date_issued"),
            "fpn_amount": fpn_details.get("fpn_amount"),
            "paid": "Yes" if fpn_details.get("paid") else "No",
            "date_paid": fpn_details.get("date_paid"),
            "pay_reference": fpn_details.get("pay_reference"),
            "assigned_to_name": case.get("assigned_to_name")
        }
        writer.writerow(row)
    
    return {
        "csv_data": output.getvalue(),
        "filename": f"fpn_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    }

# ==================== PERSON ENDPOINTS ====================

def filter_person_for_role(person: dict, user_role: str) -> dict:
    """Filter person fields based on user role - officers see limited info"""
    if user_role == UserRole.MANAGER.value:
        return person
    # Officers and supervisors see limited fields
    return {
        "id": person.get("id"),
        "person_type": person.get("person_type"),
        "title": person.get("title"),
        "first_name": person.get("first_name"),
        "last_name": person.get("last_name"),
        "phone": person.get("phone"),
        "email": person.get("email"),
        "linked_cases": person.get("linked_cases", []),
        "created_at": person.get("created_at")
    }

@api_router.get("/persons")
async def list_persons(
    search: Optional[str] = None,
    person_type: Optional[PersonType] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """List all persons with optional filtering"""
    query = {}
    
    if search:
        query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    if person_type:
        if person_type == PersonType.BOTH:
            query["person_type"] = person_type.value
        else:
            # Include persons of this type OR persons marked as "both"
            query["person_type"] = {"$in": [person_type.value, PersonType.BOTH.value]}
    
    total = await db.persons.count_documents(query)
    persons = await db.persons.find(query, {"_id": 0}).sort("last_name", 1).skip(skip).limit(limit).to_list(limit)
    
    # Filter based on role
    filtered_persons = [filter_person_for_role(p, current_user["role"]) for p in persons]
    
    return {
        "persons": filtered_persons,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.get("/persons/{person_id}")
async def get_person(
    person_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific person by ID"""
    person = await db.persons.find_one({"id": person_id}, {"_id": 0})
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    return filter_person_for_role(person, current_user["role"])

@api_router.post("/persons")
async def create_person(
    person_data: PersonCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new person record"""
    person = Person(
        **person_data.model_dump(),
        created_by=current_user["id"],
        created_by_name=current_user["name"]
    )
    
    doc = person.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.persons.insert_one(doc)
    
    # Create audit log
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()),
        "entity_type": "person",
        "entity_id": person.id,
        "action": "created",
        "details": f"Person {person.first_name} {person.last_name} created as {person.person_type.value}",
        "performed_by": current_user["id"],
        "performed_by_name": current_user["name"],
        "performed_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Fetch the created person without _id
    created = await db.persons.find_one({"id": person.id}, {"_id": 0})
    return filter_person_for_role(created, current_user["role"])

@api_router.put("/persons/{person_id}")
async def update_person(
    person_id: str,
    person_data: PersonUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing person"""
    existing = await db.persons.find_one({"id": person_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Person not found")
    
    # Only managers can update sensitive fields
    if current_user["role"] != UserRole.MANAGER.value:
        allowed_fields = {"phone", "email", "notes"}
        update_data = {k: v for k, v in person_data.model_dump(exclude_unset=True).items() if k in allowed_fields}
    else:
        update_data = {k: v for k, v in person_data.model_dump(exclude_unset=True).items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.persons.update_one({"id": person_id}, {"$set": update_data})
    
    # Create audit log
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()),
        "entity_type": "person",
        "entity_id": person_id,
        "action": "updated",
        "details": f"Person updated: {', '.join(update_data.keys())}",
        "performed_by": current_user["id"],
        "performed_by_name": current_user["name"],
        "performed_at": datetime.now(timezone.utc).isoformat()
    })
    
    updated = await db.persons.find_one({"id": person_id}, {"_id": 0})
    return filter_person_for_role(updated, current_user["role"])

@api_router.delete("/persons/{person_id}")
async def delete_person(
    person_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a person (managers only)"""
    if current_user["role"] != UserRole.MANAGER.value:
        raise HTTPException(status_code=403, detail="Only managers can delete persons")
    
    person = await db.persons.find_one({"id": person_id})
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    # Check if linked to cases
    if person.get("linked_cases"):
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete person linked to {len(person['linked_cases'])} case(s). Unlink from cases first."
        )
    
    await db.persons.delete_one({"id": person_id})
    
    # Create audit log
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()),
        "entity_type": "person",
        "entity_id": person_id,
        "action": "deleted",
        "details": f"Person {person['first_name']} {person['last_name']} deleted",
        "performed_by": current_user["id"],
        "performed_by_name": current_user["name"],
        "performed_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Person deleted successfully"}

@api_router.post("/cases/{case_id}/persons/{person_id}")
async def link_person_to_case(
    case_id: str,
    person_id: str,
    role: PersonType = Query(..., description="Role of person in this case"),
    current_user: dict = Depends(get_current_user)
):
    """Link a person to a case as reporter or offender"""
    case = await db.cases.find_one({"id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    person = await db.persons.find_one({"id": person_id})
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    # Determine field to update on case
    link_field = f"{role.value}_id"
    
    # Update case with person link
    await db.cases.update_one(
        {"id": case_id},
        {"$set": {link_field: person_id, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update person's linked_cases
    linked_cases = person.get("linked_cases", [])
    if case_id not in linked_cases:
        linked_cases.append(case_id)
        await db.persons.update_one(
            {"id": person_id},
            {"$set": {"linked_cases": linked_cases, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    # Update person_type if needed
    current_type = person.get("person_type")
    if role.value != current_type and current_type != PersonType.BOTH.value:
        await db.persons.update_one(
            {"id": person_id},
            {"$set": {"person_type": PersonType.BOTH.value}}
        )
    
    # Create audit logs
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()),
        "case_id": case_id,
        "action": f"{role.value}_linked",
        "details": f"{role.value.title()} linked: {person['first_name']} {person['last_name']}",
        "performed_by": current_user["id"],
        "performed_by_name": current_user["name"],
        "performed_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Person linked as {role.value}"}

@api_router.delete("/cases/{case_id}/persons/{person_id}")
async def unlink_person_from_case(
    case_id: str,
    person_id: str,
    role: PersonType = Query(..., description="Role to unlink"),
    current_user: dict = Depends(get_current_user)
):
    """Unlink a person from a case"""
    case = await db.cases.find_one({"id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    person = await db.persons.find_one({"id": person_id})
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    # Remove link from case
    link_field = f"{role.value}_id"
    await db.cases.update_one(
        {"id": case_id},
        {"$unset": {link_field: ""}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Remove case from person's linked_cases
    linked_cases = person.get("linked_cases", [])
    # Only remove if not linked as another role
    other_role = "offender" if role.value == "reporter" else "reporter"
    other_link = case.get(f"{other_role}_id")
    if other_link != person_id and case_id in linked_cases:
        linked_cases.remove(case_id)
        await db.persons.update_one(
            {"id": person_id},
            {"$set": {"linked_cases": linked_cases, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    # Create audit log
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()),
        "case_id": case_id,
        "action": f"{role.value}_unlinked",
        "details": f"{role.value.title()} unlinked: {person['first_name']} {person['last_name']}",
        "performed_by": current_user["id"],
        "performed_by_name": current_user["name"],
        "performed_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Person unlinked from case"}

@api_router.get("/cases/{case_id}/persons")
async def get_case_persons(
    case_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all persons linked to a case"""
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    result = {"reporter": None, "offender": None}
    
    reporter_id = case.get("reporter_id")
    if reporter_id:
        reporter = await db.persons.find_one({"id": reporter_id}, {"_id": 0})
        if reporter:
            result["reporter"] = filter_person_for_role(reporter, current_user["role"])
    
    offender_id = case.get("offender_id")
    if offender_id:
        offender = await db.persons.find_one({"id": offender_id}, {"_id": 0})
        if offender:
            result["offender"] = filter_person_for_role(offender, current_user["role"])
    
    return result

@api_router.get("/persons/{person_id}/cases")
async def get_person_cases(
    person_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all cases linked to a person"""
    person = await db.persons.find_one({"id": person_id})
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    linked_case_ids = person.get("linked_cases", [])
    if not linked_case_ids:
        return []
    
    cases = await db.cases.find(
        {"id": {"$in": linked_case_ids}},
        {"_id": 0, "id": 1, "reference_number": 1, "case_type": 1, "status": 1, 
         "description": 1, "reporter_id": 1, "offender_id": 1, "created_at": 1}
    ).to_list(100)
    
    # Add role info for each case
    for case in cases:
        case["person_role"] = []
        if case.get("reporter_id") == person_id:
            case["person_role"].append("reporter")
        if case.get("offender_id") == person_id:
            case["person_role"].append("offender")
    
    return cases

# ==================== PERSON MERGE ====================

class PersonMergeRequest(BaseModel):
    primary_person_id: str
    secondary_person_id: str

@api_router.post("/persons/merge")
async def merge_persons(
    merge_request: PersonMergeRequest,
    current_user: dict = Depends(get_current_user)
):
    """Merge two person records - keeps most recent data, managers only"""
    if current_user["role"] != UserRole.MANAGER.value:
        raise HTTPException(status_code=403, detail="Only managers can merge persons")
    
    primary = await db.persons.find_one({"id": merge_request.primary_person_id})
    secondary = await db.persons.find_one({"id": merge_request.secondary_person_id})
    
    if not primary or not secondary:
        raise HTTPException(status_code=404, detail="One or both persons not found")
    
    if primary["id"] == secondary["id"]:
        raise HTTPException(status_code=400, detail="Cannot merge a person with itself")
    
    # Determine which record is more recent
    primary_updated = primary.get("updated_at", primary.get("created_at", ""))
    secondary_updated = secondary.get("updated_at", secondary.get("created_at", ""))
    
    # Merge data - most recent non-empty values win
    merged_data = {}
    fields_to_merge = ["title", "first_name", "last_name", "date_of_birth", "phone", "email", 
                       "id_type", "id_number", "notes", "address"]
    
    for field in fields_to_merge:
        primary_val = primary.get(field)
        secondary_val = secondary.get(field)
        
        # If one is empty, use the other
        if not primary_val and secondary_val:
            merged_data[field] = secondary_val
        elif primary_val and not secondary_val:
            merged_data[field] = primary_val
        elif primary_val and secondary_val:
            # Both have values - use most recent
            if secondary_updated > primary_updated:
                merged_data[field] = secondary_val
            else:
                merged_data[field] = primary_val
    
    # Merge person_type - if either is "both" or they differ, set to "both"
    if primary.get("person_type") != secondary.get("person_type"):
        merged_data["person_type"] = PersonType.BOTH.value
    else:
        merged_data["person_type"] = primary.get("person_type", PersonType.REPORTER.value)
    
    # Merge linked_cases
    primary_cases = set(primary.get("linked_cases", []))
    secondary_cases = set(secondary.get("linked_cases", []))
    merged_cases = list(primary_cases | secondary_cases)
    merged_data["linked_cases"] = merged_cases
    merged_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Update primary person with merged data
    await db.persons.update_one({"id": primary["id"]}, {"$set": merged_data})
    
    # Update all cases that reference secondary person to point to primary
    await db.cases.update_many(
        {"reporter_id": secondary["id"]},
        {"$set": {"reporter_id": primary["id"]}}
    )
    await db.cases.update_many(
        {"offender_id": secondary["id"]},
        {"$set": {"offender_id": primary["id"]}}
    )
    
    # Delete secondary person
    await db.persons.delete_one({"id": secondary["id"]})
    
    # Create audit log
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()),
        "entity_type": "person",
        "entity_id": primary["id"],
        "action": "merged",
        "details": f"Merged {secondary['first_name']} {secondary['last_name']} into {primary['first_name']} {primary['last_name']}",
        "performed_by": current_user["id"],
        "performed_by_name": current_user["name"],
        "performed_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Return updated primary person
    updated = await db.persons.find_one({"id": primary["id"]}, {"_id": 0})
    return {"message": "Persons merged successfully", "merged_person": updated}

# ==================== DUPLICATE VRM DETECTION ====================

@api_router.get("/cases/{case_id}/duplicate-vrm-check")
async def get_case_vrm_duplicates(
    case_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get duplicate VRM cases for a specific case"""
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    case_type = case.get("case_type")
    type_fields = case.get("type_specific_fields", {})
    
    # Get VRM from the appropriate nested field based on case type
    vrm = None
    if case_type == "abandoned_vehicle" and type_fields.get("abandoned_vehicle"):
        vrm = type_fields["abandoned_vehicle"].get("registration_number")
    elif case_type in ["nuisance_vehicle", "nuisance_vehicle_sale", "nuisance_vehicle_repair", "nuisance_vehicle_abandoned"]:
        if type_fields.get("nuisance_vehicle"):
            vrm = type_fields["nuisance_vehicle"].get("registration_number")
    
    # Also check top-level registration_number for backwards compatibility
    if not vrm:
        vrm = type_fields.get("registration_number")
    
    if not vrm:
        return {"duplicates": [], "count": 0, "has_vrm": False}
    
    # Normalize VRM and check for duplicates
    normalized_vrm = vrm.replace(" ", "").upper()
    regex_pattern = "".join([c + r"\s*" for c in normalized_vrm]).rstrip(r"\s*")
    
    # Determine the nested field path based on case type
    if case_type == "abandoned_vehicle":
        vrm_field = "type_specific_fields.abandoned_vehicle.registration_number"
    elif case_type in ["nuisance_vehicle", "nuisance_vehicle_sale", "nuisance_vehicle_repair", "nuisance_vehicle_abandoned"]:
        vrm_field = "type_specific_fields.nuisance_vehicle.registration_number"
    else:
        vrm_field = "type_specific_fields.registration_number"
    
    query = {
        "case_type": case_type,
        vrm_field: {"$regex": f"^{regex_pattern}$", "$options": "i"},
        "id": {"$ne": case_id}  # Exclude current case
    }
    
    duplicates = await db.cases.find(
        query,
        {"_id": 0, "id": 1, "reference_number": 1, "status": 1, "created_at": 1, 
         "location": 1, "description": 1}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "duplicates": duplicates,
        "count": len(duplicates),
        "vrm": normalized_vrm,
        "has_vrm": True
    }

# ==================== CLOSED CASES MAP ====================

@api_router.get("/reports/closed-cases-map")
async def get_closed_cases_for_map(
    days: int = Query(30, description="Number of days to look back"),
    current_user: dict = Depends(get_current_user)
):
    """Get closed cases with location for map display"""
    if current_user["role"] not in [UserRole.MANAGER.value, UserRole.SUPERVISOR.value]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Calculate date threshold
    date_threshold = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Query closed cases with location
    query = {
        "status": CaseStatus.CLOSED.value,
        "updated_at": {"$gte": date_threshold},
        "location.latitude": {"$ne": None},
        "location.longitude": {"$ne": None}
    }
    
    cases = await db.cases.find(
        query,
        {"_id": 0, "id": 1, "reference_number": 1, "case_type": 1, "description": 1,
         "location": 1, "closure_reason": 1, "updated_at": 1, "created_at": 1}
    ).to_list(1000)
    
    # Format for map display
    map_data = []
    for case in cases:
        loc = case.get("location", {})
        if loc.get("latitude") and loc.get("longitude"):
            map_data.append({
                "id": case["id"],
                "reference_number": case["reference_number"],
                "case_type": case["case_type"],
                "description": case.get("description", "")[:100],
                "latitude": loc["latitude"],
                "longitude": loc["longitude"],
                "address": loc.get("address", ""),
                "closure_reason": case.get("closure_reason"),
                "closed_at": case.get("updated_at"),
                "created_at": case.get("created_at")
            })
    
    # Calculate stats for the period
    stats = {
        "total_closed": len(map_data),
        "period_days": days,
        "by_type": {}
    }
    
    for case in map_data:
        case_type = case["case_type"]
        stats["by_type"][case_type] = stats["by_type"].get(case_type, 0) + 1
    
    return {
        "cases": map_data,
        "stats": stats
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
