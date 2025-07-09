import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { ReferenceDetails } from "@/components/reference-form";

// Types
export type Reference = {
  sqid: string;
  name: string;
  domain: string;
  vintage: number;
};

export type RefsResponse = {
  count: number;
  items: Reference[];
};

// API Functions
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

const columns: ColumnDef<Reference>[] = [
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

function ReferenceTable() {
  const [search, setSearch] = React.useState<string>("");

  const { isLoading, error, data } = useQuery({
    queryKey: ["references", search],
    queryFn: () => fetchReferences(0, search),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center justify-center h-32">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center justify-center h-32">
          <div className="text-lg text-red-600">Error loading references</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">References</h1>
      <DataTable
        columns={columns}
        data={data?.items || []}
        textSearch={search}
        setTextSearch={setSearch}
      />
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <ReferenceTable />,
  },
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

// App Setup
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
