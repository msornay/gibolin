from django.db import models

class Reference(models.Model):
    name = models.CharField(max_length=255)

    domain = models.CharField(max_length=255, null=True)
    vintage = models.IntegerField(null=True)


class Order(models.Model):
    reference = models.ForeignKey(Reference, on_delete=models.CASCADE)
    date = models.DateField()
    quantity = models.IntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
