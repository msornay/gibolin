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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

// Define columns as a function to access the edit handler
const createColumns = (onEdit: (reference: Reference) => void): ColumnDef<Reference>[] => [
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

      return (
        <button
          onClick={() => onEdit(reference)}
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Edit
        </button>
      );
    },
  },
];

function ReferenceTable() {
  const [search, setSearch] = React.useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedReference, setSelectedReference] = React.useState<Reference | null>(null);

  const handleSearchChange = React.useCallback((value: string) => {
    setSearch(value);
  }, []);

  const handleNewReference = React.useCallback(() => {
    setSelectedReference(null);
    setIsModalOpen(true);
  }, []);

  const handleEditReference = React.useCallback((reference: Reference) => {
    setSelectedReference(reference);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = React.useCallback(() => {
    setIsModalOpen(false);
    setSelectedReference(null);
  }, []);

  // Debounce search to prevent excessive API calls
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { isLoading, error, data } = useQuery({
    queryKey: ["references", debouncedSearch],
    queryFn: () => fetchReferences(0, debouncedSearch),
  });

  const columns = React.useMemo(() => createColumns(handleEditReference), [handleEditReference]);

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">References</h1>
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Input
            placeholder="Filter references..."
            className="h-8 w-[150px] lg:w-[250px]"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-lg">Loading...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-lg text-red-600">Error loading references</div>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={data?.items || []}
            onNew={handleNewReference}
          />
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedReference ? "Edit Reference" : "New Reference"}
            </DialogTitle>
          </DialogHeader>
          <ReferenceDetails
            reference={selectedReference}
            onClose={handleCloseModal}
          />
        </DialogContent>
      </Dialog>
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
