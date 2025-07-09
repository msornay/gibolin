import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReferenceDetails } from '../components/reference-form';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Category Persistence Issue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should persist the new category after creation and form submission', async () => {
    const mockOnClose = vi.fn();
    
    // Mock the categories API to return different results on subsequent calls
    let categoriesCallCount = 0;
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === 'http://localhost:8000/api/categories') {
        categoriesCallCount++;
        if (categoriesCallCount === 1) {
          // Initial load - no categories
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          });
        } else {
          // After creation - should include the new category
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(['Champagne']),
          });
        }
      }
      
      // Mock the ref creation API
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sqid: 'new123' }),
      });
    });

    render(
      <ReferenceDetails reference={null} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );

    // Wait for categories to load (should be empty initially)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/categories');
    });

    // Fill in name first
    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Test Champagne' } });

    // Click the "+" button to add a new category
    const addCategoryButton = screen.getByText('+');
    fireEvent.click(addCategoryButton);

    // Type new category name
    const newCategoryInput = screen.getByPlaceholderText('New category');
    fireEvent.change(newCategoryInput, { target: { value: 'Champagne' } });

    // Click Add button
    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    // Fill in the rest of the form
    const domainInput = screen.getByLabelText('Domain');
    const vintageInput = screen.getByLabelText('Vintage');

    fireEvent.change(domainInput, { target: { value: 'test.com' } });
    fireEvent.change(vintageInput, { target: { value: '2020' } });

    // Submit form
    const submitButton = screen.getByText('Submit');
    fireEvent.click(submitButton);

    // Verify the form was submitted with the new category
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/ref',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Test Champagne',
            category: 'Champagne',
            domain: 'test.com',
            vintage: 2020,
          }),
        })
      );
    });

    // Check if categories were invalidated/refetched after submission
    // This should trigger a refetch of categories which would include the new one
    await waitFor(() => {
      expect(categoriesCallCount).toBeGreaterThan(1);
    });
  });

  it('should show the new category in the dropdown after creation', async () => {
    const mockOnClose = vi.fn();
    
    // Mock existing reference with the new category
    const mockReference = {
      sqid: 'test123',
      name: 'Test Wine',
      category: 'Champagne',
      domain: 'test.com',
      vintage: 2020,
      purchases: [],
    };

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === 'http://localhost:8000/api/categories') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(['Bordeaux', 'Burgundy', 'Champagne']),
        });
      }
      if (url === 'http://localhost:8000/api/ref/test123') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockReference),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(
      <ReferenceDetails reference={mockReference} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );

    // Wait for both categories and reference data to load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/categories');
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/ref/test123');
    });

    // Should show the category as selected in the dropdown
    await waitFor(() => {
      // The Select component should show the current value (Champagne)
      const selectTrigger = screen.getByRole('combobox');
      expect(selectTrigger).toHaveTextContent('Champagne');
    });
  });
});