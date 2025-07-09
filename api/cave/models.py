from django.db import models


class Reference(models.Model):
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=255, null=True)

    domain = models.CharField(max_length=255, null=True)
    vintage = models.IntegerField(null=True)


class Purchase(models.Model):
    reference = models.ForeignKey(
        Reference, on_delete=models.CASCADE, related_name="purchases"
    )
    date = models.DateField()
    quantity = models.IntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ["-date"]
