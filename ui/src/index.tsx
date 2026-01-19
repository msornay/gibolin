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
  Card,
  InputNumber,
  Statistic,
  Tooltip
} from "antd";
import { EditOutlined, PlusOutlined, ExportOutlined, HolderOutlined, BarChartOutlined, EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import { SketchPicker } from "react-color";
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
    `http://localhost:8000/api/refs?offset=${(page - 1) * limit}&limit=${limit}${
      search ? `&search=${search}` : ""
    }`,
  );
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
  const [categoryOrder, setCategoryOrder] = React.useState<string[]>([]);
  const [menuStructure, setMenuStructure] = React.useState<any[]>([]);
  const [colorPickerOpen, setColorPickerOpen] = React.useState<string | null>(null);
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
    const exportUrl = 'http://localhost:8000/api/export/html';
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
      fetch('http://localhost:8000/api/categories').then(res => res.json()),
  });

  // Fetch menu structure for nested ordering
  const { data: menuStructureData } = useQuery({
    queryKey: ["menuStructure"],
    queryFn: () =>
      fetch('http://localhost:8000/api/menu/structure').then(res => res.json()),
    enabled: isExportModalOpen,
  });

  // Fetch stats when modal opens
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => fetch('http://localhost:8000/api/stats').then(res => res.json()),
    enabled: isStatsModalOpen,
  });

  // Set category order from server data (already ordered by server)
  React.useEffect(() => {
    if (categories) {
      setCategoryOrder([...categories]);
    }
  }, [categories]);

  // Set menu structure from server data
  React.useEffect(() => {
    if (menuStructureData?.structure) {
      setMenuStructure([...menuStructureData.structure]);
    }
  }, [menuStructureData]);

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

  // Save nested menu order to server
  const saveMenuOrderMutation = useMutation({
    mutationFn: (newStructure: any[]) =>
      fetch('http://localhost:8000/api/menu/order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: newStructure }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['menuStructure'] });
    },
  });

  // Save category color to server
  const saveCategoryColorMutation = useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      fetch('http://localhost:8000/api/categories/color', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menuStructure'] });
    },
  });

  // Update reference quantity
  const updateQuantityMutation = useMutation({
    mutationFn: ({ sqid, quantity }: { sqid: string; quantity: number }) =>
      fetch(`http://localhost:8000/api/ref/${sqid}/quantity`, {
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
      fetch(`http://localhost:8000/api/ref/${sqid}`, {
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

  // Handle drag end for nested menu reordering
  const handleMenuDragEnd = React.useCallback((fromIndex: number, toIndex: number) => {
    const newStructure = [...menuStructure];
    const [removed] = newStructure.splice(fromIndex, 1);
    newStructure.splice(toIndex, 0, removed);
    setMenuStructure(newStructure);
    saveMenuOrderMutation.mutate(newStructure);
  }, [menuStructure, saveMenuOrderMutation]);

  // Handle color change
  const handleColorChange = React.useCallback((categoryName: string, color: string) => {
    // Update local state
    const newStructure = menuStructure.map(item => 
      item.type === 'category' && item.name === categoryName 
        ? { ...item, color }
        : item
    );
    setMenuStructure(newStructure);
    
    // Save to server
    saveCategoryColorMutation.mutate({ name: categoryName, color });
  }, [menuStructure, saveCategoryColorMutation]);

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
          <Typography.Text strong>Menu Structure</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ marginTop: '4px' }}>
            Drag categories, regions, and appellations to reorder them. Categories contain regions, which contain appellations.
          </Typography.Paragraph>
        </div>
        
        <Card size="small">
          {menuStructure.map((item, index) => (
            <div
              key={`${item.type}-${item.name}-${item.parent || ''}`}
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
                handleMenuDragEnd(fromIndex, index);
              }}
              style={{
                padding: '8px 12px',
                margin: '4px 0',
                marginLeft: item.type === 'region' ? '20px' : item.type === 'appellation' ? '40px' : '0px',
                backgroundColor: item.type === 'category' ? '#f9f9f9' : item.type === 'region' ? '#f0f8ff' : '#f5f5f5',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                cursor: 'move',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <HolderOutlined style={{ color: '#999' }} />
              {item.type === 'category' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <strong>{item.name}</strong>
                  <div style={{ position: 'relative' }}>
                    <div
                      onClick={() => setColorPickerOpen(colorPickerOpen === item.name ? null : item.name)}
                      style={{
                        width: '20px',
                        height: '20px',
                        backgroundColor: item.color || '#000000',
                        border: '2px solid #fff',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
                      }}
                    />
                    {colorPickerOpen === item.name && (
                      <div style={{
                        position: 'absolute',
                        top: '25px',
                        left: '0',
                        zIndex: 1000,
                      }}>
                        <div
                          style={{
                            position: 'fixed',
                            top: '0',
                            left: '0',
                            right: '0',
                            bottom: '0',
                          }}
                          onClick={() => setColorPickerOpen(null)}
                        />
                        <SketchPicker
                          color={item.color || '#000000'}
                          onChange={(color) => handleColorChange(item.name, color.hex)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : item.type === 'region' ? (
                <span style={{ fontStyle: 'italic', color: '#666' }}>
                  {item.name} <small>(in {item.parent})</small>
                </span>
              ) : (
                <span style={{ fontStyle: 'italic', color: '#999', fontSize: '0.9em' }}>
                  {item.name} <small>(in {item.parent})</small>
                </span>
              )}
            </div>
          ))}
          {menuStructure.length === 0 && (
            <Typography.Text type="secondary">Loading menu structure...</Typography.Text>
          )}
        </Card>
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
