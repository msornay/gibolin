from django.test import TestCase, Client
import json

from .models import Reference, Purchase, Category, Region, Appellation, MenuTemplate
from .api import sqid_encode, sqid_decode, _parse_menu_template


class ReferenceModelTest(TestCase):
    def test_reference_creation(self):
        """Test basic reference creation"""
        category = Category.objects.create(name="Red")
        reference = Reference.objects.create(
            name="Test Wine", category=category, domain="test.com", vintage=2020
        )
        self.assertEqual(reference.name, "Test Wine")
        self.assertEqual(reference.category.name, "Red")
        self.assertEqual(reference.domain, "test.com")
        self.assertEqual(reference.vintage, 2020)

    def test_reference_optional_fields(self):
        """Test reference with optional fields as None"""
        reference = Reference.objects.create(name="Test Wine")
        self.assertEqual(reference.name, "Test Wine")
        self.assertIsNone(reference.category)
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
        self.category = Category.objects.create(name="Red")
        self.reference = Reference.objects.create(
            name="Test Wine", category=self.category, domain="test.com", vintage=2020
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
            "category": "White",
            "domain": "new.com",
            "vintage": 2021,
        }
        response = self.client.post(
            "/api/ref", json.dumps(data), content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertIn("sqid", response_data)

        # Verify the reference was created
        new_reference = Reference.objects.get(name="New Wine")
        self.assertEqual(new_reference.category.name, "White")
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
            "category": "Rose",
            "domain": "updated.com",
            "vintage": 2022,
        }
        response = self.client.put(
            f"/api/ref/{sqid}", json.dumps(data), content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)

        # Verify the reference was updated
        updated_reference = Reference.objects.get(id=self.reference.id)
        self.assertEqual(updated_reference.name, "Updated Wine")
        self.assertEqual(updated_reference.category.name, "Rose")
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
        Reference.objects.create(
            name="Bordeaux Wine", domain="bordeaux.com", vintage=2020
        )
        Reference.objects.create(
            name="Burgundy Wine", domain="burgundy.com", vintage=2021
        )

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
        Reference.objects.create(
            name="CamelCase Wine", domain="camelcase.com", vintage=2020
        )

        response = self.client.get("/api/refs?search=camelcase")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        found = any("CamelCase" in item["name"] for item in data["items"])
        self.assertTrue(found, "Should find CamelCase Wine with lowercase search")

        response = self.client.get("/api/refs?search=CAMELCASE")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        found = any("CamelCase" in item["name"] for item in data["items"])
        self.assertTrue(found, "Should find CamelCase Wine with uppercase search")

    def test_search_references_accent_insensitive(self):
        """Test that search is accent insensitive (unaccent)"""
        Reference.objects.create(name="Mâcon-Villages Côteaux", vintage=2020)
        Reference.objects.create(name="Château Léoville", vintage=2019)

        # Search without accents should find accented names
        response = self.client.get("/api/refs?search=Macon")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 1)
        self.assertIn("Mâcon", data["items"][0]["name"])

        response = self.client.get("/api/refs?search=Coteaux")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 1)
        self.assertIn("Côteaux", data["items"][0]["name"])

        response = self.client.get("/api/refs?search=Chateau")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 1)
        self.assertIn("Château", data["items"][0]["name"])

        response = self.client.get("/api/refs?search=Leoville")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 1)
        self.assertIn("Léoville", data["items"][0]["name"])

    def test_search_by_category_accent_insensitive(self):
        """Test that search matches category names with accents"""
        category = Category.objects.create(name="Côtes du Rhône")
        Reference.objects.create(name="Test Wine", category=category, vintage=2020)

        response = self.client.get("/api/refs?search=Cotes")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["items"][0]["name"], "Test Wine")

    def test_search_multi_word(self):
        """Test that multi-word search matches all words across fields"""
        from .models import Region
        region = Region.objects.create(name="Mâconnais")
        Reference.objects.create(name="Château Lavernette", region=region, vintage=2020)
        Reference.objects.create(name="Other Wine", region=region, vintage=2019)

        # "Macon Lave" should match region "Mâconnais" AND name "Lavernette"
        response = self.client.get("/api/refs?search=Macon%20Lave")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 1)
        self.assertIn("Lavernette", data["items"][0]["name"])

    def test_create_reference_validation(self):
        """Test validation on reference creation"""
        # Test missing required field
        data = {"domain": "test.com"}
        response = self.client.post(
            "/api/ref", json.dumps(data), content_type="application/json"
        )
        self.assertEqual(response.status_code, 422)  # Validation error

    def test_create_reference_extra_fields_forbidden(self):
        """Test that extra fields are forbidden"""
        data = {
            "name": "Test Wine",
            "domain": "test.com",
            "vintage": 2020,
            "extra_field": "not_allowed",
        }
        response = self.client.post(
            "/api/ref", json.dumps(data), content_type="application/json"
        )
        self.assertEqual(
            response.status_code, 422
        )  # Validation error due to extra field

    def test_stats_empty_database(self):
        """Test stats endpoint with empty database"""
        Reference.objects.all().delete()
        response = self.client.get("/api/stats")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_references"], 0)
        self.assertEqual(data["total_bottles"], 0)
        self.assertEqual(data["total_value"], 0)

    def test_stats_references_without_purchases(self):
        """Test stats with references but no purchases"""
        response = self.client.get("/api/stats")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_references"], 1)
        self.assertEqual(data["total_bottles"], self.reference.current_quantity)
        self.assertEqual(data["total_value"], 0)

    def test_stats_with_purchases(self):
        """Test stats calculates value using average price × current_quantity"""
        self.reference.current_quantity = 4
        self.reference.save()
        # Add purchases: 6 @ €10, 6 @ €20 → avg = €15
        Purchase.objects.create(
            reference=self.reference, date="2023-01-01", quantity=6, price=10.00
        )
        Purchase.objects.create(
            reference=self.reference, date="2023-02-01", quantity=6, price=20.00
        )
        # Expected value: avg(15) × current_qty(4) = 60

        response = self.client.get("/api/stats")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_references"], 1)
        self.assertEqual(data["total_bottles"], 4)
        self.assertEqual(data["total_value"], 60.0)

    def test_stats_multiple_references(self):
        """Test stats sums across multiple references"""
        self.reference.current_quantity = 2
        self.reference.save()
        Purchase.objects.create(
            reference=self.reference, date="2023-01-01", quantity=4, price=10.00
        )
        # Ref 1: avg=10, qty=2 → value=20

        ref2 = Reference.objects.create(name="Wine 2", current_quantity=3)
        Purchase.objects.create(
            reference=ref2, date="2023-01-01", quantity=6, price=20.00
        )
        # Ref 2: avg=20, qty=3 → value=60

        response = self.client.get("/api/stats")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_references"], 2)
        self.assertEqual(data["total_bottles"], 5)  # 2 + 3
        self.assertEqual(data["total_value"], 80.0)  # 20 + 60

    def test_list_categories(self):
        """Test listing unique categories"""
        # Create categories and references
        bordeaux = Category.objects.create(name="Bordeaux")
        burgundy = Category.objects.create(name="Burgundy")
        Reference.objects.create(
            name="Wine 1", category=bordeaux, domain="test1.com", vintage=2020
        )
        Reference.objects.create(
            name="Wine 2", category=burgundy, domain="test2.com", vintage=2021
        )
        Reference.objects.create(
            name="Wine 3", category=bordeaux, domain="test3.com", vintage=2022
        )
        Reference.objects.create(
            name="Wine 4", domain="test4.com", vintage=2023
        )  # No category

        response = self.client.get("/api/categories")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertEqual(len(data), 3)  # 3 unique categories (including self.category)
        self.assertIn("Bordeaux", data)
        self.assertIn("Burgundy", data)
        self.assertIn("Red", data)  # From self.category


