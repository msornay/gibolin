# TODO

## Multi-user schema (preparation, no auth yet)

- Add `from django.conf import settings` to `cave/models.py`
- Add nullable `user` ForeignKey (`settings.AUTH_USER_MODEL`, `on_delete=models.SET_NULL`, `null=True`, `blank=True`) to: Category, Region, Appellation, Reference, MenuTemplate. Use distinct `related_name` for each (e.g. `categories`, `regions`, `appellations`, `references_owned`, `menu_templates`). Purchase does NOT need one (scoped through Reference FK).
- Generate migration with `makemigrations cave`
- Add `MultiUserSchemaTest` to `cave/tests.py`: verify each model can be created with `user=None`
- Do NOT add auth, login, user filtering, or frontend auth. Schema only.

## Location field on Reference

### Backend model
- Add `location = models.CharField(max_length=255, null=True, blank=True)` to Reference, after `domain`
- Generate migration with `makemigrations cave`

### Backend API (`cave/api.py`)
- Add `location: Optional[str] = None` to `ReferenceIn` schema (after `domain`)
- Add `location: Optional[str]` to `ReferenceOut` schema (after `domain`). No custom resolver needed.
- Add `Q(location__unaccent__icontains=word)` to `_search_word()` so search covers location
- Add `location: str = None` query parameter to `list_reference` endpoint. When set, filter `qs = qs.filter(location=location)` before search
- Add new `GET /api/locations` endpoint returning `List[str]`: distinct non-empty location values from Reference, sorted alphabetically
- Add `location: str = None` query parameter to `export_wine_menu_html`. When set, filter the references queryset

### Frontend (`ui/src/index.tsx`)
- Add `location?: string` to the `Reference` TypeScript type
- Add `location?: string` parameter to `fetchReferences`; append `&location=...` to URL when set
- Add `selectedLocation` state + `useQuery` for `GET /api/locations`
- Include `selectedLocation` in the references query key and pass to `fetchReferences`
- Add antd `Select` dropdown next to search bar: placeholder "All locations", `allowClear`, options from locations query. On change, reset page to 1.
- Add Location column to the table after Domain, render `location || "-"`
- CRITICAL: add `location: record.location` to `updateHiddenMutation` body (the PUT that toggles visibility). Without this, toggling hidden_from_menu nulls out the location.
- Add `exportLocation` state + `Select` dropdown inside Export Settings modal
- Update `handleHtmlExport` to append `?location=encodeURIComponent(exportLocation)` to the export URL when set

### Frontend form (`ui/src/components/reference-form.tsx`)
- Add `<Form.Item label="Location" name="location"><Input placeholder="e.g., Maison principale" /></Form.Item>` after the Domain field
- Add `location` to form initial values in both the edit (from `referenceData.location`) and create (empty string) branches

### Tests
- `ReferenceLocationModelTest`: create with location, create without (null)
- Extend `ReferenceAPITest`: create with location, update location, GET returns location
- `LocationAPITest`: empty DB returns `[]`, distinct values, sorted alphabetically
- Extend `ExportWineMenuHTMLTest`: filter by location shows only matching wines, no filter shows all
- Test `list_reference` with location param: returns only matching, omitting returns all
- Frontend tests (`ui/src/test/index.test.tsx`): add `location` to Reference type test objects

### Seed data (`cave/management/commands/load_test_data.py`)
- Add helper `_location_for_region(region_name)` mapping to two values: "Maison principale" (Mâcon, Bourgogne, Beaujolais, Jura, Bugey, Savoie, Alsace) and "Résidence secondaire" (others)
- Pass computed `location` to `Reference.objects.get_or_create` defaults in `create_references`
