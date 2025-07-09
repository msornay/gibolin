from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model
import json

from .models import Reference
from .api import sqid_encode, sqid_decode


class ReferenceModelTest(TestCase):
    def test_reference_creation(self):
        """Test basic reference creation"""
        reference = Reference.objects.create(
            name="Test Wine",
            domain="test.com",
            vintage=2020
        )
        self.assertEqual(reference.name, "Test Wine")
        self.assertEqual(reference.domain, "test.com")
        self.assertEqual(reference.vintage, 2020)

    def test_reference_optional_fields(self):
        """Test reference with optional fields as None"""
        reference = Reference.objects.create(name="Test Wine")
        self.assertEqual(reference.name, "Test Wine")
        self.assertIsNone(reference.domain)
        self.assertIsNone(reference.vintage)


class SqidUtilsTest(TestCase):
    def test_sqid_encode_decode(self):
        """Test SQID encoding and decoding"""
        original_id = 123
        sqid = sqid_encode(original_id)
        decoded_id = sqid_decode(sqid)
        self.assertEqual(original_id, decoded_id)


class ReferenceAPITest(TestCase):
    def setUp(self):
        self.client = Client()
        self.reference = Reference.objects.create(
            name="Test Wine",
            domain="test.com",
            vintage=2020
        )

    def test_healthcheck(self):
        """Test healthcheck endpoint"""
        response = self.client.get("/api/healthcheck")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {})

    def test_create_reference(self):
        """Test creating a new reference"""
        data = {
            "name": "New Wine",
            "domain": "new.com",
            "vintage": 2021
        }
        response = self.client.post(
            "/api/ref",
            json.dumps(data),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertIn("sqid", response_data)

        # Verify the reference was created
        new_reference = Reference.objects.get(name="New Wine")
        self.assertEqual(new_reference.domain, "new.com")
        self.assertEqual(new_reference.vintage, 2021)

    def test_get_reference(self):
        """Test getting a specific reference"""
        sqid = sqid_encode(self.reference.id)
        response = self.client.get(f"/api/ref/{sqid}")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertEqual(data["name"], "Test Wine")
        self.assertEqual(data["domain"], "test.com")
        self.assertEqual(data["vintage"], 2020)
        self.assertEqual(data["sqid"], sqid)

    def test_get_reference_not_found(self):
        """Test getting non-existent reference"""
        fake_sqid = sqid_encode(99999)
        response = self.client.get(f"/api/ref/{fake_sqid}")
        self.assertEqual(response.status_code, 404)

    def test_update_reference(self):
        """Test updating an existing reference"""
        sqid = sqid_encode(self.reference.id)
        data = {
            "name": "Updated Wine",
            "domain": "updated.com",
            "vintage": 2022
        }
        response = self.client.put(
            f"/api/ref/{sqid}",
            json.dumps(data),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)

        # Verify the reference was updated
        updated_reference = Reference.objects.get(id=self.reference.id)
        self.assertEqual(updated_reference.name, "Updated Wine")
        self.assertEqual(updated_reference.domain, "updated.com")
        self.assertEqual(updated_reference.vintage, 2022)

    def test_delete_reference(self):
        """Test deleting a reference"""
        sqid = sqid_encode(self.reference.id)
        response = self.client.delete(f"/api/ref/{sqid}")
        self.assertEqual(response.status_code, 200)

        # Verify the reference was deleted
        with self.assertRaises(Reference.DoesNotExist):
            Reference.objects.get(id=self.reference.id)

    def test_list_references(self):
        """Test listing all references"""
        # Create additional references
        Reference.objects.create(name="Wine 2", domain="test2.com", vintage=2021)
        Reference.objects.create(name="Wine 3", domain="test3.com", vintage=2022)

        response = self.client.get("/api/refs")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertIn("items", data)
        self.assertIn("count", data)
        self.assertEqual(data["count"], 3)
        self.assertEqual(len(data["items"]), 3)

    def test_search_references(self):
        """Test searching references"""
        # Create references with different names and domains
        Reference.objects.create(name="Bordeaux Wine", domain="bordeaux.com", vintage=2020)
        Reference.objects.create(name="Burgundy Wine", domain="burgundy.com", vintage=2021)

        # Search by name
        response = self.client.get("/api/refs?search=Bordeaux")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["items"][0]["name"], "Bordeaux Wine")

        # Search by domain
        response = self.client.get("/api/refs?search=burgundy")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["items"][0]["domain"], "burgundy.com")

    def test_search_references_case_insensitive(self):
        """Test that search is case insensitive"""
        # Create a reference with mixed case
        Reference.objects.create(name="CamelCase Wine", domain="camelcase.com", vintage=2020)
        
        # Search with lowercase should find the CamelCase reference
        response = self.client.get("/api/refs?search=camelcase")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Should find the reference regardless of case
        found = any("CamelCase" in item["name"] for item in data["items"])
        self.assertTrue(found, "Should find CamelCase Wine with lowercase search")
        
        # Search with uppercase should also work
        response = self.client.get("/api/refs?search=CAMELCASE")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        found = any("CamelCase" in item["name"] for item in data["items"])
        self.assertTrue(found, "Should find CamelCase Wine with uppercase search")

    def test_create_reference_validation(self):
        """Test validation on reference creation"""
        # Test missing required field
        data = {"domain": "test.com"}
        response = self.client.post(
            "/api/ref",
            json.dumps(data),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 422)  # Validation error

    def test_create_reference_extra_fields_forbidden(self):
        """Test that extra fields are forbidden"""
        data = {
            "name": "Test Wine",
            "domain": "test.com",
            "vintage": 2020,
            "extra_field": "not_allowed"
        }
        response = self.client.post(
            "/api/ref",
            json.dumps(data),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 422)  # Validation error due to extra field
