import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

// Test the type exports to ensure they are properly defined
import type { Reference, Purchase, RefsResponse } from "../index";

describe("Type definitions", () => {
  it("Reference type has required fields", () => {
    // Verify the type structure by creating a valid object
    const reference: Reference = {
      sqid: "abc123",
      name: "Test Wine",
      current_quantity: 10,
      price_multiplier: 3,
      hidden_from_menu: false,
      purchases: [],
    };

    expect(reference.sqid).toBe("abc123");
    expect(reference.name).toBe("Test Wine");
    expect(reference.current_quantity).toBe(10);
    expect(reference.price_multiplier).toBe(3);
    expect(reference.hidden_from_menu).toBe(false);
    expect(reference.purchases).toEqual([]);
  });

  it("Reference type supports optional fields", () => {
    const reference: Reference = {
      sqid: "def456",
      name: "Bordeaux Rouge",
      category: "Rouge",
      region: "Bordeaux",
      appellation: "Saint-Emilion",
      domain: "Château Test",
      vintage: 2020,
      current_quantity: 5,
      price_multiplier: 2.5,
      retail_price_override: 25,
      retail_price: 25,
      hidden_from_menu: true,
      purchases: [],
    };

    expect(reference.category).toBe("Rouge");
    expect(reference.region).toBe("Bordeaux");
    expect(reference.appellation).toBe("Saint-Emilion");
    expect(reference.domain).toBe("Château Test");
    expect(reference.vintage).toBe(2020);
    expect(reference.retail_price_override).toBe(25);
    expect(reference.retail_price).toBe(25);
  });

  it("Purchase type has required fields", () => {
    const purchase: Purchase = {
      id: 1,
      date: "2024-01-15",
      quantity: 6,
      price: 12.5,
    };

    expect(purchase.id).toBe(1);
    expect(purchase.date).toBe("2024-01-15");
    expect(purchase.quantity).toBe(6);
    expect(purchase.price).toBe(12.5);
  });

  it("RefsResponse type has count and items", () => {
    const response: RefsResponse = {
      count: 2,
      items: [
        {
          sqid: "abc",
          name: "Wine 1",
          current_quantity: 1,
          price_multiplier: 3,
          hidden_from_menu: false,
          purchases: [],
        },
        {
          sqid: "def",
          name: "Wine 2",
          current_quantity: 2,
          price_multiplier: 3,
          hidden_from_menu: false,
          purchases: [],
        },
      ],
    };

    expect(response.count).toBe(2);
    expect(response.items).toHaveLength(2);
    expect(response.items[0].name).toBe("Wine 1");
    expect(response.items[1].name).toBe("Wine 2");
  });
});

describe("React rendering", () => {
  it("renders a simple component", () => {
    const TestComponent = () => <div data-testid="test">Hello, Tests!</div>;
    render(<TestComponent />);
    expect(screen.getByTestId("test")).toHaveTextContent("Hello, Tests!");
  });
});
