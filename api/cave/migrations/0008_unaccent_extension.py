from django.contrib.postgres.operations import UnaccentExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('cave', '0007_appellation_reference_appellation'),
    ]
    operations = [
        UnaccentExtension(),
    ]
