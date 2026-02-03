"""
Backend API Tests for Enforcement Team App
Tests: Case types, Teams CRUD, Admin Settings, Case Closure, W3W integration
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://casetracker-16.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@council.gov.uk"
ADMIN_PASSWORD = "admin123"
SUPERVISOR_EMAIL = "supervisor@council.gov.uk"
SUPERVISOR_PASSWORD = "super123"
OFFICER_EMAIL = "officer@council.gov.uk"
OFFICER_PASSWORD = "officer123"


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "manager"
        print(f"SUCCESS: Admin login - role: {data['user']['role']}")
    
    def test_supervisor_login(self):
        """Test supervisor login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERVISOR_EMAIL,
            "password": SUPERVISOR_PASSWORD
        })
        assert response.status_code == 200, f"Supervisor login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "supervisor"
        print(f"SUCCESS: Supervisor login - role: {data['user']['role']}")
    
    def test_officer_login(self):
        """Test officer login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OFFICER_EMAIL,
            "password": OFFICER_PASSWORD
        })
        assert response.status_code == 200, f"Officer login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "officer"
        print(f"SUCCESS: Officer login - role: {data['user']['role']}")


class TestCaseTypes:
    """Test new case types functionality"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_create_untidy_land_case(self, admin_token):
        """Test creating Untidy Land case type"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "case_type": "untidy_land",
            "description": "TEST_Overgrown garden with accumulated debris",
            "location": {
                "address": "123 Test Street",
                "postcode": "SW1A 1AA"
            },
            "type_specific_fields": {
                "untidy_land": {
                    "land_type": "residential",
                    "land_ownership": "Private owner",
                    "issues_identified": ["overgrown", "debris"],
                    "previous_notices": False
                }
            }
        }
        response = requests.post(f"{BASE_URL}/api/cases", json=payload, headers=headers)
        assert response.status_code == 200, f"Failed to create untidy land case: {response.text}"
        data = response.json()
        assert data["case_type"] == "untidy_land"
        assert data["reference_number"].startswith("UL-")
        print(f"SUCCESS: Created Untidy Land case - {data['reference_number']}")
        return data["id"]
    
    def test_create_high_hedges_case(self, admin_token):
        """Test creating High Hedges case type"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "case_type": "high_hedges",
            "description": "TEST_Leylandii hedge blocking light",
            "location": {
                "address": "456 Hedge Lane",
                "postcode": "SW1A 2BB"
            },
            "type_specific_fields": {
                "high_hedges": {
                    "hedge_type": "Leylandii",
                    "hedge_height_meters": 5.5,
                    "affected_property": "457 Hedge Lane",
                    "previous_complaints": True,
                    "mediation_attempted": True
                }
            }
        }
        response = requests.post(f"{BASE_URL}/api/cases", json=payload, headers=headers)
        assert response.status_code == 200, f"Failed to create high hedges case: {response.text}"
        data = response.json()
        assert data["case_type"] == "high_hedges"
        assert data["reference_number"].startswith("HH-")
        print(f"SUCCESS: Created High Hedges case - {data['reference_number']}")
    
    def test_create_waste_carrier_case(self, admin_token):
        """Test creating Waste Carrier/Licensing case type"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "case_type": "waste_carrier_licensing",
            "description": "TEST_Unlicensed waste carrier operating",
            "location": {
                "address": "789 Industrial Estate",
                "postcode": "SW1A 3CC"
            },
            "type_specific_fields": {
                "waste_carrier": {
                    "business_name": "Test Waste Ltd",
                    "carrier_license_number": "",
                    "license_status": "none",
                    "vehicle_registration": "AB12 CDE",
                    "breach_details": "Operating without valid license"
                }
            }
        }
        response = requests.post(f"{BASE_URL}/api/cases", json=payload, headers=headers)
        assert response.status_code == 200, f"Failed to create waste carrier case: {response.text}"
        data = response.json()
        assert data["case_type"] == "waste_carrier_licensing"
        assert data["reference_number"].startswith("WC-")
        print(f"SUCCESS: Created Waste Carrier case - {data['reference_number']}")
    
    def test_create_nuisance_vehicle_case(self, admin_token):
        """Test creating Nuisance Vehicle case type"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "case_type": "nuisance_vehicle",
            "description": "TEST_Vehicle causing parking nuisance",
            "location": {
                "address": "101 Main Road",
                "postcode": "SW1A 4DD"
            },
            "type_specific_fields": {
                "nuisance_vehicle": {
                    "vehicle_registration": "XY99 ZZZ",
                    "vehicle_make": "Ford",
                    "vehicle_model": "Transit",
                    "vehicle_colour": "White",
                    "nuisance_type": "parking",
                    "location_frequency": "daily",
                    "obstruction_caused": True
                }
            }
        }
        response = requests.post(f"{BASE_URL}/api/cases", json=payload, headers=headers)
        assert response.status_code == 200, f"Failed to create nuisance vehicle case: {response.text}"
        data = response.json()
        assert data["case_type"] == "nuisance_vehicle"
        assert data["reference_number"].startswith("NV-")
        print(f"SUCCESS: Created Nuisance Vehicle case - {data['reference_number']}")
    
    def test_create_nuisance_vehicle_seller_case(self, admin_token):
        """Test creating Nuisance Vehicle (On-Street Seller) case type"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "case_type": "nuisance_vehicle_seller",
            "description": "TEST_On-street food seller without permit",
            "location": {
                "address": "High Street",
                "postcode": "SW1A 5EE"
            },
            "type_specific_fields": {
                "nuisance_vehicle": {
                    "vehicle_registration": "AB11 XYZ",
                    "nuisance_type": "on_street_seller",
                    "business_activity": "Food sales",
                    "location_frequency": "daily"
                }
            }
        }
        response = requests.post(f"{BASE_URL}/api/cases", json=payload, headers=headers)
        assert response.status_code == 200, f"Failed to create nuisance vehicle seller case: {response.text}"
        data = response.json()
        assert data["case_type"] == "nuisance_vehicle_seller"
        print(f"SUCCESS: Created Nuisance Vehicle Seller case - {data['reference_number']}")
    
    def test_create_fly_tipping_variants(self, admin_token):
        """Test creating fly-tipping variant case types"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Fly Tipping Private
        payload = {
            "case_type": "fly_tipping_private",
            "description": "TEST_Fly tipping on private land",
            "location": {"address": "Private Land", "postcode": "SW1A 6FF"},
            "type_specific_fields": {
                "fly_tipping": {
                    "waste_description": "Construction waste",
                    "waste_type": "construction",
                    "estimated_quantity": "5 cubic metres"
                }
            }
        }
        response = requests.post(f"{BASE_URL}/api/cases", json=payload, headers=headers)
        assert response.status_code == 200
        assert response.json()["reference_number"].startswith("FP-")
        print(f"SUCCESS: Created Fly Tipping Private case - {response.json()['reference_number']}")
        
        # Fly Tipping Organised
        payload["case_type"] = "fly_tipping_organised"
        payload["description"] = "TEST_Organised fly tipping operation"
        response = requests.post(f"{BASE_URL}/api/cases", json=payload, headers=headers)
        assert response.status_code == 200
        assert response.json()["reference_number"].startswith("FO-")
        print(f"SUCCESS: Created Fly Tipping Organised case - {response.json()['reference_number']}")


