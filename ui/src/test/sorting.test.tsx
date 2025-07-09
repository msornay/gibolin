import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Reference } from '../index';

const mockReferences: Reference[] = [
  { sqid: '1', name: 'apple Wine', category: 'Red', domain: 'Apple.com', vintage: 2020, purchases: [] },
  { sqid: '2', name: 'Banana Wine', category: 'White', domain: 'banana.com', vintage: 2021, purchases: [] },
  { sqid: '3', name: 'Cherry Wine', category: 'Rose', domain: 'CHERRY.com', vintage: 2019, purchases: [] },
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
  const mockColumns: ColumnsType<Reference> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()),
    },
    {
      title: 'Domain',
      dataIndex: 'domain',
      key: 'domain',
      sorter: (a, b) => {
        const aVal = a.domain || '';
        const bVal = b.domain || '';
        return aVal.toLowerCase().localeCompare(bVal.toLowerCase());
      },
      render: (domain) => domain || '-',
    },
    {
      title: 'Vintage',
      dataIndex: 'vintage',
      key: 'vintage',
      sorter: (a, b) => (a.vintage || 0) - (b.vintage || 0),
      render: (vintage) => vintage || '-',
    },
  ];

  it('sorts names case-insensitively', () => {
    const wrapper = createWrapper();
    
    render(
      <Table
        columns={mockColumns}
        dataSource={mockReferences}
        rowKey="sqid"
        pagination={false}
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
      <Table
        columns={mockColumns}
        dataSource={mockReferences}
        rowKey="sqid"
        pagination={false}
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
      <Table
        columns={mockColumns}
        dataSource={mockReferences}
        rowKey="sqid"
        pagination={false}
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