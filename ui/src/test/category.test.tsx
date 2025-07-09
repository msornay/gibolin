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

describe('Category Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow creating a new category', async () => {
    const mockOnClose = vi.fn();
    
    // Mock categories API to return existing categories
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(['Bordeaux', 'Burgundy']),
      })
      // Mock category creation
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      // Mock categories refetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(['Bordeaux', 'Burgundy', 'Champagne']),
      })
      // Mock reference creation
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sqid: 'new123' }),
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

    // Should show input field for new category
    const newCategoryInput = screen.getByPlaceholderText('Category name');
    expect(newCategoryInput).toBeInTheDocument();

    // Type new category name
    fireEvent.change(newCategoryInput, { target: { value: 'Champagne' } });

    // Click Add button
    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    // Should hide the input and show the category in the select
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Category name')).not.toBeInTheDocument();
    });

    // Fill in the rest of the form
    const nameInput = screen.getByLabelText('Name');
    const domainInput = screen.getByLabelText('Domain');
    const vintageInput = screen.getByLabelText('Vintage');

    fireEvent.change(nameInput, { target: { value: 'Test Champagne' } });
    fireEvent.change(domainInput, { target: { value: 'test.com' } });
    fireEvent.change(vintageInput, { target: { value: '2020' } });

    // Submit form
    const submitButton = screen.getByText('Create Reference');
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
  });

  it('should allow canceling new category creation', async () => {
    const mockOnClose = vi.fn();
    
    // Mock categories API
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

    // Should show input field for new category
    const newCategoryInput = screen.getByPlaceholderText('Category name');
    expect(newCategoryInput).toBeInTheDocument();

    // Type something
    fireEvent.change(newCategoryInput, { target: { value: 'Champagne' } });

    // Click Cancel button
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Should hide the input and go back to select
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Category name')).not.toBeInTheDocument();
    });
    
    // Should show the select again
    expect(screen.getByText('Select category')).toBeInTheDocument();
  });
});