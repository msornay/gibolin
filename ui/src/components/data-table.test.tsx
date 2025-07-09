import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DataTable } from './data-table';

const mockData = [
  { sqid: '1', name: 'Wine 1', domain: 'test1.com', vintage: 2020 },
  { sqid: '2', name: 'Wine 2', domain: 'test2.com', vintage: 2021 },
];

const mockColumns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'domain', header: 'Domain' },
  { accessorKey: 'vintage', header: 'Vintage' },
];

describe('DataTable', () => {
  it('renders table with data', () => {
    const mockOnNew = vi.fn();
    
    render(<DataTable columns={mockColumns} data={mockData} onNew={mockOnNew} />);
    
    // Check if table headers are rendered
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Domain')).toBeInTheDocument();
    expect(screen.getByText('Vintage')).toBeInTheDocument();
    
    // Check if data is rendered
    expect(screen.getByText('Wine 1')).toBeInTheDocument();
    expect(screen.getByText('test1.com')).toBeInTheDocument();
    expect(screen.getByText('2020')).toBeInTheDocument();
    expect(screen.getByText('Wine 2')).toBeInTheDocument();
  });

  it('renders New button and calls onNew when clicked', () => {
    const mockOnNew = vi.fn();
    
    render(<DataTable columns={mockColumns} data={mockData} onNew={mockOnNew} />);
    
    const newButton = screen.getByText('New');
    expect(newButton).toBeInTheDocument();
    
    fireEvent.click(newButton);
    expect(mockOnNew).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when no data', () => {
    const mockOnNew = vi.fn();
    
    render(<DataTable columns={mockColumns} data={[]} onNew={mockOnNew} />);
    
    expect(screen.getByText('No results.')).toBeInTheDocument();
  });

  it('renders table structure correctly', () => {
    const mockOnNew = vi.fn();
    
    render(<DataTable columns={mockColumns} data={mockData} onNew={mockOnNew} />);
    
    // Check table structure
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
    expect(screen.getAllByRole('row')).toHaveLength(3); // 1 header + 2 data rows
  });
});