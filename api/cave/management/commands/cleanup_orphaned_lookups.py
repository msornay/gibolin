from django.core.management.base import BaseCommand

from cave.models import Category, Region, Appellation, Format, Grape


class Command(BaseCommand):
    help = "Delete lookup values not used by any reference"

    def handle(self, *args, **options):
        models = [Category, Region, Appellation, Format, Grape]
        total = 0
        for model in models:
            orphans = model.objects.filter(references__isnull=True)
            count = orphans.count()
            if count:
                orphans.delete()
                total += count
                self.stdout.write(f"Deleted {count} orphaned {model.__name__}(s)")
        if total:
            self.stdout.write(self.style.SUCCESS(f"Cleaned up {total} orphaned lookups"))
        else:
            self.stdout.write("No orphaned lookups found")
