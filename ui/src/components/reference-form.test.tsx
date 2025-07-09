import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReferenceDetails } from './reference-form';

// Mock the react-router-dom since we're not using it in the modal version
vi.mock('react-router-dom', () => ({
  useParams: () => ({ sqid: undefined }),
  useNavigate: () => vi.fn(),
}));

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

describe('ReferenceDetails', () => {
  it('renders form for new reference', () => {
    const mockOnClose = vi.fn();
    
    render(
      <ReferenceDetails reference={null} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    // Check if form fields are rendered
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Domain')).toBeInTheDocument();
    expect(screen.getByLabelText('Vintage')).toBeInTheDocument();
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('renders form with default values for new reference', () => {
    const mockOnClose = vi.fn();
    
    render(
      <ReferenceDetails reference={null} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    const domainInput = screen.getByLabelText('Domain') as HTMLInputElement;
    const vintageInput = screen.getByLabelText('Vintage') as HTMLInputElement;
    
    expect(nameInput.value).toBe('');
    expect(domainInput.value).toBe('');
    expect(vintageInput.value).toBe('2023');
  });

  it('shows loading state for existing reference', async () => {
    const mockOnClose = vi.fn();
    const mockReference = {
      sqid: 'test123',
      name: 'Test Wine',
      domain: 'test.com',
      vintage: 2020,
    };
    
    // Mock fetch to return a pending promise
    global.fetch = vi.fn(() => new Promise(() => {}));
    
    render(
      <ReferenceDetails reference={mockReference} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('form elements work correctly', async () => {
    const mockOnClose = vi.fn();
    
    render(
      <ReferenceDetails reference={null} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    const nameInput = screen.getByLabelText('Name');
    const submitButton = screen.getByText('Submit');
    
    // Test that we can type in the input
    fireEvent.change(nameInput, { target: { value: 'Test Wine' } });
    expect(nameInput).toHaveValue('Test Wine');
    
    // Test that submit button is clickable
    expect(submitButton).toBeEnabled();
  });

  it('submits form with valid data', async () => {
    const mockOnClose = vi.fn();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sqid: 'new123' }),
      })
    );
    
    render(
      <ReferenceDetails reference={null} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    const nameInput = screen.getByLabelText('Name');
    const domainInput = screen.getByLabelText('Domain');
    const vintageInput = screen.getByLabelText('Vintage');
    
    fireEvent.change(nameInput, { target: { value: 'Test Wine' } });
    fireEvent.change(domainInput, { target: { value: 'test.com' } });
    fireEvent.change(vintageInput, { target: { value: '2020' } });
    
    const submitButton = screen.getByText('Submit');
    fireEvent.click(submitButton);
    
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
});