class PurchaseAPITest(TestCase):
    def setUp(self):
        self.client = Client()
        self.category = Category.objects.create(name="Red")
        self.reference = Reference.objects.create(
            name="Test Wine", category=self.category, domain="test.com", vintage=2020
        )
        self.purchase = Purchase.objects.create(
            reference=self.reference, date="2023-01-01", quantity=6, price=15.50
        )

    def test_create_purchase(self):
        """Test creating a new purchase"""
        sqid = sqid_encode(self.reference.id)
        data = {"date": "2023-02-01", "quantity": 12, "price": 18.00}
        response = self.client.post(
            f"/api/ref/{sqid}/purchases",
            json.dumps(data),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)

        # Verify the purchase was created
        new_purchase = Purchase.objects.filter(reference=self.reference).latest("id")
        self.assertEqual(new_purchase.quantity, 12)
        self.assertEqual(float(new_purchase.price), 18.00)

    def test_list_purchases(self):
        """Test listing purchases for a reference"""
        sqid = sqid_encode(self.reference.id)
        response = self.client.get(f"/api/ref/{sqid}/purchases")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["quantity"], 6)
        self.assertEqual(data[0]["price"], 15.50)

    def test_update_purchase(self):
        """Test updating an existing purchase"""
        data = {"date": "2023-01-15", "quantity": 8, "price": 16.00}
        response = self.client.put(
            f"/api/purchase/{self.purchase.id}",
            json.dumps(data),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)

        # Verify the purchase was updated
        updated_purchase = Purchase.objects.get(id=self.purchase.id)
        self.assertEqual(updated_purchase.quantity, 8)
        self.assertEqual(float(updated_purchase.price), 16.00)

    def test_delete_purchase(self):
        """Test deleting a purchase"""
        response = self.client.delete(f"/api/purchase/{self.purchase.id}")
        self.assertEqual(response.status_code, 200)

        # Verify the purchase was deleted
        with self.assertRaises(Purchase.DoesNotExist):
            Purchase.objects.get(id=self.purchase.id)

    def test_reference_includes_purchases(self):
        """Test that reference API includes purchase history"""
        sqid = sqid_encode(self.reference.id)
        response = self.client.get(f"/api/ref/{sqid}")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertIn("purchases", data)
        self.assertEqual(len(data["purchases"]), 1)
        self.assertEqual(data["purchases"][0]["quantity"], 6)
        self.assertEqual(data["purchases"][0]["price"], 15.50)


