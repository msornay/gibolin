import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { DataTable } from '../components/data-table';
import { ReferenceDetails } from '../components/reference-form';

// Mock data
const mockReferences = [
  { sqid: '1', name: 'Wine 1', domain: 'test1.com', vintage: 2020 },
  { sqid: '2', name: 'Wine 2', domain: 'test2.com', vintage: 2021 },
];

const mockColumns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'domain', header: 'Domain' },
  { accessorKey: 'vintage', header: 'Vintage' },
  {
    id: 'edit',
    cell: ({ row }: any) => (
      <button onClick={() => console.log('Edit', row.original)}>Edit</button>
    ),
  },
];

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

describe('Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders table with data and allows creating new reference', async () => {
    const wrapper = createWrapper();
    let isModalOpen = false;
    
    const MockApp = () => {
      const [modalOpen, setModalOpen] = React.useState(false);
      
      return (
        <div>
          <DataTable
            columns={mockColumns}
            data={mockReferences}
            onNew={() => setModalOpen(true)}
          />
          {modalOpen && (
            <div data-testid="modal">
              <ReferenceDetails 
                reference={null} 
                onClose={() => setModalOpen(false)} 
              />
            </div>
          )}
        </div>
      );
    };
    
    render(<MockApp />, { wrapper });
    
    // Check if table renders with data
    expect(screen.getByText('Wine 1')).toBeInTheDocument();
    expect(screen.getByText('Wine 2')).toBeInTheDocument();
    
    // Click New button
    const newButton = screen.getByText('New');
    fireEvent.click(newButton);
    
    // Check if modal opens
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });
    
    // Check if form is rendered in modal
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Domain')).toBeInTheDocument();
    expect(screen.getByLabelText('Vintage')).toBeInTheDocument();
  });

  it('handles API success for reference creation', async () => {
    const wrapper = createWrapper();
    
    // Mock successful API response
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sqid: 'new123' }),
      })
    );
    
    const MockApp = () => {
      const [modalOpen, setModalOpen] = React.useState(true);
      
      return (
        <div>
          <ReferenceDetails 
            reference={null} 
            onClose={() => setModalOpen(false)} 
          />
        </div>
      );
    };
    
    render(<MockApp />, { wrapper });
    
    // Fill form
    const nameInput = screen.getByLabelText('Name');
    const domainInput = screen.getByLabelText('Domain');
    const vintageInput = screen.getByLabelText('Vintage');
    
    fireEvent.change(nameInput, { target: { value: 'Test Wine' } });
    fireEvent.change(domainInput, { target: { value: 'test.com' } });
    fireEvent.change(vintageInput, { target: { value: '2020' } });
    
    // Submit form
    const submitButton = screen.getByText('Submit');
    fireEvent.click(submitButton);
    
    // Verify API call
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/ref',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Test Wine',
            domain: 'test.com',
            vintage: 2020,
          }),
        })
      );
    });
  });

  it('handles search functionality', () => {
    const wrapper = createWrapper();
    let searchValue = '';
    
    const MockApp = () => {
      const [search, setSearch] = React.useState('');
      
      const filteredData = mockReferences.filter(ref =>
        ref.name.toLowerCase().includes(search.toLowerCase())
      );
      
      return (
        <div>
          <input
            data-testid="search-input"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <DataTable
            columns={mockColumns}
            data={filteredData}
            onNew={() => {}}
          />
        </div>
      );
    };
    
    render(<MockApp />, { wrapper });
    
    // Initially shows both wines
    expect(screen.getByText('Wine 1')).toBeInTheDocument();
    expect(screen.getByText('Wine 2')).toBeInTheDocument();
    
    // Search for Wine 1
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'Wine 1' } });
    
    // Should only show Wine 1
    expect(screen.getByText('Wine 1')).toBeInTheDocument();
    expect(screen.queryByText('Wine 2')).not.toBeInTheDocument();
  });
});