from django.test import TestCase, Client, override_settings
import json

from users.models import User
from .auth import GibolinOIDCBackend
from .models import Reference, Purchase, Category, Region, Appellation, Format, MenuTemplate
from .api import (
    sqid_encode, sqid_decode, _parse_menu_template,
    _build_wine_data, _build_appellation_list, _build_region_list,
)


class AuthenticatedTestCase(TestCase):
    """Base test class that creates and logs in a test user."""

    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            email="test@example.com", password="testpassword"
        )
        self.client = Client()
        self.client.force_login(self.user)


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


class FormatModelTest(TestCase):
    def test_format_creation(self):
        """Test basic format creation"""
        fmt = Format.objects.create(name="Magnum")
        self.assertEqual(fmt.name, "Magnum")
        self.assertEqual(str(fmt), "Magnum")

    def test_reference_with_format(self):
        """Test reference with format FK"""
        fmt = Format.objects.create(name="Standard")
        ref = Reference.objects.create(name="Test Wine", format=fmt)
        self.assertEqual(ref.format.name, "Standard")

    def test_reference_format_optional(self):
        """Test reference without format"""
        ref = Reference.objects.create(name="Test Wine")
        self.assertIsNone(ref.format)


class FormatAPITest(AuthenticatedTestCase):
    def test_list_formats(self):
        """GET /api/formats returns list of format names"""
        Format.objects.create(name="Magnum")
        Format.objects.create(name="Standard")
        response = self.client.get("/api/formats")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("Magnum", data)
        self.assertIn("Standard", data)

    def test_create_format(self):
        """POST /api/formats creates a format"""
        response = self.client.post(
            "/api/formats",
            json.dumps({"name": "Jéroboam"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Format.objects.filter(name="Jéroboam").exists())

    def test_create_reference_with_format(self):
        """POST /api/ref with format creates reference with format FK"""
        data = {
            "name": "Chablis",
            "category": "White",
            "format": "Magnum",
        }
        response = self.client.post(
            "/api/ref", json.dumps(data), content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        ref = Reference.objects.get(name="Chablis")
        self.assertEqual(ref.format.name, "Magnum")

    def test_update_reference_format(self):
        """PUT /api/ref/{sqid} can change format"""
        fmt = Format.objects.create(name="Standard")
        ref = Reference.objects.create(name="Wine", format=fmt)
        sqid = sqid_encode(ref.id)
        data = {"name": "Wine", "format": "Magnum"}
        response = self.client.put(
            f"/api/ref/{sqid}",
            json.dumps(data),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        ref.refresh_from_db()
        self.assertEqual(ref.format.name, "Magnum")

    def test_reference_response_includes_format(self):
        """GET /api/ref/{sqid} response includes format field"""
        fmt = Format.objects.create(name="Clavelin")
        ref = Reference.objects.create(name="Vin Jaune", format=fmt)
        sqid = sqid_encode(ref.id)
        response = self.client.get(f"/api/ref/{sqid}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["format"], "Clavelin")

    def test_reference_response_format_null(self):
        """GET /api/ref/{sqid} returns null format when not set"""
        ref = Reference.objects.create(name="Wine")
        sqid = sqid_encode(ref.id)
        response = self.client.get(f"/api/ref/{sqid}")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["format"])


class SqidUtilsTest(TestCase):
    def test_sqid_encode_decode(self):
        """Test SQID encoding and decoding"""
        original_id = 123
        sqid = sqid_encode(original_id)
        decoded_id = sqid_decode(sqid)
        self.assertEqual(original_id, decoded_id)


class ReferenceAPITest(AuthenticatedTestCase):
    def setUp(self):
        super().setUp()
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


class PurchaseAPITest(AuthenticatedTestCase):
    def setUp(self):
        super().setUp()
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


class MenuTemplateAPITest(AuthenticatedTestCase):
    def setUp(self):
        super().setUp()

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
        # Create categories, regions, appellations with references
        cat_rouge = Category.objects.create(name="Rouge")
        cat_blanc = Category.objects.create(name="Blanc")
        region = Region.objects.create(name="Bourgogne")
        appellation = Appellation.objects.create(name="Côte de Nuits")

        # Create visible references to include items in template
        Reference.objects.create(
            name="Test Red", category=cat_rouge, region=region,
            appellation=appellation, hidden_from_menu=False
        )
        Reference.objects.create(
            name="Test White", category=cat_blanc, region=region,
            appellation=appellation, hidden_from_menu=False
        )

        response = self.client.get("/api/menu/template/generate")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Check template contains expected entries
        self.assertIn("# Rouge", data["content"])
        self.assertIn("# Blanc", data["content"])
        self.assertIn("  Bourgogne", data["content"])
        self.assertIn("    Côte de Nuits", data["content"])


class BuildWineDataTest(TestCase):
    def test_wine_with_all_details(self):
        """Test wine data with domain and vintage"""
        cat = Category.objects.create(name="Rouge")
        ref = Reference.objects.create(
            name="Château Margaux", category=cat, domain="Margaux", vintage=2015
        )
        data = _build_wine_data(ref)
        self.assertEqual(data["name"], "Château Margaux")
        self.assertEqual(data["details"], "Margaux \u2022 2015")
        self.assertIsNone(data["price"])

    def test_wine_with_domain_only(self):
        """Test wine data with domain but no vintage"""
        ref = Reference.objects.create(name="NV Wine", domain="Krug")
        data = _build_wine_data(ref)
        self.assertEqual(data["details"], "Krug")

    def test_wine_with_vintage_only(self):
        """Test wine data with vintage but no domain"""
        ref = Reference.objects.create(name="Mystery Wine", vintage=2020)
        data = _build_wine_data(ref)
        self.assertEqual(data["details"], "2020")

    def test_wine_with_no_details(self):
        """Test wine data with neither domain nor vintage"""
        ref = Reference.objects.create(name="Simple Wine")
        data = _build_wine_data(ref)
        self.assertIsNone(data["details"])

    def test_wine_with_retail_price(self):
        """Test wine data includes computed retail price"""
        ref = Reference.objects.create(
            name="Priced Wine", price_multiplier=3.00
        )
        Purchase.objects.create(
            reference=ref, date="2023-01-01", quantity=1, price=10.00
        )
        data = _build_wine_data(ref)
        self.assertEqual(data["price"], 30)


class BuildAppellationListTest(TestCase):
    def setUp(self):
        self.cat = Category.objects.create(name="Rouge")
        self.sancerre = Appellation.objects.create(name="Sancerre")
        self.medoc = Appellation.objects.create(name="Médoc")

    def test_groups_wines_by_appellation(self):
        """Test wines are grouped into correct appellations"""
        ref1 = Reference.objects.create(
            name="Wine A", category=self.cat, appellation=self.sancerre
        )
        ref2 = Reference.objects.create(
            name="Wine B", category=self.cat, appellation=self.medoc
        )
        result = _build_appellation_list(
            [ref1, ref2], [self.medoc, self.sancerre]
        )
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["name"], "Médoc")
        self.assertEqual(result[1]["name"], "Sancerre")

    def test_respects_appellation_ordering(self):
        """Test appellations follow the provided sort order"""
        ref1 = Reference.objects.create(
            name="Wine A", category=self.cat, appellation=self.sancerre
        )
        ref2 = Reference.objects.create(
            name="Wine B", category=self.cat, appellation=self.medoc
        )
        # Sancerre first this time
        result = _build_appellation_list(
            [ref1, ref2], [self.sancerre, self.medoc]
        )
        self.assertEqual(result[0]["name"], "Sancerre")
        self.assertEqual(result[1]["name"], "Médoc")

    def test_wines_without_appellation(self):
        """Test wines with no appellation go into 'No Appellation' group at end"""
        ref1 = Reference.objects.create(
            name="Wine A", category=self.cat, appellation=self.sancerre
        )
        ref2 = Reference.objects.create(name="Loose Wine", category=self.cat)
        result = _build_appellation_list(
            [ref1, ref2], [self.sancerre, self.medoc]
        )
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["name"], "Sancerre")
        self.assertEqual(result[1]["name"], "No Appellation")
        self.assertEqual(result[1]["wines"][0]["name"], "Loose Wine")

    def test_wines_sorted_by_name_within_appellation(self):
        """Test wines are sorted alphabetically within each appellation"""
        ref1 = Reference.objects.create(
            name="Zinfandel", category=self.cat, appellation=self.sancerre
        )
        ref2 = Reference.objects.create(
            name="Albariño", category=self.cat, appellation=self.sancerre
        )
        result = _build_appellation_list([ref1, ref2], [self.sancerre])
        self.assertEqual(result[0]["wines"][0]["name"], "Albariño")
        self.assertEqual(result[0]["wines"][1]["name"], "Zinfandel")

    def test_skips_appellations_with_no_wines(self):
        """Test appellations with no matching wines are not included"""
        ref = Reference.objects.create(
            name="Wine A", category=self.cat, appellation=self.sancerre
        )
        result = _build_appellation_list([ref], [self.sancerre, self.medoc])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["name"], "Sancerre")

    def test_empty_wine_list(self):
        """Test with no wines returns empty list"""
        result = _build_appellation_list([], [self.sancerre])
        self.assertEqual(result, [])


class BuildRegionListTest(TestCase):
    def setUp(self):
        self.cat = Category.objects.create(name="Rouge")
        self.bourgogne = Region.objects.create(name="Bourgogne")
        self.bordeaux = Region.objects.create(name="Bordeaux")
        self.sancerre = Appellation.objects.create(name="Sancerre")

    def test_groups_wines_by_region(self):
        """Test wines are grouped into correct regions"""
        ref1 = Reference.objects.create(
            name="Wine A", category=self.cat, region=self.bourgogne
        )
        ref2 = Reference.objects.create(
            name="Wine B", category=self.cat, region=self.bordeaux
        )
        result = _build_region_list(
            [ref1, ref2], [self.bordeaux, self.bourgogne], []
        )
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["name"], "Bordeaux")
        self.assertEqual(result[1]["name"], "Bourgogne")

    def test_wines_without_region(self):
        """Test wines with no region go into 'No Region' group at end"""
        ref1 = Reference.objects.create(
            name="Wine A", category=self.cat, region=self.bourgogne
        )
        ref2 = Reference.objects.create(name="Loose Wine", category=self.cat)
        result = _build_region_list(
            [ref1, ref2], [self.bourgogne], []
        )
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["name"], "Bourgogne")
        self.assertEqual(result[1]["name"], "No Region")

    def test_region_contains_appellation_structure(self):
        """Test regions contain appellation sub-grouping"""
        ref = Reference.objects.create(
            name="Wine A", category=self.cat,
            region=self.bourgogne, appellation=self.sancerre
        )
        result = _build_region_list(
            [ref], [self.bourgogne], [self.sancerre]
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["appellations"][0]["name"], "Sancerre")
        self.assertEqual(
            result[0]["appellations"][0]["wines"][0]["name"], "Wine A"
        )

    def test_skips_regions_with_no_wines(self):
        """Test regions with no matching wines are not included"""
        ref = Reference.objects.create(
            name="Wine A", category=self.cat, region=self.bourgogne
        )
        result = _build_region_list(
            [ref], [self.bourgogne, self.bordeaux], []
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["name"], "Bourgogne")

    def test_empty_wine_list(self):
        """Test with no wines returns empty list"""
        result = _build_region_list([], [self.bourgogne], [])
        self.assertEqual(result, [])


