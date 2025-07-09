import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReferenceDetails } from '../components/reference-form';

// Mock scrollIntoView
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: vi.fn(),
});

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

describe('Simple Category Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add new category via server API when created', async () => {
    const mockOnClose = vi.fn();
    
    // Mock categories API to return existing categories
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(['Red', 'White']),
      })
      // Mock category creation API
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      // Mock categories refetch after creation
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(['Red', 'White', 'Rosé']),
      });

    render(
      <ReferenceDetails reference={null} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );

    // Wait for categories to load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/categories');
    });

    // Wait for the category field to be rendered
    await waitFor(() => {
      expect(screen.getByText('Category')).toBeInTheDocument();
    });

    // Click the category select to open the dropdown
    const categorySelect = screen.getByRole('combobox');
    fireEvent.mouseDown(categorySelect);
    
    // Wait for dropdown to open and click the "Add new category" button
    await waitFor(() => {
      const addCategoryButton = screen.getByText('Add new category');
      fireEvent.click(addCategoryButton);
    });

    // Type new category name
    const newCategoryInput = screen.getByPlaceholderText('Category name');
    fireEvent.change(newCategoryInput, { target: { value: 'Rosé' } });

    // Click Add button
    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    // Should call the API to create category
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Rosé' }),
      });
    });

    // Should go back to select mode
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Category name')).not.toBeInTheDocument();
    });
  });
});