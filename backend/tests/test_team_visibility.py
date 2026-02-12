"""
Test suite for Team-Based Case Visibility Rules
Tests: Officer visibility filtering by team/case_type, Manager/Supervisor full access,
       /api/case-types/my-visibility endpoint, /api/stats/overview filtering,
       Individual case access restrictions
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Credentials for different roles
CREDENTIALS = {
    "manager": {"email": "admin@council.gov.uk", "password": "admin123"},
    "supervisor": {"email": "supervisor@council.gov.uk", "password": "super123"},
    "env_crimes_officer": {"email": "officer.envcrimes@council.gov.uk", "password": "officer123"},
    "enforcement_officer": {"email": "officer.enforcement@council.gov.uk", "password": "officer123"},
    "waste_officer": {"email": "officer.waste@council.gov.uk", "password": "officer123"},
}

# Expected visible case types per team
ENV_CRIMES_TYPES = ["fly_tipping", "abandoned_vehicle", "littering", "dog_fouling", "pspo_dog_control"]
ENFORCEMENT_TYPES = ["fly_tipping_private", "fly_tipping_organised", "nuisance_vehicle", 
                     "nuisance_vehicle_seller", "nuisance_vehicle_parking", "nuisance_vehicle_asb",
                     "untidy_land", "high_hedges", "waste_carrier_licensing", "complex_environmental"]
WASTE_MGMT_TYPES = ["fly_tipping", "littering"]


@pytest.fixture(scope="module")
def session():
    """Shared requests session"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def manager_token(session):
    """Get manager auth token"""
    resp = session.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["manager"])
    assert resp.status_code == 200, f"Manager login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def supervisor_token(session):
    """Get supervisor auth token"""
    resp = session.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["supervisor"])
    assert resp.status_code == 200, f"Supervisor login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def env_crimes_token(session):
    """Get env crimes officer auth token"""
    resp = session.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["env_crimes_officer"])
    assert resp.status_code == 200, f"Env crimes officer login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def enforcement_token(session):
    """Get enforcement officer auth token"""
    resp = session.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["enforcement_officer"])
    assert resp.status_code == 200, f"Enforcement officer login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def waste_token(session):
    """Get waste management officer auth token"""
    resp = session.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["waste_officer"])
    assert resp.status_code == 200, f"Waste officer login failed: {resp.text}"
    return resp.json()["access_token"]