class ExportWineMenuHTMLTest(AuthenticatedTestCase):
    def setUp(self):
        super().setUp()

    def test_export_empty_menu(self):
        """Test HTML export with no wines returns valid HTML"""
        response = self.client.get("/api/export/html")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/html")
        self.assertIn("Wine Menu", response.content.decode())

    def test_export_single_wine(self):
        """Test HTML export with one categorized wine"""
        cat = Category.objects.create(name="Rouge", color="#cc0000")
        region = Region.objects.create(name="Bourgogne")
        appellation = Appellation.objects.create(name="Pommard")
        Reference.objects.create(
            name="Château Test", category=cat, region=region,
            appellation=appellation, domain="Domaine Test", vintage=2018
        )
        response = self.client.get("/api/export/html")
        content = response.content.decode()
        self.assertEqual(response.status_code, 200)
        self.assertIn("Rouge", content)
        self.assertIn("Bourgogne", content)
        self.assertIn("Pommard", content)
        self.assertIn("Château Test", content)
        self.assertIn("Domaine Test", content)
        self.assertIn("2018", content)

    def test_export_hidden_wines_excluded(self):
        """Test that hidden wines are not included in export"""
        cat = Category.objects.create(name="Rouge")
        Reference.objects.create(
            name="Visible Wine", category=cat, hidden_from_menu=False
        )
        Reference.objects.create(
            name="Hidden Wine", category=cat, hidden_from_menu=True
        )
        response = self.client.get("/api/export/html")
        content = response.content.decode()
        self.assertIn("Visible Wine", content)
        self.assertNotIn("Hidden Wine", content)

    def test_export_uncategorized_wines(self):
        """Test wines without category appear under 'Other Selections'"""
        Reference.objects.create(name="Mystery Wine")
        response = self.client.get("/api/export/html")
        content = response.content.decode()
        self.assertIn("Other Selections", content)
        self.assertIn("Mystery Wine", content)

    def test_export_wine_with_price(self):
        """Test that retail price is displayed in export"""
        cat = Category.objects.create(name="Blanc")
        ref = Reference.objects.create(
            name="Priced Wine", category=cat, price_multiplier=3.00
        )
        Purchase.objects.create(
            reference=ref, date="2023-06-01", quantity=6, price=10.00
        )
        response = self.client.get("/api/export/html")
        content = response.content.decode()
        # Price should be ceil(10 * 3) = 30
        self.assertIn("\u20ac30", content)

    def test_export_wine_without_price(self):
        """Test that wine without purchases shows dash for price"""
        cat = Category.objects.create(name="Blanc")
        Reference.objects.create(name="No Price Wine", category=cat)
        response = self.client.get("/api/export/html")
        content = response.content.decode()
        self.assertIn("No Price Wine", content)

    def test_export_template_ordering(self):
        """Test that menu template controls category ordering"""
        cat_blanc = Category.objects.create(name="Blanc")
        cat_rouge = Category.objects.create(name="Rouge")
        Reference.objects.create(name="White Wine", category=cat_blanc)
        Reference.objects.create(name="Red Wine", category=cat_rouge)

        # Set template: Rouge before Blanc
        from .models import MenuTemplate
        MenuTemplate.set_template("# Rouge\n# Blanc")

        response = self.client.get("/api/export/html")
        content = response.content.decode()
        rouge_pos = content.index("Rouge")
        blanc_pos = content.index("Blanc")
        self.assertLess(rouge_pos, blanc_pos)

    def test_export_multiple_categories_regions_appellations(self):
        """Test full hierarchy with multiple categories, regions, appellations"""
        cat_rouge = Category.objects.create(name="Rouge", color="#cc0000")
        cat_blanc = Category.objects.create(name="Blanc", color="#ffcc00")
        bourgogne = Region.objects.create(name="Bourgogne")
        bordeaux = Region.objects.create(name="Bordeaux")
        pommard = Appellation.objects.create(name="Pommard")
        margaux = Appellation.objects.create(name="Margaux")

        Reference.objects.create(
            name="Red Burgundy", category=cat_rouge,
            region=bourgogne, appellation=pommard
        )
        Reference.objects.create(
            name="Red Bordeaux", category=cat_rouge,
            region=bordeaux, appellation=margaux
        )
        Reference.objects.create(
            name="White Burgundy", category=cat_blanc,
            region=bourgogne
        )

        response = self.client.get("/api/export/html")
        content = response.content.decode()
        self.assertEqual(response.status_code, 200)
        self.assertIn("Rouge", content)
        self.assertIn("Blanc", content)
        self.assertIn("Bourgogne", content)
        self.assertIn("Bordeaux", content)
        self.assertIn("Pommard", content)
        self.assertIn("Margaux", content)
        self.assertIn("Red Burgundy", content)
        self.assertIn("Red Bordeaux", content)
        self.assertIn("White Burgundy", content)

    def test_export_wines_without_region(self):
        """Test wines with category but no region are still included"""
        cat = Category.objects.create(name="Rouge")
        Reference.objects.create(name="Regionless Wine", category=cat)
        response = self.client.get("/api/export/html")
        content = response.content.decode()
        self.assertIn("Regionless Wine", content)

    def test_export_wines_without_appellation(self):
        """Test wines with region but no appellation are still included"""
        cat = Category.objects.create(name="Rouge")
        region = Region.objects.create(name="Bourgogne")
        Reference.objects.create(
            name="No Appellation Wine", category=cat, region=region
        )
        response = self.client.get("/api/export/html")
        content = response.content.decode()
        self.assertIn("No Appellation Wine", content)

    def test_export_uncategorized_with_region_and_appellation(self):
        """Test uncategorized wine with full region/appellation hierarchy"""
        region = Region.objects.create(name="Alsace")
        appellation = Appellation.objects.create(name="Riesling")
        Reference.objects.create(
            name="Uncategorized Full", region=region, appellation=appellation
        )
        response = self.client.get("/api/export/html")
        content = response.content.decode()
        self.assertIn("Other Selections", content)
        self.assertIn("Alsace", content)
        self.assertIn("Riesling", content)
        self.assertIn("Uncategorized Full", content)

    def test_export_category_with_no_visible_wines(self):
        """Test that categories with only hidden wines appear but empty"""
        cat = Category.objects.create(name="Empty Category")
        Reference.objects.create(
            name="Hidden Wine", category=cat, hidden_from_menu=True
        )
        response = self.client.get("/api/export/html")
        content = response.content.decode()
        # Category should appear in the output (has_wines=False)
        # but no wine items under it
        self.assertNotIn("Hidden Wine", content)

    def test_export_retail_price_override(self):
        """Test that retail price override is used instead of computed price"""
        cat = Category.objects.create(name="Rouge")
        ref = Reference.objects.create(
            name="Override Wine", category=cat,
            price_multiplier=3.00, retail_price_override=42.00
        )
        Purchase.objects.create(
            reference=ref, date="2023-01-01", quantity=1, price=10.00
        )
        response = self.client.get("/api/export/html")
        content = response.content.decode()
        # Override 42 should be used, not computed 30
        self.assertIn("\u20ac42", content)


