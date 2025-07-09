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

describe('Category Dropdown Issue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show newly added category in dropdown options after creating it', async () => {
    const mockOnClose = vi.fn();
    
    // Mock categories API to return existing categories
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(['Bordeaux', 'Burgundy']),
    });

    render(
      <ReferenceDetails reference={null} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );

    // Wait for categories to load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/categories');
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
    fireEvent.change(newCategoryInput, { target: { value: 'Champagne' } });

    // Click Add button
    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    // The form should now show the new category as selected
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Category name')).not.toBeInTheDocument();
    });

    // Now click the category select to open the dropdown again
    const categorySelect2 = screen.getByRole('combobox');
    fireEvent.mouseDown(categorySelect2);
    
    // Wait for dropdown to open and click the "Add new category" button
    await waitFor(() => {
      const addCategoryButton2 = screen.getByText('Add new category');
      fireEvent.click(addCategoryButton2);
    });

    // Should show input again
    const newCategoryInput2 = screen.getByPlaceholderText('Category name');
    expect(newCategoryInput2).toBeInTheDocument();

    // Cancel to go back to dropdown
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Now click on the dropdown to open it
    const selectTrigger = screen.getByRole('combobox');
    fireEvent.click(selectTrigger);

    // The dropdown should now include the newly added "Champagne" category
    // This is the ISSUE - it won't be there because it's not in the categories list
    await waitFor(() => {
      // These should be visible in the dropdown
      expect(screen.getByText('Bordeaux')).toBeInTheDocument();
      expect(screen.getByText('Burgundy')).toBeInTheDocument();
      
      // This is the failing assertion - Champagne won't be in the dropdown
      // even though it was just added
      expect(screen.getByText('Champagne')).toBeInTheDocument();
    });
  });

  it('should preserve custom category even when switching back to dropdown', async () => {
    const mockOnClose = vi.fn();
    
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

    // Click the category select to open the dropdown
    const categorySelect = screen.getByRole('combobox');
    fireEvent.mouseDown(categorySelect);
    
    // Wait for dropdown to open and click the "Add new category" button
    await waitFor(() => {
      const addCategoryButton = screen.getByText('Add new category');
      fireEvent.click(addCategoryButton);
    });

    const newCategoryInput = screen.getByPlaceholderText('Category name');
    fireEvent.change(newCategoryInput, { target: { value: 'Rosé' } });

    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    // Verify it's set as the current value
    const selectTrigger = screen.getByRole('combobox');
    expect(selectTrigger).toHaveTextContent('Rosé');

    // Try to open dropdown to select something else
    fireEvent.click(selectTrigger);

    // The dropdown should show the original categories AND the newly added one
    await waitFor(() => {
      expect(screen.getByText('Red')).toBeInTheDocument();
      expect(screen.getByText('White')).toBeInTheDocument();
      // This will fail because Rosé is not in the dropdown options
      expect(screen.getByText('Rosé')).toBeInTheDocument();
    });
  });
});