class MenuTemplateParseTest(TestCase):
    def test_parse_empty_template(self):
        """Test parsing an empty template returns empty dicts"""
        cat_order, reg_order, app_order = _parse_menu_template("")
        self.assertEqual(cat_order, {})
        self.assertEqual(reg_order, {})
        self.assertEqual(app_order, {})

    def test_parse_categories_only(self):
        """Test parsing template with only categories"""
        template = """# Rouge
# Blanc
# Rosé"""
        cat_order, reg_order, app_order = _parse_menu_template(template)
        self.assertEqual(cat_order, {"Rouge": 0, "Blanc": 1, "Rosé": 2})
        self.assertEqual(reg_order, {})
        self.assertEqual(app_order, {})

    def test_parse_categories_and_regions(self):
        """Test parsing template with categories and regions"""
        template = """# Rouge
  Bourgogne
  Bordeaux
# Blanc
  Loire"""
        cat_order, reg_order, app_order = _parse_menu_template(template)
        self.assertEqual(cat_order, {"Rouge": 0, "Blanc": 1})
        # Regions reset index per category
        self.assertEqual(reg_order, {"Bourgogne": 0, "Bordeaux": 1, "Loire": 0})
        self.assertEqual(app_order, {})

    def test_parse_full_hierarchy(self):
        """Test parsing template with categories, regions, and appellations"""
        template = """# Rouge
  Bourgogne
    Côte de Nuits
    Côte de Beaune
  Bordeaux
    Médoc
# Blanc
  Loire
    Sancerre"""
        cat_order, reg_order, app_order = _parse_menu_template(template)
        self.assertEqual(cat_order, {"Rouge": 0, "Blanc": 1})
        self.assertEqual(reg_order, {"Bourgogne": 0, "Bordeaux": 1, "Loire": 0})
        # Appellations reset index per region
        self.assertEqual(app_order, {
            "Côte de Nuits": 0,
            "Côte de Beaune": 1,
            "Médoc": 0,
            "Sancerre": 0
        })

    def test_parse_with_blank_lines(self):
        """Test parsing template ignores blank lines"""
        template = """# Rouge

  Bourgogne

    Côte de Nuits

# Blanc"""
        cat_order, reg_order, app_order = _parse_menu_template(template)
        self.assertEqual(cat_order, {"Rouge": 0, "Blanc": 1})
        self.assertEqual(reg_order, {"Bourgogne": 0})
        self.assertEqual(app_order, {"Côte de Nuits": 0})

    def test_parse_strips_trailing_whitespace(self):
        """Test parsing strips trailing whitespace from names"""
        template = """# Rouge
  Bourgogne
    Côte de Nuits   """
        cat_order, reg_order, app_order = _parse_menu_template(template)
        self.assertEqual(cat_order, {"Rouge": 0})
        self.assertEqual(reg_order, {"Bourgogne": 0})
        self.assertEqual(app_order, {"Côte de Nuits": 0})


class MenuTemplateAPITest(TestCase):
    def setUp(self):
        self.client = Client()

    def test_get_menu_template_empty(self):
        """Test getting menu template when none exists"""
        response = self.client.get("/api/menu/template")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["content"], "")

    def test_save_and_get_menu_template(self):
        """Test saving and retrieving menu template"""
        template_content = "# Rouge\n  Bourgogne"
        response = self.client.put(
            "/api/menu/template",
            json.dumps({"content": template_content}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.get("/api/menu/template")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["content"], template_content)

    def test_generate_menu_template(self):
        """Test generating menu template from existing data"""
        # Create some categories, regions, appellations
        Category.objects.create(name="Rouge", order=0)
        Category.objects.create(name="Blanc", order=1)
        Region.objects.create(name="Bourgogne", order=0)
        Appellation.objects.create(name="Côte de Nuits", order=0)

        response = self.client.get("/api/menu/template/generate")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Check template contains expected entries
        self.assertIn("# Rouge", data["content"])
        self.assertIn("# Blanc", data["content"])
        self.assertIn("  Bourgogne", data["content"])
        self.assertIn("    Côte de Nuits", data["content"])
