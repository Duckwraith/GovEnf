"""
Test suite for Persons feature - reporters and offenders management
Tests: Person CRUD, linking/unlinking to cases, role-based visibility
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
MANAGER_CREDENTIALS = {"email": "admin@council.gov.uk", "password": "admin123"}
OFFICER_CREDENTIALS = {"email": "officer@council.gov.uk", "password": "officer123"}

# Test case ID with existing reporter
TEST_CASE_ID = "e155f7db-0e81-4c1b-a43c-9005a042afe0"


class TestPersonsAPI:
    """Test Person endpoints"""
    
    @pytest.fixture(scope="class")
    def manager_token(self):
        """Get manager authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MANAGER_CREDENTIALS)
        if response.status_code != 200:
            pytest.skip(f"Manager login failed: {response.text}")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def officer_token(self):
        """Get officer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=OFFICER_CREDENTIALS)
        if response.status_code != 200:
            pytest.skip(f"Officer login failed: {response.text}")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def manager_session(self, manager_token):
        """Create session with manager auth"""
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {manager_token}",
            "Content-Type": "application/json"
        })
        return session
    
    @pytest.fixture(scope="class")
    def officer_session(self, officer_token):
        """Create session with officer auth"""
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {officer_token}",
            "Content-Type": "application/json"
        })
        return session

    def test_list_persons_endpoint(self, manager_session):
        """Test GET /api/persons returns list of persons"""
        response = manager_session.get(f"{BASE_URL}/api/persons")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "persons" in data, "Response should contain 'persons' key"
        assert isinstance(data["persons"], list), "persons should be a list"
        print(f"Found {len(data['persons'])} persons in database")

    def test_create_person_as_reporter(self, manager_session):
        """Test POST /api/persons creates a new person"""
        person_data = {
            "person_type": "reporter",
            "title": "Mr",
            "first_name": "TEST_Create",
            "last_name": "Person",
            "date_of_birth": "1990-05-15",
            "address": {
                "line1": "123 Test Street",
                "city": "Test City",
                "postcode": "TE1 1ST"
            },
            "phone": "07123456789",
            "email": "test.create@test.com",
            "notes": "Test person created for testing"
        }
        
        response = manager_session.post(f"{BASE_URL}/api/persons", json=person_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        created_person = response.json()
        assert created_person.get("first_name") == "TEST_Create"
        assert created_person.get("last_name") == "Person"
        assert created_person.get("person_type") == "reporter"
        assert created_person.get("id"), "Created person should have an ID"
        
        # Store for cleanup
        self.__class__.created_person_id = created_person["id"]
        print(f"Created person with ID: {created_person['id']}")

    def test_get_person_by_id(self, manager_session):
        """Test GET /api/persons/{id} returns specific person"""
        person_id = getattr(self.__class__, 'created_person_id', None)
        if not person_id:
            pytest.skip("No person created in previous test")
        
        response = manager_session.get(f"{BASE_URL}/api/persons/{person_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        person = response.json()
        assert person.get("id") == person_id
        assert person.get("first_name") == "TEST_Create"
        # Manager should see full details including DOB
        assert person.get("date_of_birth") == "1990-05-15", "Manager should see DOB"
        print(f"Retrieved person: {person.get('first_name')} {person.get('last_name')}")

    def test_officer_sees_limited_person_info(self, officer_session):
        """Test officers see only name, phone, email (not address, DOB, ID)"""
        person_id = getattr(self.__class__, 'created_person_id', None)
        if not person_id:
            pytest.skip("No person created in previous test")
        
        response = officer_session.get(f"{BASE_URL}/api/persons/{person_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        person = response.json()
        # Officer should see basic info
        assert person.get("first_name") == "TEST_Create"
        assert person.get("phone") == "07123456789"
        assert person.get("email") == "test.create@test.com"
        
        # Officer should NOT see sensitive info
        assert person.get("date_of_birth") is None, "Officer should NOT see DOB"
        assert person.get("address") is None, "Officer should NOT see address"
        assert person.get("id_type") is None, "Officer should NOT see ID type"
        print("Officer correctly sees limited person info")

    def test_update_person(self, manager_session):
        """Test PUT /api/persons/{id} updates person"""
        person_id = getattr(self.__class__, 'created_person_id', None)
        if not person_id:
            pytest.skip("No person created in previous test")
        
        update_data = {
            "phone": "07999999999",
            "notes": "Updated notes for testing"
        }
        
        response = manager_session.put(f"{BASE_URL}/api/persons/{person_id}", json=update_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        updated = response.json()
        assert updated.get("phone") == "07999999999"
        print("Person updated successfully")

    def test_search_persons(self, manager_session):
        """Test GET /api/persons?search= filters by name/email/phone"""
        response = manager_session.get(f"{BASE_URL}/api/persons?search=TEST_Create")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert len(data["persons"]) >= 1, "Should find at least 1 person with TEST_Create"
        print(f"Search returned {len(data['persons'])} matching persons")

    def test_filter_persons_by_type(self, manager_session):
        """Test GET /api/persons?person_type= filters by type"""
        response = manager_session.get(f"{BASE_URL}/api/persons?person_type=reporter")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # All returned persons should be reporters or both
        for person in data["persons"]:
            assert person["person_type"] in ["reporter", "both"], f"Unexpected type: {person['person_type']}"
        print(f"Type filter returned {len(data['persons'])} reporters")


class TestCasePersonLinking:
    """Test linking/unlinking persons to cases"""
    
    @pytest.fixture(scope="class")
    def manager_token(self):
        """Get manager authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MANAGER_CREDENTIALS)
        if response.status_code != 200:
            pytest.skip(f"Manager login failed: {response.text}")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def manager_session(self, manager_token):
        """Create session with manager auth"""
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {manager_token}",
            "Content-Type": "application/json"
        })
        return session

    def test_get_case_persons(self, manager_session):
        """Test GET /api/cases/{case_id}/persons returns linked persons"""
        response = manager_session.get(f"{BASE_URL}/api/cases/{TEST_CASE_ID}/persons")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "reporter" in data, "Response should have reporter field"
        assert "offender" in data, "Response should have offender field"
        
        if data.get("reporter"):
            print(f"Case has reporter: {data['reporter'].get('first_name')} {data['reporter'].get('last_name')}")
        else:
            print("Case has no reporter linked")
        
        if data.get("offender"):
            print(f"Case has offender: {data['offender'].get('first_name')} {data['offender'].get('last_name')}")
        else:
            print("Case has no offender linked")

    def test_create_person_for_linking(self, manager_session):
        """Create a test person to link to case"""
        person_data = {
            "person_type": "offender",
            "title": "Mr",
            "first_name": "TEST_Link",
            "last_name": "Offender",
            "phone": "07888888888",
            "email": "test.link@test.com"
        }
        
        response = manager_session.post(f"{BASE_URL}/api/persons", json=person_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        self.__class__.test_person_for_link_id = response.json()["id"]
        print(f"Created test person for linking: {self.__class__.test_person_for_link_id}")

    def test_link_person_to_case_as_offender(self, manager_session):
        """Test POST /api/cases/{case_id}/persons/{person_id}?role=offender"""
        person_id = getattr(self.__class__, 'test_person_for_link_id', None)
        if not person_id:
            pytest.skip("No person created for linking")
        
        response = manager_session.post(
            f"{BASE_URL}/api/cases/{TEST_CASE_ID}/persons/{person_id}?role=offender"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("Person linked to case as offender")
        
        # Verify link was created
        check_response = manager_session.get(f"{BASE_URL}/api/cases/{TEST_CASE_ID}/persons")
        assert check_response.status_code == 200
        
        case_persons = check_response.json()
        assert case_persons.get("offender") is not None, "Case should have offender linked"
        assert case_persons["offender"]["id"] == person_id
        print("Verified offender is linked to case")

    def test_person_linked_cases_count_updated(self, manager_session):
        """Test that person's linked_cases list is updated when linked to a case"""
        person_id = getattr(self.__class__, 'test_person_for_link_id', None)
        if not person_id:
            pytest.skip("No person created for linking")
        
        response = manager_session.get(f"{BASE_URL}/api/persons/{person_id}")
        assert response.status_code == 200
        
        person = response.json()
        assert TEST_CASE_ID in person.get("linked_cases", []), "Case should be in person's linked_cases"
        print(f"Person has {len(person.get('linked_cases', []))} linked cases")

    def test_get_person_cases(self, manager_session):
        """Test GET /api/persons/{person_id}/cases returns linked cases"""
        person_id = getattr(self.__class__, 'test_person_for_link_id', None)
        if not person_id:
            pytest.skip("No person created for linking")
        
        response = manager_session.get(f"{BASE_URL}/api/persons/{person_id}/cases")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        cases = response.json()
        assert isinstance(cases, list)
        assert len(cases) >= 1, "Should have at least 1 linked case"
        
        # Verify the case is in the list
        case_ids = [c["id"] for c in cases]
        assert TEST_CASE_ID in case_ids
        
        # Verify role info is included
        for case in cases:
            if case["id"] == TEST_CASE_ID:
                assert "offender" in case.get("person_role", [])
                print(f"Case {case['reference_number']} has roles: {case['person_role']}")

    def test_unlink_person_from_case(self, manager_session):
        """Test DELETE /api/cases/{case_id}/persons/{person_id}?role=offender"""
        person_id = getattr(self.__class__, 'test_person_for_link_id', None)
        if not person_id:
            pytest.skip("No person created for linking")
        
        response = manager_session.delete(
            f"{BASE_URL}/api/cases/{TEST_CASE_ID}/persons/{person_id}?role=offender"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("Person unlinked from case")
        
        # Verify unlink worked
        check_response = manager_session.get(f"{BASE_URL}/api/cases/{TEST_CASE_ID}/persons")
        assert check_response.status_code == 200
        
        case_persons = check_response.json()
        assert case_persons.get("offender") is None, "Case should NOT have offender after unlink"
        print("Verified offender is no longer linked to case")


class TestPersonDeletion:
    """Test person deletion and constraints"""
    
    @pytest.fixture(scope="class")
    def manager_token(self):
        """Get manager authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MANAGER_CREDENTIALS)
        if response.status_code != 200:
            pytest.skip(f"Manager login failed: {response.text}")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def officer_token(self):
        """Get officer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=OFFICER_CREDENTIALS)
        if response.status_code != 200:
            pytest.skip(f"Officer login failed: {response.text}")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def manager_session(self, manager_token):
        """Create session with manager auth"""
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {manager_token}",
            "Content-Type": "application/json"
        })
        return session
    
    @pytest.fixture(scope="class")
    def officer_session(self, officer_token):
        """Create session with officer auth"""
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {officer_token}",
            "Content-Type": "application/json"
        })
        return session

    def test_officer_cannot_delete_person(self, officer_session, manager_session):
        """Test that officers cannot delete persons"""
        # First create a person to attempt deletion
        person_data = {
            "person_type": "reporter",
            "first_name": "TEST_OfficerDelete",
            "last_name": "Test"
        }
        create_response = manager_session.post(f"{BASE_URL}/api/persons", json=person_data)
        assert create_response.status_code == 200
        person_id = create_response.json()["id"]
        
        # Try to delete as officer
        delete_response = officer_session.delete(f"{BASE_URL}/api/persons/{person_id}")
        assert delete_response.status_code == 403, f"Expected 403, got {delete_response.status_code}"
        print("Officers correctly cannot delete persons")
        
        # Cleanup - delete as manager
        manager_session.delete(f"{BASE_URL}/api/persons/{person_id}")

    def test_delete_person_success(self, manager_session):
        """Test manager can delete unlinked person"""
        # Create person for deletion
        person_data = {
            "person_type": "reporter",
            "first_name": "TEST_Delete",
            "last_name": "Me"
        }
        create_response = manager_session.post(f"{BASE_URL}/api/persons", json=person_data)
        assert create_response.status_code == 200
        person_id = create_response.json()["id"]
        
        # Delete the person
        delete_response = manager_session.delete(f"{BASE_URL}/api/persons/{person_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        print("Person deleted successfully")
        
        # Verify person is gone
        get_response = manager_session.get(f"{BASE_URL}/api/persons/{person_id}")
        assert get_response.status_code == 404


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def manager_token(self):
        """Get manager authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MANAGER_CREDENTIALS)
        if response.status_code != 200:
            pytest.skip(f"Manager login failed: {response.text}")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def manager_session(self, manager_token):
        """Create session with manager auth"""
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {manager_token}",
            "Content-Type": "application/json"
        })
        return session

    def test_cleanup_test_persons(self, manager_session):
        """Clean up all TEST_ prefixed persons"""
        response = manager_session.get(f"{BASE_URL}/api/persons?search=TEST_")
        if response.status_code != 200:
            print("Could not fetch persons for cleanup")
            return
        
        persons = response.json().get("persons", [])
        deleted_count = 0
        for person in persons:
            if person["first_name"].startswith("TEST_"):
                # Check if linked to cases
                if not person.get("linked_cases"):
                    delete_resp = manager_session.delete(f"{BASE_URL}/api/persons/{person['id']}")
                    if delete_resp.status_code == 200:
                        deleted_count += 1
        
        print(f"Cleaned up {deleted_count} test persons")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
