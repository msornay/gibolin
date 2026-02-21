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
  InputNumber,
  Statistic,
  Tooltip
} from "antd";
import { EditOutlined, PlusOutlined, ExportOutlined, BarChartOutlined, EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

import { ReferenceDetails } from "@/components/reference-form";
import { API_BASE_URL } from "@/api";

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
  region?: string;
  appellation?: string;
  domain?: string;
  vintage?: number;
  current_quantity: number;
  price_multiplier: number;
  retail_price_override?: number;
  retail_price?: number;
  hidden_from_menu: boolean;
  purchases: Purchase[];
};

export type RefsResponse = {
  count: number;
  items: Reference[];
};

// API Functions
const fetchReferences = async (
  page = 1,
  search = "",
  limit = 20,
): Promise<RefsResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/api/refs?offset=${(page - 1) * limit}&limit=${limit}${
      search ? `&search=${search}` : ""
    }`,
    { cache: 'no-store' },
  );
  if (!response.ok) throw new Error(`${response.status}`);
  return await response.json();
};


function ReferenceTable() {
  const [search, setSearch] = React.useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>("");
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [pageSize, setPageSize] = React.useState<number>(20);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedReference, setSelectedReference] = React.useState<Reference | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = React.useState(false);
  const [menuTemplate, setMenuTemplate] = React.useState<string>("");
  const [editingQuantity, setEditingQuantity] = React.useState<string | null>(null);
  const [quantityValue, setQuantityValue] = React.useState<number>(0);
  const queryClient = useQueryClient();

  const handleSearchChange = React.useCallback((value: string) => {
    setSearch(value);
    setCurrentPage(1); // Reset to first page when searching
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

  const handleHtmlExport = React.useCallback(() => {
    // Open HTML export in new window for printing
    const exportUrl = `${API_BASE_URL}/api/export/html`;
    const printWindow = window.open(exportUrl, '_blank');
    
    if (printWindow) {
      // Wait for content to load, then trigger print dialog
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    }
    
    // Close the modal
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
    queryKey: ["references", debouncedSearch, currentPage, pageSize],
    queryFn: () => fetchReferences(currentPage, debouncedSearch, pageSize),
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      fetch(`${API_BASE_URL}/api/categories`, { cache: 'no-store' }).then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      }),
  });

  // Fetch menu template when export modal opens
  const { data: templateData } = useQuery({
    queryKey: ["menuTemplate"],
    queryFn: () =>
      fetch(`${API_BASE_URL}/api/menu/template`, { cache: 'no-store' }).then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      }),
    enabled: isExportModalOpen,
  });

  // Fetch stats when modal opens
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () =>
      fetch(`${API_BASE_URL}/api/stats`, { cache: 'no-store' }).then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      }),
    enabled: isStatsModalOpen,
  });

  // Set menu template from server data
  React.useEffect(() => {
    if (templateData?.content !== undefined) {
      setMenuTemplate(templateData.content);
    }
  }, [templateData]);

  // Save menu template
  const saveTemplateMutation = useMutation({
    mutationFn: (content: string) =>
      fetch(`${API_BASE_URL}/api/menu/template`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }),
  });

  // Update reference quantity
  const updateQuantityMutation = useMutation({
    mutationFn: ({ sqid, quantity }: { sqid: string; quantity: number }) =>
      fetch(`${API_BASE_URL}/api/ref/${sqid}/quantity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['references'] });
      setEditingQuantity(null);
    },
  });

  // Update hidden from menu
  const updateHiddenMutation = useMutation({
    mutationFn: ({ sqid, hidden, record }: { sqid: string; hidden: boolean; record: Reference }) =>
      fetch(`${API_BASE_URL}/api/ref/${sqid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: record.name,
          category: record.category,
          region: record.region,
          appellation: record.appellation,
          domain: record.domain,
          vintage: record.vintage,
          current_quantity: record.current_quantity,
          price_multiplier: record.price_multiplier,
          retail_price_override: record.retail_price_override,
          hidden_from_menu: hidden,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['references'] });
    },
  });

  // Handle template save
  const handleSaveTemplate = React.useCallback(() => {
    saveTemplateMutation.mutate(menuTemplate);
  }, [menuTemplate, saveTemplateMutation]);

  // Handle generate template from current data
  const handleGenerateTemplate = React.useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/menu/template/generate`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${response.status}`);
    const data = await response.json();
    setMenuTemplate(data.content);
  }, []);

  // Handle quantity editing
  const handleQuantityEdit = React.useCallback((sqid: string, currentQuantity: number) => {
    setEditingQuantity(sqid);
    setQuantityValue(currentQuantity);
  }, []);

  const handleQuantitySave = React.useCallback((sqid: string) => {
    updateQuantityMutation.mutate({ sqid, quantity: quantityValue });
  }, [quantityValue, updateQuantityMutation]);

  const handleQuantityCancel = React.useCallback(() => {
    setEditingQuantity(null);
    setQuantityValue(0);
  }, []);

  const handleQuantityKeyPress = React.useCallback((e: React.KeyboardEvent, sqid: string) => {
    if (e.key === 'Enter') {
      handleQuantitySave(sqid);
    } else if (e.key === 'Escape') {
      handleQuantityCancel();
    }
  }, [handleQuantitySave, handleQuantityCancel]);

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
      title: "Region",
      dataIndex: "region",
      key: "region",
      sorter: (a, b) => {
        const aVal = a.region || "";
        const bVal = b.region || "";
        return aVal.toLowerCase().localeCompare(bVal.toLowerCase());
      },
      render: (region) => region || "-",
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
      title: "Appellation",
      dataIndex: "appellation",
      key: "appellation",
      sorter: (a, b) => {
        const aVal = a.appellation || "";
        const bVal = b.appellation || "";
        return aVal.toLowerCase().localeCompare(bVal.toLowerCase());
      },
      render: (appellation) => appellation || "-",
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          {editingQuantity === record.sqid ? (
            <Space>
              <InputNumber
                value={quantityValue}
                onChange={(value) => setQuantityValue(value || 0)}
                onKeyDown={(e) => handleQuantityKeyPress(e, record.sqid)}
                min={0}
                size="small"
                style={{ width: 80 }}
                placeholder="Qty"
                autoFocus
              />
              <Button
                size="small"
                type="primary"
                onClick={() => handleQuantitySave(record.sqid)}
                loading={updateQuantityMutation.isPending}
              >
                Save
              </Button>
              <Button
                size="small"
                onClick={handleQuantityCancel}
              >
                Cancel
              </Button>
            </Space>
          ) : (
            <Space>
              <Button
                size="small"
                onClick={() => handleQuantityEdit(record.sqid, record.current_quantity)}
                title={`Current quantity: ${record.current_quantity}`}
                style={{ width: 48, padding: '0 4px', textAlign: 'center' }}
              >
                {record.current_quantity}
              </Button>
              <Tooltip title={record.hidden_from_menu ? "Show in menu" : "Hide from menu"}>
                <Button
                  type="text"
                  icon={record.hidden_from_menu ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                  onClick={() => updateHiddenMutation.mutate({
                    sqid: record.sqid,
                    hidden: !record.hidden_from_menu,
                    record
                  })}
                  style={{ color: record.hidden_from_menu ? '#999' : undefined }}
                />
              </Tooltip>
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEditReference(record)}
              />
            </Space>
          )}
        </Space>
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
        <Space>
          <Button
            icon={<BarChartOutlined />}
            onClick={() => setIsStatsModalOpen(true)}
          >
            Stats
          </Button>
          <Button
            icon={<ExportOutlined />}
            onClick={handleExport}
          >
            Export
          </Button>
        </Space>
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
        rowClassName={(record) => record.hidden_from_menu ? 'row-hidden' : ''}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: data?.count || 0,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} of ${total} references`,
          onChange: (page, size) => {
            setCurrentPage(page);
            if (size !== pageSize) {
              setPageSize(size);
              setCurrentPage(1);
            }
          },
          onShowSizeChange: (current, size) => {
            setPageSize(size);
            setCurrentPage(1);
          },
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
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
          <Button key="export" type="primary" onClick={handleHtmlExport}>
            Print Menu
          </Button>,
        ]}
        width={600}
      >
        <div style={{ marginBottom: '16px' }}>
          <Typography.Text strong>Menu Template</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ marginTop: '4px' }}>
            Define menu order with: # Category, 2-space indent for Region, 4-space for Appellation.
            Items not listed appear alphabetically at the end.
          </Typography.Paragraph>
        </div>

        <Input.TextArea
          value={menuTemplate}
          onChange={(e) => setMenuTemplate(e.target.value)}
          rows={15}
          style={{ fontFamily: 'monospace', marginBottom: '12px' }}
          placeholder={"# Rouge\n  Bourgogne\n    Côte de Nuits\n# Blanc\n  Loire"}
        />

        <Space>
          <Button onClick={handleGenerateTemplate}>
            Generate from data
          </Button>
          <Button onClick={handleSaveTemplate} loading={saveTemplateMutation.isPending}>
            Save template
          </Button>
        </Space>
      </Modal>

      <Modal
        title="Cellar Statistics"
        open={isStatsModalOpen}
        onCancel={() => setIsStatsModalOpen(false)}
        footer={<Button onClick={() => setIsStatsModalOpen(false)}>Close</Button>}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Statistic title="Total References" value={stats?.total_references || 0} />
          <Statistic title="Total Bottles" value={stats?.total_bottles || 0} />
          <Statistic title="Total Value" value={stats?.total_value || 0} prefix="€" precision={2} />
        </Space>
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