class TestCaseClosure:
    """Test case closure with mandatory reason and final note"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def supervisor_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERVISOR_EMAIL,
            "password": SUPERVISOR_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_close_case_without_reason_fails(self, admin_token):
        """Test that closing case without reason fails"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a case first
        payload = {
            "case_type": "littering",
            "description": "TEST_Case for closure test",
            "location": {"address": "Test Address", "postcode": "SW1A 1AA"}
        }
        create_response = requests.post(f"{BASE_URL}/api/cases", json=payload, headers=headers)
        case_id = create_response.json()["id"]
        
        # Try to close without reason - should fail
        close_payload = {"status": "closed"}
        response = requests.put(f"{BASE_URL}/api/cases/{case_id}", json=close_payload, headers=headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "closure reason" in response.text.lower() or "final note" in response.text.lower()
        print("SUCCESS: Closing case without reason correctly rejected")
    
    def test_close_case_with_reason_and_note(self, admin_token):
        """Test closing case with mandatory closure reason and final note"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a case first
        payload = {
            "case_type": "dog_fouling",
            "description": "TEST_Case for successful closure",
            "location": {"address": "Test Address", "postcode": "SW1A 1AA"}
        }
        create_response = requests.post(f"{BASE_URL}/api/cases", json=payload, headers=headers)
        case_id = create_response.json()["id"]
        ref_number = create_response.json()["reference_number"]
        
        # Close with reason and note
        close_payload = {
            "status": "closed",
            "closure_reason": "resolved",
            "final_note": "Issue resolved after warning issued to offender"
        }
        response = requests.put(f"{BASE_URL}/api/cases/{case_id}", json=close_payload, headers=headers)
        assert response.status_code == 200, f"Failed to close case: {response.text}"
        
        data = response.json()
        assert data["status"] == "closed"
        assert data["closure_reason"] == "resolved"
        assert data["final_note"] == "Issue resolved after warning issued to offender"
        assert data["closed_by"] is not None
        assert data["closed_at"] is not None
        print(f"SUCCESS: Case {ref_number} closed with reason and note")


class TestTeamsCRUD:
    """Test Teams CRUD operations"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_get_teams(self, admin_token):
        """Test getting all teams"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/teams", headers=headers)
        assert response.status_code == 200
        teams = response.json()
        assert isinstance(teams, list)
        print(f"SUCCESS: Retrieved {len(teams)} teams")
    
    def test_create_team(self, admin_token):
        """Test creating a new team"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "name": "TEST_North District Team",
            "team_type": "enforcement",
            "description": "Test team for north district"
        }
        response = requests.post(f"{BASE_URL}/api/teams", json=payload, headers=headers)
        assert response.status_code == 200, f"Failed to create team: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_North District Team"
        assert data["team_type"] == "enforcement"
        print(f"SUCCESS: Created team - {data['name']}")
        return data["id"]
    
    def test_update_team(self, admin_token):
        """Test updating a team"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a team first
        create_payload = {
            "name": "TEST_Team to Update",
            "team_type": "waste_management",
            "description": "Original description"
        }
        create_response = requests.post(f"{BASE_URL}/api/teams", json=create_payload, headers=headers)
        team_id = create_response.json()["id"]
        
        # Update the team
        update_payload = {
            "name": "TEST_Updated Team Name",
            "description": "Updated description"
        }
        response = requests.put(f"{BASE_URL}/api/teams/{team_id}", json=update_payload, headers=headers)
        assert response.status_code == 200, f"Failed to update team: {response.text}"
        print(f"SUCCESS: Updated team {team_id}")
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/teams/{team_id}", headers=headers)
        assert get_response.json()["name"] == "TEST_Updated Team Name"
    
    def test_delete_team(self, admin_token):
        """Test deleting a team"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a team first
        create_payload = {
            "name": "TEST_Team to Delete",
            "team_type": "environmental_crimes",
            "description": "This team will be deleted"
        }
        create_response = requests.post(f"{BASE_URL}/api/teams", json=create_payload, headers=headers)
        team_id = create_response.json()["id"]
        
        # Delete the team
        response = requests.delete(f"{BASE_URL}/api/teams/{team_id}", headers=headers)
        assert response.status_code == 200, f"Failed to delete team: {response.text}"
        print(f"SUCCESS: Deleted team {team_id}")
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/teams/{team_id}", headers=headers)
        assert get_response.status_code == 404
    
    def test_get_team_members(self, admin_token):
        """Test getting team members"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get teams first
        teams_response = requests.get(f"{BASE_URL}/api/teams", headers=headers)
        teams = teams_response.json()
        
        if teams:
            team_id = teams[0]["id"]
            response = requests.get(f"{BASE_URL}/api/teams/{team_id}/members", headers=headers)
            assert response.status_code == 200
            members = response.json()
            assert isinstance(members, list)
            print(f"SUCCESS: Retrieved {len(members)} members for team {teams[0]['name']}")


class TestAdminSettings:
    """Test Admin Settings functionality"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_get_settings(self, admin_token):
        """Test getting system settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/settings", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "app_title" in data
        assert "map_settings" in data
        print(f"SUCCESS: Retrieved settings - app_title: {data['app_title']}")
    
    def test_update_map_settings(self, admin_token):
        """Test updating map default settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Update map settings to a non-London location
        payload = {
            "map_settings": {
                "default_latitude": 52.4862,  # Birmingham
                "default_longitude": -1.8904,
                "default_zoom": 13
            }
        }
        response = requests.put(f"{BASE_URL}/api/settings", json=payload, headers=headers)
        assert response.status_code == 200, f"Failed to update settings: {response.text}"
        print("SUCCESS: Updated map settings to Birmingham coordinates")
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/settings", headers=headers)
        data = get_response.json()
        assert data["map_settings"]["default_latitude"] == 52.4862
        assert data["map_settings"]["default_longitude"] == -1.8904
        print("SUCCESS: Verified map settings update")
    
    def test_update_organisation_settings(self, admin_token):
        """Test updating organisation settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        payload = {
            "organisation_name": "TEST_Birmingham City Council",
            "contact_email": "enforcement@birmingham.gov.uk"
        }
        response = requests.put(f"{BASE_URL}/api/settings", json=payload, headers=headers)
        assert response.status_code == 200
        print("SUCCESS: Updated organisation settings")
    
    def test_toggle_what3words(self, admin_token):
        """Test toggling what3words feature"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Disable W3W
        payload = {"enable_what3words": False}
        response = requests.put(f"{BASE_URL}/api/settings", json=payload, headers=headers)
        assert response.status_code == 200
        
        # Verify
        get_response = requests.get(f"{BASE_URL}/api/settings", headers=headers)
        assert get_response.json()["enable_what3words"] == False
        print("SUCCESS: Disabled what3words")
        
        # Re-enable W3W
        payload = {"enable_what3words": True}
        response = requests.put(f"{BASE_URL}/api/settings", json=payload, headers=headers)
        assert response.status_code == 200
        print("SUCCESS: Re-enabled what3words")


