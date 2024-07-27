"use client";

import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";

import { createBrowserRouter, RouterProvider } from "react-router-dom";

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { useDebounce } from "@uidotdev/usehooks";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ReferenceDetails } from "@/components/reference-form";

const queryClient = new QueryClient();

interface DataTableProps<TData, TValue, TDispatch> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  setFilter: TDispatch;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  textSearch,
  setTextSearch,
}: DataTableProps<TData, TValue, TDispatch>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder="Filter references..."
            className="h-8 w-[150px] lg:w-[250px]"
            value={textSearch}
            onChange={(e) => setTextSearch(e.target.value)}
          />
        </div>
        <Button asChild className="h-8">
          <a href="/ref/new"> New </a>
        </Button>
      </div>
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
                            header.getContext(),
                          )}
                    </TableHead>
                  );
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
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export type Reference = {
  sqid: string;
  name: string;
  domain: string;
  vintage: int;
};

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
  {
    id: "edit",
    cell: ({ row }) => {
      const reference = row.original;

      return <a href={`/ref/${reference.sqid}`}>Edit</a>;
    },
  },
];

export type RefsResponse = {
  count: int;
  items: Reference[];
};

const fetchReferences = async (
  page = 0,
  search = "",
): Promise<RefsResponse> => {
  const response = await fetch(
    `http://localhost:8000/api/refs?page=${page}${
      search ? `&search=${search}` : ""
    }`,
  );
  return await response.json();
};

export default function ReferenceTable() {
  const [page, setPage] = React.useState<int>(0);
  const [search, setSearch] = React.useState<string>("");

  const debouncedSearch = useDebounce(search, 500);

  const { isLoading, error, data } = useQuery({
    queryKey: ["references", page, search],
    queryFn: () => fetchReferences(page, search),
  });

  if (isLoading) {
    /* XXX(msy) proper loading component */
    return <div>Loading...</div>;
  }

  if (error) {
    /* XXX(msy) proper error component */
    return <div>Error</div>;
  }

  /* XXX(msy) handle empty items list */

  return (
    <div className="container mx-auto py-10">
      <DataTable
        columns={columns}
        data={data["items"]}
        textSearch={search}
        setTextSearch={setSearch}
      />
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: "/refs",
    element: <ReferenceTable />,
  },
  {
    path: "/ref/new",
    element: <ReferenceDetails />,
  },
  {
    path: "/ref/:sqid",
    element: <ReferenceDetails />,
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  /* XXX(msy) is this really the way to use query + router? */
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
