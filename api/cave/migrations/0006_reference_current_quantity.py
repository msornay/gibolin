# Generated by Django 5.0.3 on 2025-07-11 10:04

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cave", "0005_category_color"),
    ]

    operations = [
        migrations.AddField(
            model_name="reference",
            name="current_quantity",
            field=models.IntegerField(default=0),
        ),
    ]