class TestCaseTypesMyVisibilityEndpoint:
    """Test /api/case-types/my-visibility returns correct case types for each role"""
    
    def test_manager_sees_all_types(self, session, manager_token):
        """Manager should see all case types (all_types_visible=true)"""
        resp = session.get(
            f"{BASE_URL}/api/case-types/my-visibility",
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["all_types_visible"] is True
        assert data["visible_case_types"] is None
        assert data["user_role"] == "manager"
    
    def test_supervisor_sees_all_types(self, session, supervisor_token):
        """Supervisor should see all case types"""
        resp = session.get(
            f"{BASE_URL}/api/case-types/my-visibility",
            headers={"Authorization": f"Bearer {supervisor_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["all_types_visible"] is True
        assert data["visible_case_types"] is None
        assert data["user_role"] == "supervisor"
    
    def test_env_crimes_officer_visibility(self, session, env_crimes_token):
        """Environmental Crimes officer should see specific case types"""
        resp = session.get(
            f"{BASE_URL}/api/case-types/my-visibility",
            headers={"Authorization": f"Bearer {env_crimes_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["all_types_visible"] is False
        assert data["user_role"] == "officer"
        
        visible_types = set(data["visible_case_types"])
        expected_types = set(ENV_CRIMES_TYPES)
        assert visible_types == expected_types, f"Expected {expected_types}, got {visible_types}"
        
        # Verify team info
        teams = data["user_teams"]
        assert len(teams) == 1
        assert teams[0]["team_type"] == "environmental_crimes"
    
    def test_enforcement_officer_visibility(self, session, enforcement_token):
        """Enforcement officer should see specific case types"""
        resp = session.get(
            f"{BASE_URL}/api/case-types/my-visibility",
            headers={"Authorization": f"Bearer {enforcement_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["all_types_visible"] is False
        assert data["user_role"] == "officer"
        
        visible_types = set(data["visible_case_types"])
        expected_types = set(ENFORCEMENT_TYPES)
        assert visible_types == expected_types, f"Expected {expected_types}, got {visible_types}"
        
        teams = data["user_teams"]
        assert len(teams) == 1
        assert teams[0]["team_type"] == "enforcement"
    
    def test_waste_officer_visibility(self, session, waste_token):
        """Waste Management officer should see only fly_tipping and littering"""
        resp = session.get(
            f"{BASE_URL}/api/case-types/my-visibility",
            headers={"Authorization": f"Bearer {waste_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["all_types_visible"] is False
        assert data["user_role"] == "officer"
        
        visible_types = set(data["visible_case_types"])
        expected_types = set(WASTE_MGMT_TYPES)
        assert visible_types == expected_types, f"Expected {expected_types}, got {visible_types}"


class TestCasesListFiltering:
    """Test that /api/cases returns filtered results based on team visibility"""
    
    def test_manager_sees_all_cases(self, session, manager_token):
        """Manager should see all 34 cases across all types"""
        resp = session.get(
            f"{BASE_URL}/api/cases",
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        assert resp.status_code == 200
        cases = resp.json()
        # Manager sees all cases - check for diverse case types
        case_types = set(c["case_type"] for c in cases)
        assert len(case_types) > 5, "Manager should see many case types"
        assert "fly_tipping_organised" in case_types or "fly_tipping_private" in case_types
    
    def test_env_crimes_officer_filtered_cases(self, session, env_crimes_token):
        """Env crimes officer should only see their team's case types"""
        resp = session.get(
            f"{BASE_URL}/api/cases",
            headers={"Authorization": f"Bearer {env_crimes_token}"}
        )
        assert resp.status_code == 200
        cases = resp.json()
        
        # Verify all returned cases are in allowed types
        for case in cases:
            assert case["case_type"] in ENV_CRIMES_TYPES, \
                f"Env crimes officer should not see {case['case_type']}"
        
        # Should NOT see enforcement-only types
        case_types = set(c["case_type"] for c in cases)
        assert "fly_tipping_organised" not in case_types
        assert "nuisance_vehicle" not in case_types
        assert "high_hedges" not in case_types
    
    def test_enforcement_officer_filtered_cases(self, session, enforcement_token):
        """Enforcement officer should only see their team's case types"""
        resp = session.get(
            f"{BASE_URL}/api/cases",
            headers={"Authorization": f"Bearer {enforcement_token}"}
        )
        assert resp.status_code == 200
        cases = resp.json()
        
        # Verify all returned cases are in allowed types
        for case in cases:
            assert case["case_type"] in ENFORCEMENT_TYPES, \
                f"Enforcement officer should not see {case['case_type']}"
        
        # Should NOT see env crimes-only types
        case_types = set(c["case_type"] for c in cases)
        assert "abandoned_vehicle" not in case_types
        assert "dog_fouling" not in case_types
        assert "pspo_dog_control" not in case_types
    
    def test_waste_officer_filtered_cases(self, session, waste_token):
        """Waste officer should only see fly_tipping and littering"""
        resp = session.get(
            f"{BASE_URL}/api/cases",
            headers={"Authorization": f"Bearer {waste_token}"}
        )
        assert resp.status_code == 200
        cases = resp.json()
        
        # Should only see fly_tipping and littering
        case_types = set(c["case_type"] for c in cases)
        allowed = {"fly_tipping", "littering"}
        assert case_types.issubset(allowed), f"Waste officer should only see {allowed}, got {case_types}"


class TestStatsOverviewFiltering:
    """Test that /api/stats/overview returns filtered stats for officers"""
    
    def test_manager_stats_all_cases(self, session, manager_token):
        """Manager stats should include all case types"""
        resp = session.get(
            f"{BASE_URL}/api/stats/overview",
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        assert resp.status_code == 200
        stats = resp.json()
        
        # Manager should see total of 34 cases
        assert stats["total_cases"] >= 30, "Manager should see many cases"
        assert "fly_tipping_organised" in stats["cases_by_type"] or \
               "fly_tipping_private" in stats["cases_by_type"], \
               "Manager should see enforcement case types"
    
    def test_env_crimes_stats_filtered(self, session, env_crimes_token):
        """Env crimes officer stats should only include visible case types"""
        resp = session.get(
            f"{BASE_URL}/api/stats/overview",
            headers={"Authorization": f"Bearer {env_crimes_token}"}
        )
        assert resp.status_code == 200
        stats = resp.json()
        
        # Verify case types in stats
        for case_type in stats["cases_by_type"].keys():
            assert case_type in ENV_CRIMES_TYPES, \
                f"Env crimes stats should not include {case_type}"
    
    def test_waste_stats_filtered(self, session, waste_token):
        """Waste officer stats should only include fly_tipping and littering"""
        resp = session.get(
            f"{BASE_URL}/api/stats/overview",
            headers={"Authorization": f"Bearer {waste_token}"}
        )
        assert resp.status_code == 200
        stats = resp.json()
        
        # Should only have fly_tipping and littering
        for case_type in stats["cases_by_type"].keys():
            assert case_type in WASTE_MGMT_TYPES, \
                f"Waste stats should not include {case_type}"


class TestIndividualCaseAccess:
    """Test that officers are blocked from viewing case types outside their team's visibility"""
    
    def test_env_crimes_blocked_from_enforcement_case(self, session, manager_token, env_crimes_token):
        """Env crimes officer should get 403 when accessing fly_tipping_organised case"""
        # Get a fly_tipping_organised case ID using manager token
        resp = session.get(
            f"{BASE_URL}/api/cases?case_type=fly_tipping_organised",
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        assert resp.status_code == 200
        cases = resp.json()
        if not cases:
            pytest.skip("No fly_tipping_organised cases in database")
        
        case_id = cases[0]["id"]
        
        # Try to access with env crimes officer
        resp = session.get(
            f"{BASE_URL}/api/cases/{case_id}",
            headers={"Authorization": f"Bearer {env_crimes_token}"}
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
        assert "not authorized" in resp.json()["detail"].lower()
    
    def test_waste_blocked_from_abandoned_vehicle(self, session, manager_token, waste_token):
        """Waste officer should get 403 when accessing abandoned_vehicle case"""
        # Get an abandoned_vehicle case ID
        resp = session.get(
            f"{BASE_URL}/api/cases?case_type=abandoned_vehicle",
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        assert resp.status_code == 200
        cases = resp.json()
        if not cases:
            pytest.skip("No abandoned_vehicle cases in database")
        
        case_id = cases[0]["id"]
        
        # Try to access with waste officer
        resp = session.get(
            f"{BASE_URL}/api/cases/{case_id}",
            headers={"Authorization": f"Bearer {waste_token}"}
        )
        assert resp.status_code == 403
        assert "not authorized" in resp.json()["detail"].lower()
    
    def test_enforcement_blocked_from_abandoned_vehicle(self, session, manager_token, enforcement_token):
        """Enforcement officer should get 403 when accessing abandoned_vehicle case"""
        resp = session.get(
            f"{BASE_URL}/api/cases?case_type=abandoned_vehicle",
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        assert resp.status_code == 200
        cases = resp.json()
        if not cases:
            pytest.skip("No abandoned_vehicle cases in database")
        
        case_id = cases[0]["id"]
        
        resp = session.get(
            f"{BASE_URL}/api/cases/{case_id}",
            headers={"Authorization": f"Bearer {enforcement_token}"}
        )
        assert resp.status_code == 403
    
    def test_env_crimes_can_access_fly_tipping(self, session, manager_token, env_crimes_token):
        """Env crimes officer should be able to access fly_tipping case"""
        resp = session.get(
            f"{BASE_URL}/api/cases?case_type=fly_tipping",
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        assert resp.status_code == 200
        cases = resp.json()
        if not cases:
            pytest.skip("No fly_tipping cases in database")
        
        # Find an unassigned case
        unassigned = [c for c in cases if not c.get("assigned_to")]
        if not unassigned:
            pytest.skip("No unassigned fly_tipping cases")
        
        case_id = unassigned[0]["id"]
        
        # Env crimes officer should be able to access
        resp = session.get(
            f"{BASE_URL}/api/cases/{case_id}",
            headers={"Authorization": f"Bearer {env_crimes_token}"}
        )
        assert resp.status_code == 200
        assert resp.json()["case_type"] == "fly_tipping"
    
    def test_manager_can_access_any_case(self, session, manager_token):
        """Manager should be able to access any case type"""
        # Get different case types
        for case_type in ["fly_tipping_organised", "abandoned_vehicle", "littering"]:
            resp = session.get(
                f"{BASE_URL}/api/cases?case_type={case_type}",
                headers={"Authorization": f"Bearer {manager_token}"}
            )
            if resp.status_code == 200 and resp.json():
                case_id = resp.json()[0]["id"]
                resp = session.get(
                    f"{BASE_URL}/api/cases/{case_id}",
                    headers={"Authorization": f"Bearer {manager_token}"}
                )
                assert resp.status_code == 200


class TestSupervisorAccess:
    """Test supervisor has full visibility"""
    
    def test_supervisor_can_access_all_cases(self, session, supervisor_token):
        """Supervisor should see all case types"""
        resp = session.get(
            f"{BASE_URL}/api/cases",
            headers={"Authorization": f"Bearer {supervisor_token}"}
        )
        assert resp.status_code == 200
        cases = resp.json()
        # Supervisor should see many case types like manager
        case_types = set(c["case_type"] for c in cases)
        assert len(case_types) > 5, "Supervisor should see many case types"
    
    def test_supervisor_stats_unfiltered(self, session, supervisor_token):
        """Supervisor stats should include all case types"""
        resp = session.get(
            f"{BASE_URL}/api/stats/overview",
            headers={"Authorization": f"Bearer {supervisor_token}"}
        )
        assert resp.status_code == 200
        stats = resp.json()
        assert stats["total_cases"] >= 30, "Supervisor should see all cases in stats"
