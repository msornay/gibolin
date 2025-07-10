import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { 
  Table, 
  Input, 
  Button, 
  Modal, 
  Space,
  Typography,
  App as AntApp,
  List,
  Card
} from "antd";
import { EditOutlined, PlusOutlined, ExportOutlined, HolderOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

import { ReferenceDetails } from "@/components/reference-form";

const { Title } = Typography;
const { Search } = Input;

// Types
export type Purchase = {
  id: number;
  date: string;
  quantity: number;
  price: number;
};

export type Reference = {
  sqid: string;
  name: string;
  category?: string;
  domain?: string;
  vintage?: number;
  purchases: Purchase[];
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


function ReferenceTable() {
  const [search, setSearch] = React.useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedReference, setSelectedReference] = React.useState<Reference | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [categoryOrder, setCategoryOrder] = React.useState<string[]>([]);
  const queryClient = useQueryClient();

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

  const handleExport = React.useCallback(() => {
    setIsExportModalOpen(true);
  }, []);

  const handleExportModalClose = React.useCallback(() => {
    setIsExportModalOpen(false);
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

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => 
      fetch('http://localhost:8000/api/categories').then(res => res.json()),
  });

  // Set category order from server data (already ordered by server)
  React.useEffect(() => {
    if (categories) {
      setCategoryOrder([...categories]);
    }
  }, [categories]);

  // Save category order to server
  const saveCategoryOrderMutation = useMutation({
    mutationFn: (newOrder: string[]) =>
      fetch('http://localhost:8000/api/categories/order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: newOrder }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const saveCategoryOrder = React.useCallback((newOrder: string[]) => {
    setCategoryOrder(newOrder);
    saveCategoryOrderMutation.mutate(newOrder);
  }, [saveCategoryOrderMutation]);

  // Handle drag end for category reordering
  const handleCategoryDragEnd = React.useCallback((fromIndex: number, toIndex: number) => {
    const newOrder = [...categoryOrder];
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);
    saveCategoryOrder(newOrder);
  }, [categoryOrder, saveCategoryOrder]);

  const columns: ColumnsType<Reference> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()),
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      sorter: (a, b) => {
        const aVal = a.category || "";
        const bVal = b.category || "";
        return aVal.toLowerCase().localeCompare(bVal.toLowerCase());
      },
      render: (category) => category || "-",
    },
    {
      title: "Domain",
      dataIndex: "domain",
      key: "domain",
      sorter: (a, b) => {
        const aVal = a.domain || "";
        const bVal = b.domain || "";
        return aVal.toLowerCase().localeCompare(bVal.toLowerCase());
      },
      render: (domain) => domain || "-",
    },
    {
      title: "Vintage",
      dataIndex: "vintage",
      key: "vintage",
      sorter: (a, b) => (a.vintage || 0) - (b.vintage || 0),
      render: (vintage) => vintage || "-",
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Button
          type="text"
          icon={<EditOutlined />}
          onClick={() => handleEditReference(record)}
        />
      ),
    },
  ];

  if (error) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <Title level={4} type="danger">Error loading references</Title>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <Title level={2} style={{ margin: 0 }}>References</Title>
        <Button
          icon={<ExportOutlined />}
          onClick={handleExport}
        >
          Export
        </Button>
      </div>
      
      <Space style={{ marginBottom: "16px" }}>
        <Search
          placeholder="Filter references..."
          allowClear
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={{ width: 250 }}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleNewReference}
        >
          New
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={data?.items || []}
        loading={isLoading}
        rowKey="sqid"
        pagination={false}
        size="small"
      />

      <Modal
        title={selectedReference ? "Edit Reference" : "New Reference"}
        open={isModalOpen}
        onCancel={handleCloseModal}
        footer={null}
        width={800}
        destroyOnHidden
      >
        <ReferenceDetails
          reference={selectedReference}
          onClose={handleCloseModal}
        />
      </Modal>

      <Modal
        title="Export Settings"
        open={isExportModalOpen}
        onCancel={handleExportModalClose}
        footer={[
          <Button key="cancel" onClick={handleExportModalClose}>
            Cancel
          </Button>,
          <Button key="export" type="primary" onClick={handleExportModalClose}>
            Export
          </Button>,
        ]}
        width={600}
      >
        <div style={{ marginBottom: '16px' }}>
          <Typography.Text strong>Category Order</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ marginTop: '4px' }}>
            Drag categories to reorder them. This order will be used for export and will persist.
          </Typography.Paragraph>
        </div>
        
        <Card size="small">
          {categoryOrder.map((category, index) => (
            <div
              key={category}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', index.toString());
              }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                handleCategoryDragEnd(fromIndex, index);
              }}
              style={{
                padding: '8px 12px',
                margin: '4px 0',
                backgroundColor: '#f9f9f9',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                cursor: 'move',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <HolderOutlined style={{ color: '#999' }} />
              {category || 'Uncategorized'}
            </div>
          ))}
          {categoryOrder.length === 0 && (
            <Typography.Text type="secondary">No categories found</Typography.Text>
          )}
        </Card>
      </Modal>
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

const rootElement = document.getElementById("root")!;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <RouterProvider router={router} />
      </AntApp>
    </QueryClientProvider>
  </React.StrictMode>,
);
