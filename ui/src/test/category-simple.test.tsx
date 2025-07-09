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

  it('should add new category to local state when created', async () => {
    const mockOnClose = vi.fn();
    
    // Mock categories API to return existing categories
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(['Red', 'White']),
    });

    render(
      <ReferenceDetails reference={null} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );

    // Wait for categories to load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/categories');
    });

    // Click the "+" button to add a new category
    const addCategoryButton = screen.getByText('+');
    fireEvent.click(addCategoryButton);

    // Type new category name
    const newCategoryInput = screen.getByPlaceholderText('New category');
    fireEvent.change(newCategoryInput, { target: { value: 'Rosé' } });

    // Click Add button
    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    // Should go back to select mode
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('New category')).not.toBeInTheDocument();
    });

    // The select should show the new category as selected
    const selectTrigger = screen.getByRole('combobox');
    expect(selectTrigger).toHaveTextContent('Rosé');
  });
});