class ReferenceLocationModelTest(TestCase):
    def test_create_with_location(self):
        """Test creating a reference with a location"""
        ref = Reference.objects.create(
            name="Located Wine", location="Maison principale"
        )
        self.assertEqual(ref.location, "Maison principale")

    def test_create_without_location(self):
        """Test creating a reference without location (null)"""
        ref = Reference.objects.create(name="No Location Wine")
        self.assertIsNone(ref.location)


class ReferenceNotesTest(AuthenticatedTestCase):
    def test_create_reference_with_notes(self):
        data = {"name": "Wine With Notes", "notes": "Lovely tannins, pair with lamb"}
        response = self.client.post(
            "/api/ref", json.dumps(data), content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        ref = Reference.objects.get(name="Wine With Notes")
        self.assertEqual(ref.notes, "Lovely tannins, pair with lamb")

    def test_update_reference_notes(self):
        ref = Reference.objects.create(name="Wine")
        sqid = sqid_encode(ref.id)
        data = {"name": "Wine", "notes": "Updated notes"}
        response = self.client.put(
            f"/api/ref/{sqid}", json.dumps(data), content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        ref.refresh_from_db()
        self.assertEqual(ref.notes, "Updated notes")

    def test_get_reference_returns_notes(self):
        ref = Reference.objects.create(name="Wine", notes="Some notes")
        sqid = sqid_encode(ref.id)
        response = self.client.get(f"/api/ref/{sqid}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["notes"], "Some notes")

    def test_notes_optional_defaults_null(self):
        data = {"name": "Wine Without Notes"}
        response = self.client.post(
            "/api/ref", json.dumps(data), content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        ref = Reference.objects.get(name="Wine Without Notes")
        self.assertIsNone(ref.notes)


class ReferenceLocationAPITest(AuthenticatedTestCase):
    def setUp(self):
        super().setUp()

    def test_create_with_location(self):
        """Test creating a reference with location via API"""
        data = {
            "name": "Wine With Location",
            "location": "Maison principale",
        }
        response = self.client.post(
            "/api/ref", json.dumps(data), content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        ref = Reference.objects.get(name="Wine With Location")
        self.assertEqual(ref.location, "Maison principale")

    def test_update_location(self):
        """Test updating a reference's location"""
        ref = Reference.objects.create(name="Test Wine", location="Old Location")
        sqid = sqid_encode(ref.id)
        data = {"name": "Test Wine", "location": "New Location"}
        response = self.client.put(
            f"/api/ref/{sqid}", json.dumps(data), content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        ref.refresh_from_db()
        self.assertEqual(ref.location, "New Location")

    def test_get_returns_location(self):
        """Test that GET /api/ref/{sqid} returns location"""
        ref = Reference.objects.create(
            name="Test Wine", location="Résidence secondaire"
        )
        sqid = sqid_encode(ref.id)
        response = self.client.get(f"/api/ref/{sqid}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["location"], "Résidence secondaire")

    def test_list_with_location_filter(self):
        """Test filtering references by location"""
        Reference.objects.create(name="Wine A", location="Maison principale")
        Reference.objects.create(name="Wine B", location="Résidence secondaire")
        Reference.objects.create(name="Wine C", location="Maison principale")

        response = self.client.get(
            "/api/refs?location=Maison%20principale"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 2)
        names = {item["name"] for item in data["items"]}
        self.assertEqual(names, {"Wine A", "Wine C"})

    def test_list_without_location_filter_returns_all(self):
        """Test that omitting location filter returns all references"""
        Reference.objects.create(name="Wine A", location="Maison principale")
        Reference.objects.create(name="Wine B", location="Résidence secondaire")
        Reference.objects.create(name="Wine C")

        response = self.client.get("/api/refs")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 3)

    def test_search_matches_location(self):
        """Test that search covers the location field"""
        Reference.objects.create(name="Wine A", location="Maison principale")
        Reference.objects.create(name="Wine B", location="Résidence secondaire")

        response = self.client.get("/api/refs?search=principale")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["items"][0]["name"], "Wine A")


class LocationAPITest(AuthenticatedTestCase):
    def setUp(self):
        super().setUp()

    def test_empty_db_returns_empty_list(self):
        """Test GET /api/locations with no references returns []"""
        response = self.client.get("/api/locations")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_returns_distinct_values(self):
        """Test that locations returns distinct non-empty values"""
        Reference.objects.create(name="Wine A", location="Maison principale")
        Reference.objects.create(name="Wine B", location="Maison principale")
        Reference.objects.create(name="Wine C", location="Résidence secondaire")
        Reference.objects.create(name="Wine D")  # null location
        Reference.objects.create(name="Wine E", location="")  # empty location

        response = self.client.get("/api/locations")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 2)

    def test_returns_sorted_alphabetically(self):
        """Test that locations are sorted alphabetically"""
        Reference.objects.create(name="Wine A", location="Résidence secondaire")
        Reference.objects.create(name="Wine B", location="Maison principale")

        response = self.client.get("/api/locations")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data, ["Maison principale", "Résidence secondaire"])


class ExportWineMenuLocationFilterTest(AuthenticatedTestCase):
    def setUp(self):
        super().setUp()
        self.cat = Category.objects.create(name="Rouge")

    def test_export_with_location_filter(self):
        """Test that location filter shows only matching wines"""
        Reference.objects.create(
            name="Wine A", category=self.cat, location="Maison principale"
        )
        Reference.objects.create(
            name="Wine B", category=self.cat, location="Résidence secondaire"
        )
        response = self.client.get(
            "/api/export/html?location=Maison%20principale"
        )
        content = response.content.decode()
        self.assertEqual(response.status_code, 200)
        self.assertIn("Wine A", content)
        self.assertNotIn("Wine B", content)

    def test_export_without_location_filter_shows_all(self):
        """Test that no location filter shows all wines"""
        Reference.objects.create(
            name="Wine A", category=self.cat, location="Maison principale"
        )
        Reference.objects.create(
            name="Wine B", category=self.cat, location="Résidence secondaire"
        )
        response = self.client.get("/api/export/html")
        content = response.content.decode()
        self.assertEqual(response.status_code, 200)
        self.assertIn("Wine A", content)
        self.assertIn("Wine B", content)


class MultiUserSchemaTest(TestCase):
    """Verify each model with a user ForeignKey can be created with user=None."""

    def test_category_with_null_user(self):
        cat = Category.objects.create(name="Red")
        self.assertIsNone(cat.user)

    def test_region_with_null_user(self):
        region = Region.objects.create(name="Bordeaux")
        self.assertIsNone(region.user)

    def test_appellation_with_null_user(self):
        appellation = Appellation.objects.create(name="Margaux")
        self.assertIsNone(appellation.user)

    def test_reference_with_null_user(self):
        ref = Reference.objects.create(name="Test Wine")
        self.assertIsNone(ref.user)

    def test_menu_template_with_null_user(self):
        mt = MenuTemplate.objects.create(content="# Menu")
        self.assertIsNone(mt.user)


class AuthAPITest(TestCase):
    """Test authentication enforcement on API endpoints."""

    def test_healthcheck_no_auth(self):
        """Healthcheck should work without authentication"""
        client = Client()
        response = client.get("/api/healthcheck")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {})

    def test_refs_returns_401_unauthenticated(self):
        """API endpoints should return 401 when not authenticated"""
        client = Client()
        response = client.get("/api/refs")
        self.assertEqual(response.status_code, 401)

    def test_stats_returns_401_unauthenticated(self):
        """Stats endpoint should return 401 when not authenticated"""
        client = Client()
        response = client.get("/api/stats")
        self.assertEqual(response.status_code, 401)

    def test_create_ref_returns_401_unauthenticated(self):
        """Create ref should return 401 when not authenticated"""
        client = Client()
        data = {"name": "Test Wine"}
        response = client.post(
            "/api/ref", json.dumps(data), content_type="application/json"
        )
        self.assertEqual(response.status_code, 401)

    def test_refs_returns_200_authenticated(self):
        """API endpoints should return 200 when authenticated"""
        user = User.objects.create_user(
            email="auth@example.com", password="test"
        )
        client = Client()
        client.force_login(user)
        response = client.get("/api/refs")
        self.assertEqual(response.status_code, 200)

    def test_me_returns_401_unauthenticated(self):
        """GET /api/me should return 401 when not authenticated"""
        client = Client()
        response = client.get("/api/me")
        self.assertEqual(response.status_code, 401)

    def test_me_returns_user_email(self):
        """GET /api/me should return current user email"""
        user = User.objects.create_user(
            email="me@example.com", password="test"
        )
        client = Client()
        client.force_login(user)
        response = client.get("/api/me")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], "me@example.com")


