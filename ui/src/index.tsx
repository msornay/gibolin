"use client"

import "./index.css"

import React from 'react'
import ReactDOM from 'react-dom/client'

import {
    createBrowserRouter,
    RouterProvider,
} from 'react-router-dom'

import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export type Reference = {
    sqid: string
    name: string
    domain: string
    vintage: int
}

export const columns: ColumnDef<Reference>[] = [
    {
        accessorKey: "name",
        header: "Name",
    },
    {
        accessorKey: "domain",
        header: "Domain",
    },
    {
        accessorKey: "vintage",
        header: "Vintage",
    },
]

function getData(): Reference[] {
  // Fetch data from your API here.
  return [
    {
      "sqid": "728ed52f",
      "name": "React",
      "domain": "JavaScript",
      "vintage": 2013,
    },
  ]
}

export default function ReferenceTable() {
    const data = getData()

    return (
        <div className="container mx-auto py-10">
            <DataTable columns={columns} data={data} />
        </div>
    )
}

const router = createBrowserRouter([
    {
        path: "/",
        element: <ReferenceTable />,
    },
]);


ReactDOM.createRoot(document.getElementById('root')!).render(

    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
);
