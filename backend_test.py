#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import base64

class GovEnforceAPITester:
    def __init__(self, base_url="https://council-enforce.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tokens = {}
        self.users = {}
        self.test_case_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
            self.failed_tests.append({"test": name, "error": details})

    def test_login(self, email, password, role_name):
        """Test login for different user roles"""
        try:
            response = requests.post(
                f"{self.base_url}/auth/login",
                json={"email": email, "password": password},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.tokens[role_name] = data["access_token"]
                self.users[role_name] = data["user"]
                self.log_test(f"Login as {role_name}", True)
                return True
            else:
                self.log_test(f"Login as {role_name}", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test(f"Login as {role_name}", False, str(e))
            return False

    def get_headers(self, role="manager"):
        """Get authorization headers for API calls"""
        return {
            "Authorization": f"Bearer {self.tokens.get(role, '')}",
            "Content-Type": "application/json"
        }

    def test_auth_me(self, role="manager"):
        """Test /auth/me endpoint"""
        try:
            response = requests.get(
                f"{self.base_url}/auth/me",
                headers=self.get_headers(role)
            )
            success = response.status_code == 200
            self.log_test(f"Auth /me ({role})", success, 
                         f"Status: {response.status_code}" if not success else "")
            return success
        except Exception as e:
            self.log_test(f"Auth /me ({role})", False, str(e))
            return False

    def test_stats_overview(self, role="manager"):
        """Test stats overview endpoint"""
        try:
            response = requests.get(
                f"{self.base_url}/stats/overview",
                headers=self.get_headers(role)
            )
            success = response.status_code == 200
            if success:
                data = response.json()
                required_fields = ["total_cases", "open_cases", "closed_cases", "unassigned_cases"]
                has_fields = all(field in data for field in required_fields)
                self.log_test("Stats overview", has_fields, 
                             "Missing required fields" if not has_fields else "")
            else:
                self.log_test("Stats overview", False, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Stats overview", False, str(e))
            return False

    def test_get_cases(self, role="manager"):
        """Test get cases endpoint"""
        try:
            response = requests.get(
                f"{self.base_url}/cases",
                headers=self.get_headers(role)
            )
            success = response.status_code == 200
            self.log_test(f"Get cases ({role})", success, 
                         f"Status: {response.status_code}" if not success else "")
            return success, response.json() if success else []
        except Exception as e:
            self.log_test(f"Get cases ({role})", False, str(e))
            return False, []

    def test_create_case(self, role="manager"):
        """Test case creation"""
        try:
            case_data = {
                "case_type": "fly_tipping",
                "description": "Test case for automated testing",
                "location": {
                    "postcode": "SW1A 1AA",
                    "address": "Test Street, London"
                }
            }
            
            response = requests.post(
                f"{self.base_url}/cases",
                json=case_data,
                headers=self.get_headers(role)
            )
            
            if response.status_code == 200:
                data = response.json()
                self.test_case_id = data.get("id")
                self.log_test(f"Create case ({role})", True)
                return True, data
            else:
                self.log_test(f"Create case ({role})", False, f"Status: {response.status_code}")
                return False, None
        except Exception as e:
            self.log_test(f"Create case ({role})", False, str(e))
            return False, None

    def test_get_case_detail(self, case_id, role="manager"):
        """Test get case detail"""
        try:
            response = requests.get(
                f"{self.base_url}/cases/{case_id}",
                headers=self.get_headers(role)
            )
            success = response.status_code == 200
            self.log_test(f"Get case detail ({role})", success, 
                         f"Status: {response.status_code}" if not success else "")
            return success
        except Exception as e:
            self.log_test(f"Get case detail ({role})", False, str(e))
            return False

    def test_add_case_note(self, case_id, role="manager"):
        """Test adding case note"""
        try:
            note_data = {"content": "Test note from automated testing"}
            response = requests.post(
                f"{self.base_url}/cases/{case_id}/notes",
                json=note_data,
                headers=self.get_headers(role)
            )
            success = response.status_code == 200
            self.log_test(f"Add case note ({role})", success, 
                         f"Status: {response.status_code}" if not success else "")
            return success
        except Exception as e:
            self.log_test(f"Add case note ({role})", False, str(e))
            return False

    def test_get_case_notes(self, case_id, role="manager"):
        """Test get case notes"""
        try:
            response = requests.get(
                f"{self.base_url}/cases/{case_id}/notes",
                headers=self.get_headers(role)
            )
            success = response.status_code == 200
            self.log_test(f"Get case notes ({role})", success, 
                         f"Status: {response.status_code}" if not success else "")
            return success
        except Exception as e:
            self.log_test(f"Get case notes ({role})", False, str(e))
            return False

    def test_self_assign_case(self, case_id, role="officer"):
        """Test self-assignment of case"""
        try:
            response = requests.post(
                f"{self.base_url}/cases/{case_id}/self-assign",
                headers=self.get_headers(role)
            )
            success = response.status_code == 200
            self.log_test(f"Self-assign case ({role})", success, 
                         f"Status: {response.status_code}" if not success else "")
            return success
        except Exception as e:
            self.log_test(f"Self-assign case ({role})", False, str(e))
            return False

    def test_update_case_status(self, case_id, role="supervisor"):
        """Test updating case status"""
        try:
            update_data = {"status": "investigating"}
            response = requests.put(
                f"{self.base_url}/cases/{case_id}",
                json=update_data,
                headers=self.get_headers(role)
            )
            success = response.status_code == 200
            self.log_test(f"Update case status ({role})", success, 
                         f"Status: {response.status_code}" if not success else "")
            return success
        except Exception as e:
            self.log_test(f"Update case status ({role})", False, str(e))
            return False

    def test_public_report(self):
        """Test public report submission (no auth required)"""
        try:
            report_data = {
                "case_type": "littering",
                "description": "Test public report from automated testing",
                "location": {
                    "postcode": "E1 6AN",
                    "address": "Test Public Street"
                },
                "reporter_name": "Test Reporter",
                "reporter_contact": "test@example.com"
            }
            
            response = requests.post(
                f"{self.base_url}/public/report",
                json=report_data,
                headers={"Content-Type": "application/json"}
            )
            
            success = response.status_code == 200
            self.log_test("Public report submission", success, 
                         f"Status: {response.status_code}" if not success else "")
            return success
        except Exception as e:
            self.log_test("Public report submission", False, str(e))
            return False

    def test_get_users(self, role="manager"):
        """Test get users endpoint"""
        try:
            response = requests.get(
                f"{self.base_url}/users",
                headers=self.get_headers(role)
            )
            success = response.status_code == 200
            self.log_test(f"Get users ({role})", success, 
                         f"Status: {response.status_code}" if not success else "")
            return success
        except Exception as e:
            self.log_test(f"Get users ({role})", False, str(e))
            return False

    def test_notifications(self, role="manager"):
        """Test notifications endpoint"""
        try:
            response = requests.get(
                f"{self.base_url}/notifications",
                headers=self.get_headers(role)
            )
            success = response.status_code == 200
            self.log_test(f"Get notifications ({role})", success, 
                         f"Status: {response.status_code}" if not success else "")
            return success
        except Exception as e:
            self.log_test(f"Get notifications ({role})", False, str(e))
            return False

    def run_comprehensive_test(self):
        """Run all tests in sequence"""
        print("🚀 Starting GovEnforce API Tests")
        print("=" * 50)
        
        # Test login for all roles
        login_success = True
        login_success &= self.test_login("admin@council.gov.uk", "admin123", "manager")
        login_success &= self.test_login("supervisor@council.gov.uk", "super123", "supervisor")
        login_success &= self.test_login("officer@council.gov.uk", "officer123", "officer")
        
        if not login_success:
            print("❌ Login tests failed - stopping further tests")
            return False
        
        # Test authentication endpoints
        self.test_auth_me("manager")
        self.test_auth_me("supervisor")
        self.test_auth_me("officer")
        
        # Test stats and dashboard data
        self.test_stats_overview("manager")
        
        # Test case management
        cases_success, cases_data = self.test_get_cases("manager")
        
        # Create a test case
        case_created, case_data = self.test_create_case("manager")
        if case_created and case_data:
            case_id = case_data["id"]
            
            # Test case operations
            self.test_get_case_detail(case_id, "manager")
            self.test_add_case_note(case_id, "manager")
            self.test_get_case_notes(case_id, "manager")
            self.test_self_assign_case(case_id, "officer")
            self.test_update_case_status(case_id, "supervisor")
        
        # Test public report (no auth)
        self.test_public_report()
        
        # Test user management
        self.test_get_users("manager")
        
        # Test notifications
        self.test_notifications("manager")
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"  - {test['test']}: {test['error']}")
        
        return len(self.failed_tests) == 0

def main():
    tester = GovEnforceAPITester()
    
    try:
        tester.run_comprehensive_test()
        success = tester.print_summary()
        return 0 if success else 1
    except Exception as e:
        print(f"❌ Test suite failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())