import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataTable } from '../components/data-table';
import { Reference } from '../index';

const mockReferences: Reference[] = [
  { sqid: '1', name: 'apple Wine', domain: 'Apple.com', vintage: 2020 },
  { sqid: '2', name: 'Banana Wine', domain: 'banana.com', vintage: 2021 },
  { sqid: '3', name: 'Cherry Wine', domain: 'CHERRY.com', vintage: 2019 },
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

describe('Table Sorting', () => {
  const mockColumns = [
    {
      accessorKey: 'name',
      header: 'Name',
      enableSorting: true,
      sortingFn: (rowA: any, rowB: any) => {
        const a = rowA.getValue('name') as string;
        const b = rowB.getValue('name') as string;
        return a.toLowerCase().localeCompare(b.toLowerCase());
      },
    },
    {
      accessorKey: 'domain',
      header: 'Domain',
      enableSorting: true,
      sortingFn: (rowA: any, rowB: any) => {
        const a = rowA.getValue('domain') as string;
        const b = rowB.getValue('domain') as string;
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        return a.toLowerCase().localeCompare(b.toLowerCase());
      },
    },
    {
      accessorKey: 'vintage',
      header: 'Vintage',
      enableSorting: true,
    },
  ];

  it('sorts names case-insensitively', () => {
    const wrapper = createWrapper();
    
    render(
      <DataTable
        columns={mockColumns}
        data={mockReferences}
        onNew={() => {}}
      />,
      { wrapper }
    );

    // Click name header to sort
    const nameHeader = screen.getByText('Name');
    fireEvent.click(nameHeader);

    // Get all name cells in order
    const nameCells = screen.getAllByText(/Wine$/);
    
    // Should be sorted case-insensitively: apple, Banana, Cherry
    expect(nameCells[0]).toHaveTextContent('apple Wine');
    expect(nameCells[1]).toHaveTextContent('Banana Wine');
    expect(nameCells[2]).toHaveTextContent('Cherry Wine');
  });

  it('sorts domains case-insensitively', () => {
    const wrapper = createWrapper();
    
    render(
      <DataTable
        columns={mockColumns}
        data={mockReferences}
        onNew={() => {}}
      />,
      { wrapper }
    );

    // Click domain header to sort
    const domainHeader = screen.getByText('Domain');
    fireEvent.click(domainHeader);

    // Get all domain cells in order
    const domainCells = screen.getAllByText(/\.com$/);
    
    // Should be sorted case-insensitively: Apple.com, banana.com, CHERRY.com
    expect(domainCells[0]).toHaveTextContent('Apple.com');
    expect(domainCells[1]).toHaveTextContent('banana.com');
    expect(domainCells[2]).toHaveTextContent('CHERRY.com');
  });

  it('reverses sort order on second click', () => {
    const wrapper = createWrapper();
    
    render(
      <DataTable
        columns={mockColumns}
        data={mockReferences}
        onNew={() => {}}
      />,
      { wrapper }
    );

    // Click name header twice to sort descending
    const nameHeader = screen.getByText('Name');
    fireEvent.click(nameHeader);
    fireEvent.click(nameHeader);

    // Get all name cells in order
    const nameCells = screen.getAllByText(/Wine$/);
    
    // Should be sorted descending: Cherry, Banana, apple
    expect(nameCells[0]).toHaveTextContent('Cherry Wine');
    expect(nameCells[1]).toHaveTextContent('Banana Wine');
    expect(nameCells[2]).toHaveTextContent('apple Wine');
  });
});