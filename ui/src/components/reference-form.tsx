import React from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Space,
  Table,
  DatePicker,
  Typography,
  message,
  Divider,
  Popconfirm,
  Checkbox,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";

import { Reference, Purchase } from "../index";

const { Title } = Typography;

type ReferenceDetailsProps = {
  reference: Reference | null;
  onClose: () => void;
};

export function ReferenceDetails({ reference, onClose }: ReferenceDetailsProps) {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [showPurchaseForm, setShowPurchaseForm] = React.useState(false);
  const [editingPurchase, setEditingPurchase] = React.useState<Purchase | null>(null);
  const [purchaseForm] = Form.useForm();
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [isAddingCategory, setIsAddingCategory] = React.useState(false);
  const [newRegionName, setNewRegionName] = React.useState("");
  const [isAddingRegion, setIsAddingRegion] = React.useState(false);
  const [newAppellationName, setNewAppellationName] = React.useState("");
  const [isAddingAppellation, setIsAddingAppellation] = React.useState(false);

  // Fetch categories
  const { data: categories, refetch: refetchCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => 
      fetch('http://localhost:8000/api/categories').then(res => res.json()),
  });

  // Fetch regions
  const { data: regions, refetch: refetchRegions } = useQuery({
    queryKey: ['regions'],
    queryFn: () => 
      fetch('http://localhost:8000/api/regions').then(res => res.json()),
  });

  // Fetch appellations
  const { data: appellations, refetch: refetchAppellations } = useQuery({
    queryKey: ['appellations'],
    queryFn: () => 
      fetch('http://localhost:8000/api/appellations').then(res => res.json()),
  });



  // Fetch reference data for editing
  const { data: referenceData } = useQuery({
    queryKey: ["reference", reference?.sqid],
    queryFn: () =>
      fetch(`http://localhost:8000/api/ref/${reference?.sqid}`).then((res) =>
        res.json(),
      ),
    enabled: reference !== null,
  });

  // Update reference mutation
  const updateMutation = useMutation({
    mutationFn: (values: any) =>
      fetch(`http://localhost:8000/api/ref/${reference?.sqid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["references"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["regions"] });
      queryClient.invalidateQueries({ queryKey: ["appellations"] });
      queryClient.invalidateQueries({ queryKey: ["reference", reference?.sqid] });
      refetchCategories(); // Force refetch categories
      refetchRegions(); // Force refetch regions
      refetchAppellations(); // Force refetch appellations
      messageApi.success("Reference updated successfully");
      onClose();
    },
    onError: () => {
      messageApi.error("Failed to update reference");
    },
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: (categoryName: string) =>
      fetch(`http://localhost:8000/api/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      messageApi.success("Category created successfully");
    },
    onError: () => {
      messageApi.error("Failed to create category");
    },
  });

  // Create region mutation
  const createRegionMutation = useMutation({
    mutationFn: (regionName: string) =>
      fetch(`http://localhost:8000/api/regions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regionName }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regions"] });
      messageApi.success("Region created successfully");
    },
    onError: () => {
      messageApi.error("Failed to create region");
    },
  });

  // Create appellation mutation
  const createAppellationMutation = useMutation({
    mutationFn: (appellationName: string) =>
      fetch(`http://localhost:8000/api/appellations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: appellationName }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appellations"] });
      messageApi.success("Appellation created successfully");
    },
    onError: () => {
      messageApi.error("Failed to create appellation");
    },
  });

  // Create reference mutation
  const createMutation = useMutation({
    mutationFn: (values: any) =>
      fetch(`http://localhost:8000/api/ref`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["references"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["regions"] });
      queryClient.invalidateQueries({ queryKey: ["appellations"] });
      refetchCategories();
      refetchRegions();
      refetchAppellations();
      messageApi.success("Reference created successfully");
      onClose();
    },
    onError: () => {
      messageApi.error("Failed to create reference");
    },
  });


  // Purchase mutations
  const createPurchaseMutation = useMutation({
    mutationFn: (values: any) =>
      fetch(`http://localhost:8000/api/ref/${reference?.sqid}/purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          date: values.date.format('YYYY-MM-DD'),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["references"] });
      queryClient.invalidateQueries({ queryKey: ["reference", reference?.sqid] });
      messageApi.success("Purchase added successfully");
      setShowPurchaseForm(false);
      purchaseForm.resetFields();
    },
    onError: () => {
      messageApi.error("Failed to add purchase");
    },
  });

  const updatePurchaseMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: any }) =>
      fetch(`http://localhost:8000/api/purchase/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          date: values.date.format('YYYY-MM-DD'),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["references"] });
      queryClient.invalidateQueries({ queryKey: ["reference", reference?.sqid] });
      messageApi.success("Purchase updated successfully");
      setShowPurchaseForm(false);
      setEditingPurchase(null);
      purchaseForm.resetFields();
    },
    onError: () => {
      messageApi.error("Failed to update purchase");
    },
  });

  const deletePurchaseMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`http://localhost:8000/api/purchase/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["references"] });
      queryClient.invalidateQueries({ queryKey: ["reference", reference?.sqid] });
      messageApi.success("Purchase deleted successfully");
    },
    onError: () => {
      messageApi.error("Failed to delete purchase");
    },
  });

  // Handle form submission
  const handleSubmit = (values: any) => {
    if (reference) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  // Handle purchase form submission
  const handlePurchaseSubmit = (values: any) => {
    if (editingPurchase) {
      updatePurchaseMutation.mutate({ id: editingPurchase.id, values });
    } else {
      createPurchaseMutation.mutate(values);
    }
  };

  // Handle purchase edit
  const handleEditPurchase = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setShowPurchaseForm(true);
    purchaseForm.setFieldsValue({
      date: dayjs(purchase.date),
      quantity: purchase.quantity,
      price: purchase.price,
    });
  };

  // Handle purchase delete
  const handleDeletePurchase = (id: number) => {
    deletePurchaseMutation.mutate(id);
  };

  // Cancel purchase form
  const handleCancelPurchase = () => {
    setShowPurchaseForm(false);
    setEditingPurchase(null);
    purchaseForm.resetFields();
  };

  // Handle new category creation
  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      const trimmedName = newCategoryName.trim();
      
      // Check if category already exists
      if (categories?.includes(trimmedName)) {
        messageApi.warning("Category already exists");
        return;
      }
      
      // Create category server-side
      createCategoryMutation.mutate(trimmedName, {
        onSuccess: () => {
          form.setFieldsValue({ category: trimmedName });
          setNewCategoryName("");
          setIsAddingCategory(false);
        }
      });
    }
  };

  const handleCancelAddCategory = () => {
    setNewCategoryName("");
    setIsAddingCategory(false);
  };

  // Handle new region creation
  const handleAddRegion = () => {
    if (newRegionName.trim()) {
      const trimmedName = newRegionName.trim();
      
      // Check if region already exists
      if (regions?.includes(trimmedName)) {
        messageApi.warning("Region already exists");
        return;
      }
      
      // Create region server-side
      createRegionMutation.mutate(trimmedName, {
        onSuccess: () => {
          form.setFieldsValue({ region: trimmedName });
          setNewRegionName("");
          setIsAddingRegion(false);
        }
      });
    }
  };

  const handleCancelAddRegion = () => {
    setNewRegionName("");
    setIsAddingRegion(false);
  };

  // Handle new appellation creation
  const handleAddAppellation = () => {
    if (newAppellationName.trim()) {
      const trimmedName = newAppellationName.trim();
      
      // Check if appellation already exists
      if (appellations?.includes(trimmedName)) {
        messageApi.warning("Appellation already exists");
        return;
      }
      
      // Create appellation server-side
      createAppellationMutation.mutate(trimmedName, {
        onSuccess: () => {
          form.setFieldsValue({ appellation: trimmedName });
          setNewAppellationName("");
          setIsAddingAppellation(false);
        }
      });
    }
  };

  const handleCancelAddAppellation = () => {
    setNewAppellationName("");
    setIsAddingAppellation(false);
  };


  // Set initial form values
  React.useEffect(() => {
    if (reference && referenceData) {
      form.setFieldsValue({
        name: referenceData.name,
        category: referenceData.category,
        region: referenceData.region,
        appellation: referenceData.appellation,
        domain: referenceData.domain,
        vintage: referenceData.vintage,
        current_quantity: referenceData.current_quantity,
        hidden_from_menu: referenceData.hidden_from_menu,
        price_multiplier: referenceData.price_multiplier,
        retail_price_override: referenceData.retail_price_override,
      });
    } else {
      form.setFieldsValue({
        name: "",
        category: undefined,
        region: undefined,
        appellation: undefined,
        domain: "",
        vintage: new Date().getFullYear(),
        current_quantity: 0,
        hidden_from_menu: false,
        price_multiplier: 3,
        retail_price_override: undefined,
      });
    }
  }, [reference, referenceData, form]);

  // Purchase table columns
  const purchaseColumns: ColumnsType<Purchase> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      sorter: (a, b) => a.date.localeCompare(b.date),
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: "Price",
      dataIndex: "price",
      key: "price",
      sorter: (a, b) => a.price - b.price,
      render: (price) => `€${price.toFixed(2)}`,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditPurchase(record)}
          />
          <Popconfirm
            title="Delete purchase"
            description="Are you sure you want to delete this purchase?"
            onConfirm={() => handleDeletePurchase(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="text"
              icon={<DeleteOutlined />}
              danger
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const purchases = referenceData?.purchases || [];

  return (
    <>
      {contextHolder}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          name: "",
          category: undefined,
          region: undefined,
          appellation: undefined,
          domain: "",
          vintage: new Date().getFullYear(),
          current_quantity: 0,
          hidden_from_menu: false,
          price_multiplier: 3,
          retail_price_override: undefined,
        }}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, message: "Please input the name!" }]}
        >
          <Input placeholder="Wine name" />
        </Form.Item>

        <Form.Item
          label="Category"
          name="category"
        >
          <Select
            placeholder="Select category"
            allowClear
            showSearch
            options={categories?.map((cat: string) => ({ value: cat, label: cat }))}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            popupRender={(menu) => (
              <div>
                {menu}
                <div style={{ borderTop: '1px solid #f0f0f0', padding: '8px' }}>
                  {!isAddingCategory ? (
                    <Button
                      type="text"
                      icon={<PlusOutlined />}
                      onClick={() => setIsAddingCategory(true)}
                      style={{ width: '100%', textAlign: 'left' }}
                    >
                      Add new category
                    </Button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Input
                        placeholder="Category name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onPressEnter={handleAddCategory}
                        style={{ flex: 1 }}
                        autoFocus
                      />
                      <Button 
                        type="primary" 
                        size="small" 
                        onClick={handleAddCategory}
                        loading={createCategoryMutation.isPending}
                      >
                        Add
                      </Button>
                      <Button size="small" onClick={handleCancelAddCategory}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          />
        </Form.Item>

        <Form.Item
          label="Region"
          name="region"
        >
          <Select
            placeholder="Select region"
            allowClear
            showSearch
            options={regions?.map((region: string) => ({ value: region, label: region }))}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            popupRender={(menu) => (
              <div>
                {menu}
                <div style={{ borderTop: '1px solid #f0f0f0', padding: '8px' }}>
                  {!isAddingRegion ? (
                    <Button
                      type="text"
                      icon={<PlusOutlined />}
                      onClick={() => setIsAddingRegion(true)}
                      style={{ width: '100%', textAlign: 'left' }}
                    >
                      Add new region
                    </Button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Input
                        placeholder="Region name"
                        value={newRegionName}
                        onChange={(e) => setNewRegionName(e.target.value)}
                        onPressEnter={handleAddRegion}
                        style={{ flex: 1 }}
                        autoFocus
                      />
                      <Button 
                        type="primary" 
                        size="small" 
                        onClick={handleAddRegion}
                        loading={createRegionMutation.isPending}
                      >
                        Add
                      </Button>
                      <Button size="small" onClick={handleCancelAddRegion}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          />
        </Form.Item>

        <Form.Item
          label="Appellation"
          name="appellation"
        >
          <Select
            placeholder="Select appellation"
            allowClear
            showSearch
            options={appellations?.map((appellation: string) => ({ value: appellation, label: appellation }))}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            popupRender={(menu) => (
              <div>
                {menu}
                <div style={{ borderTop: '1px solid #f0f0f0', padding: '8px' }}>
                  {!isAddingAppellation ? (
                    <Button
                      type="text"
                      icon={<PlusOutlined />}
                      onClick={() => setIsAddingAppellation(true)}
                      style={{ width: '100%', textAlign: 'left' }}
                    >
                      Add new appellation
                    </Button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Input
                        placeholder="Appellation name"
                        value={newAppellationName}
                        onChange={(e) => setNewAppellationName(e.target.value)}
                        onPressEnter={handleAddAppellation}
                        style={{ flex: 1 }}
                        autoFocus
                      />
                      <Button 
                        type="primary" 
                        size="small" 
                        onClick={handleAddAppellation}
                        loading={createAppellationMutation.isPending}
                      >
                        Add
                      </Button>
                      <Button size="small" onClick={handleCancelAddAppellation}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          />
        </Form.Item>

        <Form.Item
          label="Domain"
          name="domain"
        >
          <Input placeholder="Domain" />
        </Form.Item>

        <Form.Item
          label="Vintage"
          name="vintage"
        >
          <InputNumber
            placeholder="Vintage year"
            min={1800}
            max={new Date().getFullYear() + 10}
            style={{ width: "100%" }}
          />
        </Form.Item>

        <Form.Item
          label="Current Quantity"
          name="current_quantity"
        >
          <InputNumber
            min={0}
            style={{ width: "100%" }}
          />
        </Form.Item>

        <Form.Item
          name="hidden_from_menu"
          valuePropName="checked"
        >
          <Checkbox><EyeInvisibleOutlined style={{ marginRight: 8 }} />Hide from exported menu</Checkbox>
        </Form.Item>

        <Form.Item
          label="Price Multiplier"
          name="price_multiplier"
        >
          <InputNumber
            min={1}
            max={10}
            step={0.1}
            style={{ width: "100%" }}
          />
        </Form.Item>

        <Form.Item
          label="Retail Price Override"
          name="retail_price_override"
        >
          <InputNumber
            min={0}
            step={1}
            prefix="€"
            placeholder="Leave empty to use calculated price"
            style={{ width: "100%" }}
          />
        </Form.Item>

        {reference && referenceData?.retail_price && (
          <Form.Item label="Computed Retail Price">
            <InputNumber
              value={referenceData.retail_price}
              disabled
              prefix="€"
              style={{ width: "100%" }}
            />
          </Form.Item>
        )}

        <Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {reference ? "Update" : "Create"} Reference
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>

      {reference && (
        <>
          <Divider />
          <Space direction="vertical" style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Title level={4}>Purchase History</Title>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setShowPurchaseForm(true)}
                disabled={showPurchaseForm}
              >
                Add Purchase
              </Button>
            </div>

            {showPurchaseForm && (
              <Form
                form={purchaseForm}
                layout="inline"
                onFinish={handlePurchaseSubmit}
                style={{ marginBottom: "16px" }}
              >
                <Form.Item
                  name="date"
                  rules={[{ required: true, message: "Please select date!" }]}
                >
                  <DatePicker placeholder="Date" />
                </Form.Item>
                <Form.Item
                  name="quantity"
                  rules={[{ required: true, message: "Please input quantity!" }]}
                >
                  <InputNumber placeholder="Quantity" min={1} />
                </Form.Item>
                <Form.Item
                  name="price"
                  rules={[{ required: true, message: "Please input price!" }]}
                >
                  <InputNumber placeholder="Price" min={0} step={0.01} />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={createPurchaseMutation.isPending || updatePurchaseMutation.isPending}
                  >
                    {editingPurchase ? "Update" : "Add"}
                  </Button>
                </Form.Item>
                <Form.Item>
                  <Button onClick={handleCancelPurchase}>Cancel</Button>
                </Form.Item>
              </Form>
            )}


            <Table
              columns={purchaseColumns}
              dataSource={purchases}
              rowKey="id"
              size="small"
              pagination={false}
              locale={{ emptyText: "No purchases recorded yet." }}
            />
          </Space>
        </>
      )}
    </>
  );
}