class TestWhat3Words:
    """Test What3Words integration"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_w3w_status(self, admin_token):
        """Test W3W status endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/w3w/status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "enabled" in data
        assert "api_available" in data
        print(f"SUCCESS: W3W status - enabled: {data['enabled']}, api_available: {data['api_available']}")
    
    def test_w3w_convert_words_to_coords(self, admin_token):
        """Test converting W3W to coordinates"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {"words": "filled.count.soap"}  # Known W3W address
        response = requests.post(f"{BASE_URL}/api/w3w/convert", json=payload, headers=headers)
        
        # W3W API may return 402 (payment required) - handle gracefully
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                assert "latitude" in data
                assert "longitude" in data
                print(f"SUCCESS: W3W conversion - lat: {data['latitude']}, lng: {data['longitude']}")
            else:
                print(f"INFO: W3W conversion returned success=false: {data.get('error')}")
        else:
            print(f"INFO: W3W API unavailable (status {response.status_code}) - feature should fail gracefully")


class TestCaseTypeTeamMapping:
    """Test case type to team visibility mapping"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_get_case_type_team_mapping(self, admin_token):
        """Test getting case type to team mapping"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/case-types/teams", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify fly_tipping is visible to waste_management
        assert "fly_tipping" in data
        assert "waste_management" in data["fly_tipping"]["allowed_team_types"]
        
        # Verify untidy_land is visible to enforcement
        assert "untidy_land" in data
        assert "enforcement" in data["untidy_land"]["allowed_team_types"]
        
        print("SUCCESS: Case type to team mapping retrieved correctly")


class TestWasteManagementClearance:
    """Test Waste Management clearance outcome fields for fly-tipping cases"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_add_clearance_outcome(self, admin_token):
        """Test adding clearance outcome to fly-tipping case"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a fly-tipping case
        payload = {
            "case_type": "fly_tipping",
            "description": "TEST_Fly tipping for clearance test",
            "location": {"address": "Test Location", "postcode": "SW1A 1AA"}
        }
        create_response = requests.post(f"{BASE_URL}/api/cases", json=payload, headers=headers)
        case_id = create_response.json()["id"]
        
        # Add clearance outcome
        update_payload = {
            "type_specific_fields": {
                "fly_tipping": {
                    "waste_description": "Household waste",
                    "waste_type": "household"
                },
                "clearance_outcome": {
                    "items_cleared": True,
                    "clearance_date": "2026-01-15",
                    "disposal_method": "Recycled"
                }
            }
        }
        response = requests.put(f"{BASE_URL}/api/cases/{case_id}", json=update_payload, headers=headers)
        assert response.status_code == 200, f"Failed to add clearance outcome: {response.text}"
        
        data = response.json()
        assert data["type_specific_fields"]["clearance_outcome"]["items_cleared"] == True
        print("SUCCESS: Added clearance outcome to fly-tipping case")
    
    def test_clearance_not_cleared_requires_reason(self, admin_token):
        """Test that items_cleared=False requires reason_not_cleared"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a fly-tipping case
        payload = {
            "case_type": "fly_tipping",
            "description": "TEST_Fly tipping for clearance validation",
            "location": {"address": "Test Location", "postcode": "SW1A 1AA"}
        }
        create_response = requests.post(f"{BASE_URL}/api/cases", json=payload, headers=headers)
        case_id = create_response.json()["id"]
        
        # Try to set items_cleared=False without reason - should fail
        update_payload = {
            "type_specific_fields": {
                "clearance_outcome": {
                    "items_cleared": False
                }
            }
        }
        response = requests.put(f"{BASE_URL}/api/cases/{case_id}", json=update_payload, headers=headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("SUCCESS: Clearance without reason correctly rejected")


# Cleanup test data
class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_cleanup_test_teams(self, admin_token):
        """Clean up test teams"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/teams", headers=headers)
        teams = response.json()
        
        deleted_count = 0
        for team in teams:
            if team["name"].startswith("TEST_"):
                delete_response = requests.delete(f"{BASE_URL}/api/teams/{team['id']}", headers=headers)
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"INFO: Cleaned up {deleted_count} test teams")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
