from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=255, unique=True)
    order = models.IntegerField(default=0)
    color = models.CharField(max_length=7, default="#000000")  # Hex color code

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class Region(models.Model):
    name = models.CharField(max_length=255, unique=True)
    order = models.IntegerField(default=0)

    class Meta:
        verbose_name_plural = "regions"
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class Appellation(models.Model):
    name = models.CharField(max_length=255, unique=True)
    order = models.IntegerField(default=0)

    class Meta:
        verbose_name_plural = "appellations"
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class Reference(models.Model):
    name = models.CharField(max_length=255)
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="references",
    )
    region = models.ForeignKey(
        Region,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="references",
    )
    appellation = models.ForeignKey(
        Appellation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="references",
    )
    domain = models.CharField(max_length=255, null=True, blank=True)
    vintage = models.IntegerField(null=True, blank=True)
    current_quantity = models.IntegerField(default=0)
    price_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=3.00)
    retail_price_override = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    hidden_from_menu = models.BooleanField(default=False)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Purchase(models.Model):
    reference = models.ForeignKey(
        Reference, on_delete=models.CASCADE, related_name="purchases"
    )
    date = models.DateField()
    quantity = models.IntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ["-date"]


class MenuTemplate(models.Model):
    content = models.TextField(default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Menu Template"

    @classmethod
    def get_template(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj.content

    @classmethod
    def set_template(cls, content):
        obj, _ = cls.objects.get_or_create(pk=1)
        obj.content = content
        obj.save()
