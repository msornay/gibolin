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
import { CreatableSelect } from "./CreatableSelect";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";

import { Reference, Purchase } from "../index";
import { API_BASE_URL, apiFetch } from "@/api";

type PurchaseFormValues = {
  date: { format: (fmt: string) => string };
  quantity: number;
  price: number;
};

const { Title } = Typography;

type ReferenceDetailsProps = {
  reference: Reference | null;
  onClose: () => void;
  formRef?: React.MutableRefObject<(() => void) | null>;
};

export function ReferenceDetails({ reference, onClose, formRef }: ReferenceDetailsProps) {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [showPurchaseForm, setShowPurchaseForm] = React.useState(false);
  const [editingPurchase, setEditingPurchase] = React.useState<Purchase | null>(null);
  const [purchaseForm] = Form.useForm();
  const [newLocationName, setNewLocationName] = React.useState("");
  const [isAddingLocation, setIsAddingLocation] = React.useState(false);
  const [addedLocations, setAddedLocations] = React.useState<string[]>([]);

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => 
      fetch(`${API_BASE_URL}/api/categories`).then(res => res.json()),
  });

  // Fetch regions
  const { data: regions } = useQuery({
    queryKey: ['regions'],
    queryFn: () => 
      fetch(`${API_BASE_URL}/api/regions`).then(res => res.json()),
  });

  // Fetch appellations
  const { data: appellations } = useQuery({
    queryKey: ['appellations'],
    queryFn: () =>
      fetch(`${API_BASE_URL}/api/appellations`).then(res => res.json()),
  });

  // Fetch formats
  const { data: formats } = useQuery({
    queryKey: ['formats'],
    queryFn: () =>
      fetch(`${API_BASE_URL}/api/formats`).then(res => res.json()),
  });

  // Fetch grapes
  const { data: grapes } = useQuery({
    queryKey: ['grapes'],
    queryFn: () =>
      fetch(`${API_BASE_URL}/api/grapes`).then(res => res.json()),
  });

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () =>
      fetch(`${API_BASE_URL}/api/locations`).then(res => res.json()),
  });



  // Fetch reference data for editing
  const { data: referenceData } = useQuery({
    queryKey: ["reference", reference?.sqid],
    queryFn: () =>
      fetch(`${API_BASE_URL}/api/ref/${reference?.sqid}`).then((res) =>
        res.json(),
      ),
    enabled: reference !== null,
  });

  // Update reference mutation
  const updateMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      apiFetch(`${API_BASE_URL}/api/ref/${reference?.sqid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["references"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["regions"] });
      queryClient.invalidateQueries({ queryKey: ["appellations"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["formats"] });
      queryClient.invalidateQueries({ queryKey: ["grapes"] });
      queryClient.invalidateQueries({ queryKey: ["reference", reference?.sqid] });
      messageApi.success("Reference updated successfully");
      onClose();
    },
    onError: () => {
      messageApi.error("Failed to update reference");
    },
  });

  // Create reference mutation
  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      apiFetch(`${API_BASE_URL}/api/ref`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["references"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["regions"] });
      queryClient.invalidateQueries({ queryKey: ["appellations"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["formats"] });
      queryClient.invalidateQueries({ queryKey: ["grapes"] });
      messageApi.success("Reference created successfully");
      onClose();
    },
    onError: () => {
      messageApi.error("Failed to create reference");
    },
  });


  // Purchase mutations
  const createPurchaseMutation = useMutation({
    mutationFn: (values: PurchaseFormValues) =>
      apiFetch(`${API_BASE_URL}/api/ref/${reference?.sqid}/purchases`, {
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
    mutationFn: ({ id, values }: { id: number; values: PurchaseFormValues }) =>
      apiFetch(`${API_BASE_URL}/api/purchase/${id}`, {
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
      apiFetch(`${API_BASE_URL}/api/purchase/${id}`, {
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
  const handleSubmit = React.useCallback((values: Record<string, unknown>) => {
    if (reference) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  }, [reference, updateMutation, createMutation]);

  // Expose submit callback via formRef for save-on-modal-close
  React.useEffect(() => {
    if (formRef) {
      formRef.current = () => {
        form.validateFields()
          .then((values) => handleSubmit(values))
          .catch(() => onClose());
      };
    }
    return () => { if (formRef) formRef.current = null; };
  }, [form, formRef, handleSubmit, onClose]);

  // Handle purchase form submission
  const handlePurchaseSubmit = (values: PurchaseFormValues) => {
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

  // Handle new location creation (client-side only, no API call needed)
  const handleAddLocation = () => {
    if (newLocationName.trim()) {
      const trimmedName = newLocationName.trim();
      const allLocations = [...(locations || []), ...addedLocations];
      if (allLocations.includes(trimmedName)) {
        messageApi.warning("Location already exists");
        return;
      }
      setAddedLocations((prev) => [...prev, trimmedName]);
      form.setFieldsValue({ location: trimmedName });
      setNewLocationName("");
      setIsAddingLocation(false);
    }
  };

  const handleCancelAddLocation = () => {
    setNewLocationName("");
    setIsAddingLocation(false);
  };

  // Set initial form values
  React.useEffect(() => {
    if (reference && referenceData) {
      form.setFieldsValue({
        name: referenceData.name,
        category: referenceData.category,
        region: referenceData.region,
        appellation: referenceData.appellation,
        format: referenceData.format || undefined,
        grapes: referenceData.grapes || [],
        domain: referenceData.domain,
        location: referenceData.location || undefined,
        vintage: referenceData.vintage,
        current_quantity: referenceData.current_quantity,
        hidden_from_menu: referenceData.hidden_from_menu,
        notes: referenceData.notes || undefined,
        price_multiplier: referenceData.price_multiplier,
        retail_price_override: referenceData.retail_price_override,
      });
    } else {
      form.setFieldsValue({
        name: "",
        category: undefined,
        region: undefined,
        appellation: undefined,
        format: undefined,
        grapes: [],
        domain: "",
        location: undefined,
        vintage: new Date().getFullYear(),
        current_quantity: 0,
        hidden_from_menu: false,
        notes: undefined,
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
          format: undefined,
          grapes: [],
          domain: "",
          location: undefined,
          vintage: new Date().getFullYear(),
          current_quantity: 0,
          hidden_from_menu: false,
          notes: undefined,
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
          <CreatableSelect
            options={categories || []}
            createEndpoint="/api/categories"
            queryKey="categories"
            placeholder="Select category"
          />
        </Form.Item>

        <Form.Item
          label="Region"
          name="region"
        >
          <CreatableSelect
            options={regions || []}
            createEndpoint="/api/regions"
            queryKey="regions"
            placeholder="Select region"
          />
        </Form.Item>

        <Form.Item
          label="Appellation"
          name="appellation"
        >
          <CreatableSelect
            options={appellations || []}
            createEndpoint="/api/appellations"
            queryKey="appellations"
            placeholder="Select appellation"
          />
        </Form.Item>

        <Form.Item
          label="Format"
          name="format"
        >
          <CreatableSelect
            options={formats || []}
            createEndpoint="/api/formats"
            queryKey="formats"
            placeholder="Select format"
          />
        </Form.Item>

        <Form.Item
          label="Grapes"
          name="grapes"
        >
          <CreatableSelect
            options={grapes || []}
            createEndpoint="/api/grapes"
            queryKey="grapes"
            placeholder="Select grapes"
            mode="multiple"
          />
        </Form.Item>

        <Form.Item
          label="Domain"
          name="domain"
        >
          <Input placeholder="Domain" />
        </Form.Item>

        <Form.Item
          label="Location"
          name="location"
        >
          <Select
            placeholder="Select location"
            allowClear
            showSearch
            options={[...(locations || []), ...addedLocations].map((loc: string) => ({ value: loc, label: loc }))}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            popupRender={(menu) => (
              <div>
                {menu}
                <div style={{ borderTop: '1px solid #f0f0f0', padding: '8px' }}>
                  {!isAddingLocation ? (
                    <Button
                      type="text"
                      icon={<PlusOutlined />}
                      onClick={() => setIsAddingLocation(true)}
                      style={{ width: '100%', textAlign: 'left' }}
                    >
                      Add new location
                    </Button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Input
                        placeholder="Location name"
                        value={newLocationName}
                        onChange={(e) => setNewLocationName(e.target.value)}
                        onPressEnter={handleAddLocation}
                        style={{ flex: 1 }}
                        autoFocus
                      />
                      <Button
                        type="primary"
                        size="small"
                        onClick={handleAddLocation}
                      >
                        Add
                      </Button>
                      <Button size="small" onClick={handleCancelAddLocation}>
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
          label="Notes"
          name="notes"
        >
          <Input.TextArea
            placeholder="Free-form notes"
            rows={3}
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