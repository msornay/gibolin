import random
from datetime import datetime, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from cave.models import Category, Region, Appellation, Reference, Purchase


class Command(BaseCommand):
    help = "Load test data based July 2025 wine list"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear existing data before loading",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            self.stdout.write("Clearing existing data...")
            Purchase.objects.all().delete()
            Reference.objects.all().delete()
            Appellation.objects.all().delete()
            Region.objects.all().delete()
            Category.objects.all().delete()

        with transaction.atomic():
            self.create_categories()
            self.create_regions()
            self.create_appellations()
            self.create_references()
            self.create_purchases()

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully loaded test data:\n"
                f"- {Category.objects.count()} categories\n"
                f"- {Region.objects.count()} regions\n"
                f"- {Appellation.objects.count()} appellations\n"
                f"- {Reference.objects.count()} references\n"
                f"- {Purchase.objects.count()} purchases"
            )
        )

    def create_categories(self):
        """Create wine categories with colors"""
        categories = [
            ("Blancs", "#4A90E2"),
            ("Rouges", "#B71C1C"),
            ("Rosés", "#E91E63"),
            ("Bulles", "#FFD700"),
            ("Macération", "#FF9800"),
        ]

        for name, color in categories:
            Category.objects.get_or_create(
                name=name, defaults={"color": color}
            )

    def create_regions(self):
        """Create wine regions based on Frat.md"""
        regions = [
            "Mâcon",
            "Bourgogne",
            "Loire",
            "Jura",
            "Bugey",
            "Savoie",
            "Rhône",
            "Languedoc",
            "Sud-Ouest",
            "Alsace",
            "Italie",
            "Bordeaux",
            "Beaujolais",
        ]

        for name in regions:
            Region.objects.get_or_create(name=name)

    def create_appellations(self):
        """Create appellations based on Frat.md"""
        appellations = [
            # Mâcon appellations
            "Vin-de-France",
            "Bourgogne-Aligoté",
            "Mâcon-Villages",
            "Mâcon-Cruzille",
            "Mâcon-Bray",
            "Mâcon-Verzé",
            "Mâcon-Loché",
            "Mâcon-Chaintré",
            "Mâcon-Fuissé",
            "Viré-Clessé",
            "Saint-Véran",
            "Pouilly-Loché",
            "Pouilly-Vinzelles",
            "Pouilly-Fuissé",
            "Pouilly-Fuissé 1er Cru",
            "Mâcon",
            "Mâcon-Serrière",
            # Bourgogne appellations
            "IGP Saint-Marie-La-Blanche",
            "AOP Côte-de-Beaune",
            "Bourgogne",
            "Marsannay",
            "Pommard 1er Cru",
            "Rully 1er Cru",
            # Loire appellations
            "Chinon",
            "Anjou",
            "Côteaux-du-Layon",
            "Muscadet Sèvre-et-Maine",
            "IGP Val-de-Loire",
            # Jura appellations
            "Côtes-du-Jura",
            "Arbois",
            # Bugey appellations
            "Bugey",
            # Savoie appellations
            "IGP Vin-des-Allobroges",
            "Chignin-Bergeron",
            # Rhône appellations
            "Côte-du-Rhône",
            "Crozes-Hermitage",
            "Saint-Joseph",
            "Châteauneuf-du-Pape",
            # Languedoc appellations
            "Corbière",
            "Limoux",
            "IGP Côtes-Catalanes",
            # Bordeaux appellations
            "Pauillac",
            "Margaux",
            "Pomerol",
            "Saint-Emilion Grand Cru",
            "Saint-Emilion",
            # Beaujolais appellations
            "Beaujolais-Villages",
            "Beaujolais-Leynes",
            "Saint-Amour",
            "Juliénas",
            "Fleurie",
            "Chirouble",
            "Morgon",
            "Régnié",
            # Italian appellations
            "DOCG Moscato D'Asti",
            "IGT Terre Siciliennes",
            "DOC Langhe",
            "DOCG Barolo",
            # Other appellations
            "Bellet",
            "Champagne",
            "Crémant-de-Bourgogne",
            "Cerdon",
        ]

        for name in appellations:
            Appellation.objects.get_or_create(name=name)

    def create_references(self):
        """Create wine references based on Frat.md data"""
        # Get created objects
        categories = {cat.name: cat for cat in Category.objects.all()}
        regions = {reg.name: reg for reg in Region.objects.all()}
        appellations = {app.name: app for app in Appellation.objects.all()}

        # Wine data from Frat.md (sample of key wines)
        wines = [
            # Blancs - Mâcon
            (
                "La Soufrandière X-Taste",
                "Blancs",
                "Mâcon",
                "Vin-de-France",
                "La Soufrandière",
                2012,
                105,
            ),
            (
                "Côteaux des Margots La Pie Rouette",
                "Blancs",
                "Mâcon",
                "Bourgogne-Aligoté",
                "Côteaux des Margots",
                2023,
                21,
            ),
            (
                "La Sarazinière Clos des Bruyères",
                "Blancs",
                "Mâcon",
                "Bourgogne-Aligoté",
                "La Sarazinière",
                2023,
                28,
            ),
            (
                "Nicolas Maillet Aligoté",
                "Blancs",
                "Mâcon",
                "Bourgogne-Aligoté",
                "Nicolas Maillet",
                2022,
                36,
            ),
            (
                "Mâcon-Villages Côteaux des Margots",
                "Blancs",
                "Mâcon",
                "Mâcon-Villages",
                "Côteaux des Margots",
                2023,
                22,
            ),
            (
                "Domaine des Gandines",
                "Blancs",
                "Mâcon",
                "Mâcon-Villages",
                "Domaine des Gandines",
                None,
                26,
            ),
            (
                "Clos des Vignes du Maynes Aragonite",
                "Blancs",
                "Mâcon",
                "Mâcon-Cruzille",
                "Clos des Vignes du Maynes",
                2022,
                78,
            ),
            (
                "La Vigne Mouton Mouton Blanc",
                "Blancs",
                "Mâcon",
                "Mâcon-Bray",
                "La Vigne Mouton",
                2023,
                32,
            ),
            (
                "Nicolas Maillet Les Chemins Blanc",
                "Blancs",
                "Mâcon",
                "Mâcon-Verzé",
                "Nicolas Maillet",
                2022,
                50,
            ),
            (
                "Marcel Couturier Les Longues Terres",
                "Blancs",
                "Mâcon",
                "Mâcon-Loché",
                "Marcel Couturier",
                2022,
                38,
            ),
            (
                "Domaine Cornin Chaintré",
                "Blancs",
                "Mâcon",
                "Mâcon-Chaintré",
                "Domaine Cornin",
                2023,
                28,
            ),
            (
                "Domaine Cornin Les Bruyères",
                "Blancs",
                "Mâcon",
                "Mâcon-Fuissé",
                "Domaine Cornin",
                2023,
                31,
            ),
            (
                "Domaine Guillemot-Michel Quintaine",
                "Blancs",
                "Mâcon",
                "Viré-Clessé",
                "Domaine Guillemot-Michel",
                2022,
                96,
            ),
            (
                "Domaine Cornin Serreuxdières",
                "Blancs",
                "Mâcon",
                "Saint-Véran",
                "Domaine Cornin",
                2023,
                38,
            ),
            (
                "La Soufrandière la Combe Desroches",
                "Blancs",
                "Mâcon",
                "Saint-Véran",
                "La Soufrandière",
                2023,
                49,
            ),
            (
                "Pacaud Vignerons La Côte",
                "Blancs",
                "Mâcon",
                "Pouilly-Loché",
                "Pacaud Vignerons",
                2022,
                42,
            ),
            (
                "La Soufrandière Pouilly-Vinzelles",
                "Blancs",
                "Mâcon",
                "Pouilly-Vinzelles",
                "La Soufrandière",
                2023,
                57,
            ),
            (
                "Maison Guillot-Broux La Roche",
                "Blancs",
                "Mâcon",
                "Pouilly-Fuissé 1er Cru",
                "Maison Guillot-Broux",
                2020,
                105,
            ),
            (
                "La Sarazinière VII",
                "Blancs",
                "Mâcon",
                "Pouilly-Fuissé",
                "La Sarazinière",
                2023,
                44,
            ),
            (
                "Domaine Cornin Pouilly-Fuissé",
                "Blancs",
                "Mâcon",
                "Pouilly-Fuissé",
                "Domaine Cornin",
                2023,
                48,
            ),
            (
                "Domaine Robert-Denogent La Croix",
                "Blancs",
                "Mâcon",
                "Pouilly-Fuissé",
                "Domaine Robert-Denogent",
                2022,
                63,
            ),
            # Blancs - Bourgogne
            (
                "Emmanuel Giboulot Terres Burgondes",
                "Blancs",
                "Bourgogne",
                "IGP Saint-Marie-La-Blanche",
                "Emmanuel Giboulot",
                2022,
                49,
            ),
            (
                "Emmanuel Giboulot La Grande Chatelaine",
                "Blancs",
                "Bourgogne",
                "AOP Côte-de-Beaune",
                "Emmanuel Giboulot",
                2021,
                79,
            ),
            # Blancs - Loire
            (
                "Château de Passavant Penser Nature",
                "Blancs",
                "Loire",
                "Vin-de-France",
                "Château de Passavant",
                2023,
                28,
            ),
            (
                "Domaine de L'Ecu Sole",
                "Blancs",
                "Loire",
                "Vin-de-France",
                "Domaine de L'Ecu",
                2022,
                43,
            ),
            (
                "Les Quatre Piliers Les Puits aux Chiens",
                "Blancs",
                "Loire",
                "Vin-de-France",
                "Les Quatre Piliers",
                2020,
                94,
            ),
            (
                "Château La Trochoire Elisabeth Authentique",
                "Blancs",
                "Loire",
                "Chinon",
                "Château La Trochoire",
                2023,
                41,
            ),
            (
                "Domaine de Gaubourg Grand Pierre",
                "Blancs",
                "Loire",
                "Anjou",
                "Domaine de Gaubourg",
                2023,
                40,
            ),
            (
                "Château du Breuil Côteaux-du-Layon",
                "Blancs",
                "Loire",
                "Côteaux-du-Layon",
                "Château du Breuil",
                2020,
                48,
            ),
            (
                "Jo Landron Amphibolite",
                "Blancs",
                "Loire",
                "Muscadet Sèvre-et-Maine",
                "Jo Landron",
                2022,
                31,
            ),
            # Blancs - Jura
            (
                "Domaine de la Pinte Cuvée d'Automne",
                "Blancs",
                "Jura",
                "Vin-de-France",
                "Domaine de la Pinte",
                None,
                42,
            ),
            (
                "Domaine Pignier Savagnin",
                "Blancs",
                "Jura",
                "Côtes-du-Jura",
                "Domaine Pignier",
                2018,
                96,
            ),
            (
                "Domaine de la Touraize Les Voisines",
                "Blancs",
                "Jura",
                "Arbois",
                "Domaine de la Touraize",
                2020,
                54,
            ),
            (
                "Domaine de la Touraize Vin Jaune",
                "Blancs",
                "Jura",
                "Arbois",
                "Domaine de la Touraize",
                2014,
                123,
            ),
            # Blancs - Savoie
            (
                "L'Aitonnement Big Bang",
                "Blancs",
                "Savoie",
                "IGP Vin-des-Allobroges",
                "L'Aitonnement",
                2022,
                54,
            ),
            (
                "L'Aitonnement Solar",
                "Blancs",
                "Savoie",
                "IGP Vin-des-Allobroges",
                "L'Aitonnement",
                2022,
                108,
            ),
            (
                "L'Aitonnement Vesta",
                "Blancs",
                "Savoie",
                "Chignin-Bergeron",
                "L'Aitonnement",
                2022,
                83,
            ),
            # Blancs - Rhône
            (
                "Domaine les Bruyères Beaumont",
                "Blancs",
                "Rhône",
                "Crozes-Hermitage",
                "Domaine les Bruyères",
                2024,
                35,
            ),
            (
                "Domaine des Pierres Séches",
                "Blancs",
                "Rhône",
                "Saint-Joseph",
                "Domaine des Pierres Séches",
                2021,
                60,
            ),
            # Blancs - Languedoc
            (
                "La Baronne Les Chemins",
                "Blancs",
                "Languedoc",
                "Corbière",
                "La Baronne",
                2021,
                35,
            ),
            (
                "Les Hautes Terres Céleste",
                "Blancs",
                "Languedoc",
                "Limoux",
                "Les Hautes Terres",
                2021,
                64,
            ),
            (
                "Olivier Pithon D18",
                "Blancs",
                "Languedoc",
                "IGP Côtes-Catalanes",
                "Olivier Pithon",
                2023,
                95,
            ),
            # Blancs - Italie
            (
                "Vajra Moscato",
                "Blancs",
                "Italie",
                "DOCG Moscato D'Asti",
                "Vajra",
                2024,
                32,
            ),
            (
                "Arianna Occhipinti S.P. 68",
                "Blancs",
                "Italie",
                "IGT Terre Siciliennes",
                "Arianna Occhipinti",
                2021,
                53,
            ),
            # Rouges - Beaujolais
            (
                "Les Bertrand Tryptique",
                "Rouges",
                "Beaujolais",
                "Vin-de-France",
                "Les Bertrand",
                2023,
                38,
            ),
            (
                "Jules Métras Chica",
                "Rouges",
                "Beaujolais",
                "Vin-de-France",
                "Jules Métras",
                2023,
                40,
            ),
            (
                "Mathieu et Camille Lapierre Raisins Gaulois",
                "Rouges",
                "Beaujolais",
                "Vin-de-France",
                "Mathieu et Camille Lapierre",
                2022,
                28,
            ),
            (
                "Anthony Thevenet Beaujolais-Villages",
                "Rouges",
                "Beaujolais",
                "Beaujolais-Villages",
                "Anthony Thevenet",
                2022,
                21,
            ),
            (
                "David Chapel Beaujolais-Villages",
                "Rouges",
                "Beaujolais",
                "Beaujolais-Villages",
                "David Chapel",
                2021,
                29,
            ),
            (
                "Domaine David-Beaupère",
                "Rouges",
                "Beaujolais",
                "Beaujolais-Villages",
                "Domaine David-Beaupère",
                2022,
                29,
            ),
            (
                "Les Bertrand Lantignié",
                "Rouges",
                "Beaujolais",
                "Beaujolais-Villages",
                "Les Bertrand",
                2023,
                35,
            ),
            (
                "Jules Métras Bijou",
                "Rouges",
                "Beaujolais",
                "Beaujolais-Villages",
                "Jules Métras",
                2023,
                44,
            ),
            (
                "Domaine des Crais Madame",
                "Rouges",
                "Beaujolais",
                "Beaujolais-Leynes",
                "Domaine des Crais",
                2023,
                23,
            ),
            (
                "Clos Sauvage Fauve",
                "Rouges",
                "Beaujolais",
                "Beaujolais-Leynes",
                "Clos Sauvage",
                2023,
                36,
            ),
            (
                "Les Sources d'Agapé Petit Besset",
                "Rouges",
                "Beaujolais",
                "Saint-Amour",
                "Les Sources d'Agapé",
                2023,
                27,
            ),
            (
                "Domaine David-Beaupère Vayolette",
                "Rouges",
                "Beaujolais",
                "Juliénas",
                "Domaine David-Beaupère",
                2022,
                51,
            ),
            (
                "Bret Brother La Bottière",
                "Rouges",
                "Beaujolais",
                "Juliénas",
                "Bret Brother",
                2022,
                53,
            ),
            (
                "Marc Delienne Abbaye Road",
                "Rouges",
                "Beaujolais",
                "Fleurie",
                "Marc Delienne",
                2018,
                57,
            ),
            (
                "Marc Delienne La Vigne des Fous",
                "Rouges",
                "Beaujolais",
                "Fleurie",
                "Marc Delienne",
                2018,
                183,
            ),
            (
                "David Chapel Charbonnières",
                "Rouges",
                "Beaujolais",
                "Fleurie",
                "David Chapel",
                2022,
                47,
            ),
            (
                "Les Bertrand Chaos",
                "Rouges",
                "Beaujolais",
                "Fleurie",
                "Les Bertrand",
                2022,
                49,
            ),
            (
                "Jules Métras La Montagne",
                "Rouges",
                "Beaujolais",
                "Chirouble",
                "Jules Métras",
                2023,
                49,
            ),
            (
                "Mathieu et Camille Lapierre Vieille Vignes",
                "Rouges",
                "Beaujolais",
                "Morgon",
                "Mathieu et Camille Lapierre",
                2023,
                112,
            ),
            (
                "Mathieu et Camille Lapierre Camille",
                "Rouges",
                "Beaujolais",
                "Morgon",
                "Mathieu et Camille Lapierre",
                2023,
                65,
            ),
            (
                "Thomas Rivier Tomix",
                "Rouges",
                "Beaujolais",
                "Régnié",
                "Thomas Rivier",
                2021,
                60,
            ),
            # Rouges - Mâcon
            (
                "Clos des Vignes du Maynes Auguste",
                "Rouges",
                "Mâcon",
                "Bourgogne",
                "Clos des Vignes du Maynes",
                2022,
                84,
            ),
            (
                "Clos des Vignes du Maynes Les Crays",
                "Rouges",
                "Mâcon",
                "Bourgogne",
                "Clos des Vignes du Maynes",
                2023,
                126,
            ),
            (
                "La Vigne Mouton Ratatouille",
                "Rouges",
                "Mâcon",
                "Mâcon",
                "La Vigne Mouton",
                2023,
                32,
            ),
            (
                "Clos des Vignes du Maynes Manganite",
                "Rouges",
                "Mâcon",
                "Mâcon-Cruzille",
                "Clos des Vignes du Maynes",
                2023,
                84,
            ),
            (
                "La Sarazinière La Pépie",
                "Rouges",
                "Mâcon",
                "Mâcon-Serrière",
                "La Sarazinière",
                2024,
                28,
            ),
            # Rouges - Bourgogne
            (
                "Ballorin & Fils Les Amoureux",
                "Rouges",
                "Bourgogne",
                "Marsannay",
                "Ballorin & Fils",
                2022,
                81,
            ),
            (
                "Clos Orgelot Pommard",
                "Rouges",
                "Bourgogne",
                "Pommard 1er Cru",
                "Clos Orgelot",
                2021,
                135,
            ),
            (
                "Château de Monthelie Les Préaux",
                "Rouges",
                "Bourgogne",
                "Rully 1er Cru",
                "Château de Monthelie",
                2021,
                63,
            ),
            # Rouges - Loire
            (
                "Domaine des Frères Les Pucelles",
                "Rouges",
                "Loire",
                "Chinon",
                "Domaine des Frères",
                2023,
                31,
            ),
            (
                "Domaine de Gaubourg Mon Garenne",
                "Rouges",
                "Loire",
                "IGP Val-de-Loire",
                "Domaine de Gaubourg",
                2023,
                32,
            ),
            # Rouges - Jura
            (
                "Domaine Pignier Trousseau",
                "Rouges",
                "Jura",
                "Côtes-du-Jura",
                "Domaine Pignier",
                2022,
                66,
            ),
            # Rouges - Savoie
            (
                "L'Aitonnement Nebula",
                "Rouges",
                "Savoie",
                "Vin-de-France",
                "L'Aitonnement",
                2022,
                54,
            ),
            (
                "L'Aitonnement Dark Side",
                "Rouges",
                "Savoie",
                "IGP Vin-des-Allobroges",
                "L'Aitonnement",
                2022,
                83,
            ),
            # Rouges - Rhône
            (
                "Matthieu Dumarcher Léon et Séraphin",
                "Rouges",
                "Rhône",
                "Vin-de-France",
                "Matthieu Dumarcher",
                2022,
                26,
            ),
            (
                "Domaine Viret Renaissance",
                "Rouges",
                "Rhône",
                "Vin-de-France",
                "Domaine Viret",
                2019,
                44,
            ),
            (
                "Domaine Viret Dolia Paradis",
                "Rouges",
                "Rhône",
                "Vin-de-France",
                "Domaine Viret",
                2018,
                65,
            ),
            (
                "Mas de Libian Vin de Pétanque",
                "Rouges",
                "Rhône",
                "Vin-de-France",
                "Mas de Libian",
                2024,
                20,
            ),
            (
                "Mas de Libian Khayyâm",
                "Rouges",
                "Rhône",
                "Vin-de-France",
                "Mas de Libian",
                2023,
                31,
            ),
            (
                "Domaine Chaume-Arnaud Petit Coquet",
                "Rouges",
                "Rhône",
                "Côte-du-Rhône",
                "Domaine Chaume-Arnaud",
                2023,
                24,
            ),
            (
                "Mas de Libian Bout'Z*n",
                "Rouges",
                "Rhône",
                "Côte-du-Rhône",
                "Mas de Libian",
                2023,
                24,
            ),
            (
                "Domaine les Bruyères Beaumont Rouge",
                "Rouges",
                "Rhône",
                "Crozes-Hermitage",
                "Domaine les Bruyères",
                2024,
                35,
            ),
            (
                "Domaine Pierre André",
                "Rouges",
                "Rhône",
                "Châteauneuf-du-Pape",
                "Domaine Pierre André",
                2021,
                108,
            ),
            # Rouges - Bordeaux
            (
                "Château Pontet-Canet",
                "Rouges",
                "Bordeaux",
                "Pauillac",
                "Château Pontet-Canet",
                2011,
                240,
            ),
            (
                "Château Ferrière",
                "Rouges",
                "Bordeaux",
                "Margaux",
                "Château Ferrière",
                2015,
                100,
            ),
            (
                "Château Beauregard",
                "Rouges",
                "Bordeaux",
                "Pomerol",
                "Château Beauregard",
                2016,
                140,
            ),
            (
                "Château Bellevue-Figeac",
                "Rouges",
                "Bordeaux",
                "Saint-Emilion Grand Cru",
                "Château Bellevue-Figeac",
                2019,
                49,
            ),
            (
                "Château Daugay Le Piaf",
                "Rouges",
                "Bordeaux",
                "Saint-Emilion",
                "Château Daugay",
                2020,
                38,
            ),
            # Rouges - Italie
            ("Vajra Claré J.C.", "Rouges", "Italie", "DOC Langhe", "Vajra", 2024, 38),
            ("Vajra Albe", "Rouges", "Italie", "DOCG Barolo", "Vajra", 2021, 97),
            (
                "Vajra Bricca delle Viole",
                "Rouges",
                "Italie",
                "DOCG Barolo",
                "Vajra",
                2021,
                229,
            ),
            (
                "Arianna Occhipinti S.P 68 Rouge",
                "Rouges",
                "Italie",
                "IGT Terre Siciliennes",
                "Arianna Occhipinti",
                2022,
                53,
            ),
            (
                "Arianna Occhipinti Siccagno",
                "Rouges",
                "Italie",
                "IGT Terre Siciliennes",
                "Arianna Occhipinti",
                2021,
                79,
            ),
            # Rosés
            (
                "Bellet Clos Saint Vincent Le Clos Rosé",
                "Rosés",
                "Languedoc",
                "Bellet",
                "Clos Saint Vincent",
                2021,
                50,
            ),
            (
                "Domaine les Bruyères La Luxure",
                "Rosés",
                "Rhône",
                "Vin-de-France",
                "Domaine les Bruyères",
                2023,
                30,
            ),
            (
                "Marc Delienne Mon Blanc",
                "Rosés",
                "Beaujolais",
                "Vin-de-France",
                "Marc Delienne",
                2023,
                27,
            ),
            # Bulles
            (
                "Bertrand-Delespierre Enfant de la Montagne",
                "Bulles",
                "Rhône",
                "Champagne",
                "Bertrand-Delespierre",
                None,
                63,
            ),
            (
                "Bertrand-Delespierre Villedommange",
                "Bulles",
                "Rhône",
                "Champagne",
                "Bertrand-Delespierre",
                2018,
                101,
            ),
            (
                "Courstheur-Bonnard En Osmose",
                "Bulles",
                "Rhône",
                "Champagne",
                "Courstheur-Bonnard",
                2020,
                95,
            ),
            (
                "Domaine Thibert Crémant",
                "Bulles",
                "Bourgogne",
                "Crémant-de-Bourgogne",
                "Domaine Thibert",
                2019,
                30,
            ),
            (
                "Céline et Laurent Tripoz Nature",
                "Bulles",
                "Bourgogne",
                "Crémant-de-Bourgogne",
                "Céline et Laurent Tripoz",
                None,
                36,
            ),
            (
                "Château de Lavernette Granit",
                "Bulles",
                "Mâcon",
                "Vin-de-France",
                "Château de Lavernette",
                None,
                31,
            ),
            (
                "Jean-Marie Chaland Perle de Roche",
                "Bulles",
                "Mâcon",
                "Vin-de-France",
                "Jean-Marie Chaland",
                None,
                33,
            ),
            (
                "Marc Delienne Le Petit Nat",
                "Bulles",
                "Beaujolais",
                "Vin-de-France",
                "Marc Delienne",
                2022,
                36,
            ),
            (
                "Bret Brothers Bret Nat",
                "Bulles",
                "Beaujolais",
                "Vin-de-France",
                "Bret Brothers",
                2022,
                44,
            ),
            (
                "Clos Sauvage Naïf",
                "Bulles",
                "Beaujolais",
                "Vin-de-France",
                "Clos Sauvage",
                2024,
                34,
            ),
            (
                "Céline et Laurent Tripoz Fleur d'Aligoté",
                "Bulles",
                "Bourgogne",
                "Vin-de-France",
                "Céline et Laurent Tripoz",
                None,
                31,
            ),
            ("La Cuverie Cerdon", "Bulles", "Bugey", "Cerdon", "La Cuverie", 2023, 30),
            # Macération
            (
                "Domaine Binner Si Rose",
                "Macération",
                "Alsace",
                "Vin-de-France",
                "Domaine Binner",
                None,
                50,
            ),
            (
                "Clos des Vignes du Maynes Maxération",
                "Macération",
                "Mâcon",
                "Vin-de-France",
                "Clos des Vignes du Maynes",
                2022,
                50,
            ),
            (
                "Domaine Viret Horus",
                "Macération",
                "Rhône",
                "Vin-de-France",
                "Domaine Viret",
                None,
                44,
            ),
            (
                "Château de la Trochoire Macération",
                "Macération",
                "Loire",
                "Vin-de-France",
                "Château de la Trochoire",
                2020,
                36,
            ),
            (
                "Domaine Chardigny Macération",
                "Macération",
                "Mâcon",
                "Saint-Véran",
                "Domaine Chardigny",
                2022,
                36,
            ),
        ]

        for wine_data in wines:
            (
                name,
                category_name,
                region_name,
                appellation_name,
                domain,
                vintage,
                price,
            ) = wine_data

            # Get or create the wine reference
            reference, created = Reference.objects.get_or_create(
                name=name,
                domain=domain,
                defaults={
                    "category": categories.get(category_name),
                    "region": regions.get(region_name),
                    "appellation": appellations.get(appellation_name),
                    "vintage": vintage,
                    "current_quantity": 10,
                },
            )

            if created:
                self.stdout.write(f"Created reference: {name}")

    def create_purchases(self):
        """Create sample purchase history for references"""
        references = list(Reference.objects.all())

        for reference in references:
            # Create 1-5 random purchases for each reference
            num_purchases = random.randint(1, 5)

            for _ in range(num_purchases):
                # Random date within the last 2 years
                days_ago = random.randint(1, 730)
                purchase_date = datetime.now().date() - timedelta(days=days_ago)

                # Random quantity (1-24 bottles)
                quantity = random.randint(1, 24)

                # Random price variation around a base price
                base_price = random.randint(15, 150)
                price_variation = random.uniform(0.8, 1.2)
                price = Decimal(str(round(base_price * price_variation, 2)))

                Purchase.objects.create(
                    reference=reference,
                    date=purchase_date,
                    quantity=quantity,
                    price=price,
                )
