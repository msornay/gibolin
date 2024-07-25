"use client"

import "./index.css"

import React from 'react'
import ReactDOM from 'react-dom/client'

import {
    createBrowserRouter,
    RouterProvider,
} from 'react-router-dom'

import {
    QueryClient,
    QueryClientProvider,
    useQuery,
} from'@tanstack/react-query'

import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table"

import {
    Button
} from "@/components/ui/button"


import {
    Input
} from "@/components/ui/input"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import {
    ReferenceForm
} from "@/components/reference-form"

const queryClient = new QueryClient()

interface DataTableToolbarProps<TData> {
    table: Table<TData>
}


export function DataTableToolbar<TData>({
    table,
}: DataTableToolbarProps<TData>) {
    return (
        <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input placeholder="Filter references..." className="h-8 w-[150px] lg:w-[250px]" />
        </div>
          <Button asChild className="h-8">
            <a href="new"> New </a>
          </Button>
        </div>
    )
}

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
        <div className="space-y-4">
        <DataTableToolbar table={table} />
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

export default function ReferenceTable() {

    const { isLoading, error, data } = useQuery({
        queryKey: ['references'],
        queryFn: () =>
        fetch('http://localhost:8000/api/refs').then(
            (res) => res.json()
        ),
    });

    if (isLoading) {
        /* XXX(msy) proper loading component */
        return <div>Loading...</div>
    }

    if (error) {
        /* XXX(msy) proper error component */
        return <div>Error</div>
    }

    /* XXX(msy) handle empty items list */

    console.log(data)

    return (
        <div className="container mx-auto py-10">
        <DataTable columns={columns} data={data["items"]} />
        </div>
    )
}

const router = createBrowserRouter([
    {
        path: "/refs",
        element: <ReferenceTable />,
    },
    {
        path: "/refs/new",
        element: <ReferenceForm />,
    },
]);


ReactDOM.createRoot(document.getElementById('root')!).render(
    /* XXX(msy) is this really the way to use query + router? */
    <React.StrictMode>
    <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
    </QueryClientProvider>
    </React.StrictMode>
);