class CSRFProtectionTest(TestCase):
    """Test that the SPA sets CSRF cookie and API accepts it."""

    def test_spa_sets_csrf_cookie(self):
        """SPA catchall should set csrftoken cookie for the frontend"""
        client = Client(enforce_csrf_checks=True)
        response = client.get("/")
        self.assertIn("csrftoken", response.cookies)

    def test_post_with_csrf_token_succeeds(self):
        """Authenticated POST with CSRF token should succeed"""
        client = Client(enforce_csrf_checks=True)
        user = User.objects.create_user(
            email="csrf@example.com", password="test"
        )
        client.force_login(user)
        # Get CSRF token from SPA page
        response = client.get("/")
        csrf_token = response.cookies["csrftoken"].value
        # POST with token
        response = client.post(
            "/api/categories",
            json.dumps({"name": "Red"}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(response.status_code, 200)


class ConfigAPITest(TestCase):
    """Test /api/config public endpoint."""

    def test_config_no_auth_required(self):
        """GET /api/config should return 200 without authentication"""
        client = Client()
        response = client.get("/api/config")
        self.assertEqual(response.status_code, 200)

    def test_config_reports_oidc_disabled(self):
        """Config should report oidc_enabled=false when not configured"""
        client = Client()
        response = client.get("/api/config")
        self.assertFalse(response.json()["oidc_enabled"])

    @override_settings(OIDC_ENABLED=True)
    def test_config_reports_oidc_enabled(self):
        """Config should report oidc_enabled=true when configured"""
        client = Client()
        response = client.get("/api/config")
        self.assertTrue(response.json()["oidc_enabled"])


class OIDCDisabledURLTest(TestCase):
    """Test that /oidc/* returns 404 when OIDC is not configured."""

    def test_oidc_authenticate_404_when_disabled(self):
        """GET /oidc/authenticate/ should return 404, not SPA catchall"""
        client = Client()
        response = client.get("/oidc/authenticate/")
        self.assertEqual(response.status_code, 404)

    def test_oidc_callback_404_when_disabled(self):
        """GET /oidc/callback/ should return 404 when OIDC is disabled"""
        client = Client()
        response = client.get("/oidc/callback/")
        self.assertEqual(response.status_code, 404)


class OIDCBackendTest(TestCase):
    """Test custom OIDC backend email whitelist enforcement."""

    def test_known_email_returns_user(self):
        """OIDC backend should return user for known email"""
        user = User.objects.create_user(
            email="known@example.com", password="test"
        )
        backend = GibolinOIDCBackend()
        result = backend.filter_users_by_claims({"email": "known@example.com"})
        self.assertEqual(list(result), [user])

    def test_known_email_case_insensitive(self):
        """OIDC backend should match email case-insensitively"""
        user = User.objects.create_user(
            email="Known@Example.COM", password="test"
        )
        backend = GibolinOIDCBackend()
        result = backend.filter_users_by_claims({"email": "known@example.com"})
        self.assertEqual(list(result), [user])

    def test_unknown_email_returns_empty(self):
        """OIDC backend should return empty for unknown email"""
        backend = GibolinOIDCBackend()
        result = backend.filter_users_by_claims(
            {"email": "unknown@example.com"}
        )
        self.assertEqual(list(result), [])

    def test_empty_email_returns_empty(self):
        """OIDC backend should return empty for empty email"""
        backend = GibolinOIDCBackend()
        result = backend.filter_users_by_claims({"email": ""})
        self.assertEqual(list(result), [])

    def test_missing_email_returns_empty(self):
        """OIDC backend should return empty when no email in claims"""
        backend = GibolinOIDCBackend()
        result = backend.filter_users_by_claims({})
        self.assertEqual(list(result), [])

    def test_create_user_returns_none(self):
        """OIDC backend should reject user creation (friends-only gate)"""
        backend = GibolinOIDCBackend()
        result = backend.create_user({"email": "new@example.com"})
        self.assertIsNone(result)


class OrphanLookupCleanupTest(AuthenticatedTestCase):
    def test_update_ref_deletes_orphaned_category(self):
        cat = Category.objects.create(name="OldCat")
        ref = Reference.objects.create(name="Wine", category=cat)
        sqid = sqid_encode(ref.id)
        self.client.put(
            f"/api/ref/{sqid}",
            json.dumps({"name": "Wine", "category": "NewCat"}),
            content_type="application/json",
        )
        self.assertFalse(Category.objects.filter(name="OldCat").exists())
        self.assertTrue(Category.objects.filter(name="NewCat").exists())

    def test_update_ref_keeps_shared_category(self):
        cat = Category.objects.create(name="SharedCat")
        Reference.objects.create(name="Wine A", category=cat)
        ref_b = Reference.objects.create(name="Wine B", category=cat)
        sqid = sqid_encode(ref_b.id)
        self.client.put(
            f"/api/ref/{sqid}",
            json.dumps({"name": "Wine B", "category": "Other"}),
            content_type="application/json",
        )
        self.assertTrue(Category.objects.filter(name="SharedCat").exists())

    def test_update_ref_clearing_lookup_deletes_orphan(self):
        cat = Category.objects.create(name="LonelyCat")
        ref = Reference.objects.create(name="Wine", category=cat)
        sqid = sqid_encode(ref.id)
        self.client.put(
            f"/api/ref/{sqid}",
            json.dumps({"name": "Wine", "category": None}),
            content_type="application/json",
        )
        self.assertFalse(Category.objects.filter(name="LonelyCat").exists())

    def test_update_ref_deletes_orphaned_region(self):
        region = Region.objects.create(name="OldRegion")
        ref = Reference.objects.create(name="Wine", region=region)
        sqid = sqid_encode(ref.id)
        self.client.put(
            f"/api/ref/{sqid}",
            json.dumps({"name": "Wine", "region": "NewRegion"}),
            content_type="application/json",
        )
        self.assertFalse(Region.objects.filter(name="OldRegion").exists())

    def test_update_ref_deletes_orphaned_appellation(self):
        appellation = Appellation.objects.create(name="OldApp")
        ref = Reference.objects.create(name="Wine", appellation=appellation)
        sqid = sqid_encode(ref.id)
        self.client.put(
            f"/api/ref/{sqid}",
            json.dumps({"name": "Wine", "appellation": "NewApp"}),
            content_type="application/json",
        )
        self.assertFalse(Appellation.objects.filter(name="OldApp").exists())

    def test_update_ref_deletes_orphaned_format(self):
        fmt = Format.objects.create(name="OldFmt")
        ref = Reference.objects.create(name="Wine", format=fmt)
        sqid = sqid_encode(ref.id)
        self.client.put(
            f"/api/ref/{sqid}",
            json.dumps({"name": "Wine", "format": "NewFmt"}),
            content_type="application/json",
        )
        self.assertFalse(Format.objects.filter(name="OldFmt").exists())

    def test_delete_ref_deletes_orphaned_lookups(self):
        cat = Category.objects.create(name="DelCat")
        region = Region.objects.create(name="DelRegion")
        appellation = Appellation.objects.create(name="DelApp")
        fmt = Format.objects.create(name="DelFmt")
        ref = Reference.objects.create(
            name="Wine", category=cat, region=region,
            appellation=appellation, format=fmt,
        )
        sqid = sqid_encode(ref.id)
        self.client.delete(f"/api/ref/{sqid}")
        self.assertFalse(Category.objects.filter(name="DelCat").exists())
        self.assertFalse(Region.objects.filter(name="DelRegion").exists())
        self.assertFalse(Appellation.objects.filter(name="DelApp").exists())
        self.assertFalse(Format.objects.filter(name="DelFmt").exists())

    def test_delete_ref_keeps_shared_lookups(self):
        cat = Category.objects.create(name="SharedCat")
        Reference.objects.create(name="Wine A", category=cat)
        ref_b = Reference.objects.create(name="Wine B", category=cat)
        sqid = sqid_encode(ref_b.id)
        self.client.delete(f"/api/ref/{sqid}")
        self.assertTrue(Category.objects.filter(name="SharedCat").exists())


class LogoutViewTest(TestCase):
    """Test logout view."""

    def test_logout_redirects_to_root(self):
        """Logout should redirect to /"""
        user = User.objects.create_user(
            email="logout@example.com", password="test"
        )
        client = Client()
        client.force_login(user)
        response = client.get("/logout/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, "/")

    def test_logout_clears_session(self):
        """Logout should clear the session"""
        user = User.objects.create_user(
            email="logout@example.com", password="test"
        )
        client = Client()
        client.force_login(user)
        # Verify logged in
        response = client.get("/api/me")
        self.assertEqual(response.status_code, 200)
        # Logout
        client.get("/logout/")
        # Verify logged out
        response = client.get("/api/me")
        self.assertEqual(response.status_code, 401)
