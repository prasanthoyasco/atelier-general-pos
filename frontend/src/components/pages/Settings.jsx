import { useState, useEffect } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Divider,
  Tabs,
  Space,
  Row,
  Col,
  message,
  Spin,
  Alert,
  Table,
  Tag,
  Modal,
  Select,
  Switch,
  Badge,
  Popconfirm,
  Tooltip,
} from "antd";
import {
  SaveOutlined,
  UserOutlined,
  SecurityScanOutlined,
  LockOutlined,
  PrinterOutlined,
  ReloadOutlined,
  DownloadOutlined,
  ShopOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WifiOutlined,
  KeyOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import userService from "../../user/service/userService";
import productService from "../../product/services/productService";
import localPrintService from "../../billing/service/localPrintService";
import { defaultReceiptSettings, getReceiptSettings, saveReceiptSettings } from "../../billing/service/receiptSettings";
import {
  getConfiguredPrinters,
  saveConfiguredPrinters,
  getPairingToken,
  savePairingToken,
  DEFAULT_BILLING_PRINTER,
} from "../../billing/service/printerSettings";

const { TabPane } = Tabs;

const Settings = () => {
  const [profileForm] = Form.useForm();
  const [securityForm] = Form.useForm();
  const [receiptForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [savingStore, setSavingStore] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [userData, setUserData] = useState(null);
  const [printerName, setPrinterName] = useState(() => localStorage.getItem("thermalPrinterName") || "");
  const [localPrinters, setLocalPrinters] = useState([]);
  const [printServiceStatus, setPrintServiceStatus] = useState(null);
  const [printServiceLoading, setPrintServiceLoading] = useState(false);

  // Universal Printer Management State
  const [configuredPrinters, setConfiguredPrinters] = useState(() => getConfiguredPrinters());
  const [kitchenStations, setKitchenStations] = useState([]);
  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const [editingPrinterId, setEditingPrinterId] = useState(null);
  const [printerForm] = Form.useForm();
  const [selectedConnectionType, setSelectedConnectionType] = useState("os_spooler");
  const [pairingTokenModalVisible, setPairingTokenModalVisible] = useState(false);
  const [currentPairingToken, setCurrentPairingToken] = useState(() => getPairingToken());
  const [testingPrinterId, setTestingPrinterId] = useState(null);

  // Fetch user data on component mount
  useEffect(() => {
    fetchUserData();
    receiptForm.setFieldsValue(getReceiptSettings());
    loadKitchenStations();
    checkPrintService();
  }, []);

  const loadKitchenStations = async () => {
    try {
      const res = await productService.getKitchens();
      setKitchenStations(res?.data?.data || []);
    } catch (err) {
      console.warn("Could not load kitchen stations for printer mapping:", err.message);
    }
  };

  const fetchUserData = async () => {
    try {
      setFetchingData(true);
      
      // Check if token exists
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      console.log('Token exists:', !!token);
      console.log('Token value:', token ? token.substring(0, 20) + '...' : 'null');
      
      console.log('Fetching user profile data...');
      const response = await userService.getMe();
      console.log('Profile response:', response);
      
      // Handle different response structures
      const data = response.data?.data || response.data;
      console.log('User data:', data);
      
      setUserData(data);
      
      // Set profile form values
      const formValues = {
        username: data.username,
        email: data.email,
        phone: data.phone,
        role: data.role?.role_name || 'N/A',
      };
      
      console.log('Setting profile form values:', formValues);
      profileForm.setFieldsValue(formValues);
      console.log('Profile form values after set:', profileForm.getFieldsValue());
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      console.error('Error response:', error.response?.data);
      message.error('Failed to load user profile');
    } finally {
      setFetchingData(false);
    }
  };

  const handleProfileSubmit = async (values) => {
    setLoading(true);
    try {
      const payload = {
        username: values.username,
        email: values.email,
        phone: values.phone,
      };

      await userService.updateUser(userData.id, payload);
      
      message.success('Profile updated successfully');
      fetchUserData(); // Refresh user data
    } catch (error) {
      console.error('Failed to update profile:', error);
      message.error(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSecuritySubmit = async (values) => {
    setLoading(true);
    try {
      await userService.changePassword({
        oldPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      
      message.success('Password changed successfully');
      securityForm.resetFields();
    } catch (error) {
      console.error('Failed to change password:', error);
      message.error(error.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const checkPrintService = async () => {
    setPrintServiceLoading(true);
    try {
      const status = await localPrintService.checkLocalPrintService();
      setPrintServiceStatus(status);
      // Auto-pair token if missing
      if (!getPairingToken()) {
        const paired = await localPrintService.autoPairService();
        if (paired) {
          setCurrentPairingToken(paired);
        }
      }
    } catch (error) {
      console.warn(error);
      setPrintServiceStatus(null);
    } finally {
      setPrintServiceLoading(false);
    }
  };

  const fetchLocalPrinters = async () => {
    setPrintServiceLoading(true);
    try {
      const printers = await localPrintService.findLocalPrinters();
      setLocalPrinters(printers);
      message.success(`Found ${printers.length} installed system printers`);
    } catch (error) {
      console.error(error);
      message.error(error.message || "Failed to load local printers. Check local print service.");
    } finally {
      setPrintServiceLoading(false);
    }
  };

  const handleOpenAddPrinterModal = (printer = null) => {
    if (printer) {
      setEditingPrinterId(printer.id);
      setSelectedConnectionType(printer.connection_type || "os_spooler");
      printerForm.setFieldsValue({
        ...printer,
        port: printer.port || 9100,
        paper_width: printer.paper_width || "80mm",
        has_cutter: printer.has_cutter !== false,
        has_cash_drawer: Boolean(printer.has_cash_drawer),
        is_default: Boolean(printer.is_default),
      });
    } else {
      setEditingPrinterId(null);
      setSelectedConnectionType("os_spooler");
      printerForm.resetFields();
      printerForm.setFieldsValue({
        name: "New Printer",
        role: "billing",
        connection_type: "os_spooler",
        target: localPrinters[0]?.name || "80mm Series Printer",
        port: 9100,
        paper_width: "80mm",
        columns: 48,
        has_cutter: true,
        has_cash_drawer: false,
        is_default: configuredPrinters.length === 0,
      });
    }
    setPrinterModalVisible(true);
  };

  const handleSavePrinter = (values) => {
    const nextPrinters = [...configuredPrinters];
    const newEntry = {
      id: editingPrinterId || `printer_${Date.now()}`,
      name: values.name.trim(),
      role: values.role,
      kitchen_id: values.kitchen_id || null,
      connection_type: values.connection_type,
      target: values.target.trim(),
      port: values.port ? parseInt(values.port, 10) : 9100,
      paper_width: values.paper_width || "80mm",
      columns: values.columns ? parseInt(values.columns, 10) : (values.paper_width === "58mm" ? 32 : 48),
      has_cutter: values.has_cutter !== false,
      has_cash_drawer: Boolean(values.has_cash_drawer),
      is_default: Boolean(values.is_default),
    };

    // If marked default, unmark others with same role
    if (newEntry.is_default) {
      nextPrinters.forEach((p) => {
        if (p.role === newEntry.role) p.is_default = false;
      });
    }

    if (editingPrinterId) {
      const idx = nextPrinters.findIndex((p) => p.id === editingPrinterId);
      if (idx !== -1) nextPrinters[idx] = newEntry;
    } else {
      nextPrinters.push(newEntry);
    }

    const saved = saveConfiguredPrinters(nextPrinters);
    setConfiguredPrinters(saved);
    setPrinterModalVisible(false);
    message.success(`Printer "${newEntry.name}" saved!`);
  };

  const handleDeletePrinter = (printerId) => {
    const nextPrinters = configuredPrinters.filter((p) => p.id !== printerId);
    const saved = saveConfiguredPrinters(nextPrinters);
    setConfiguredPrinters(saved);
    message.success("Printer configuration removed");
  };

  const handleTestPrinter = async (printer, printSample = true) => {
    setTestingPrinterId(printer.id);
    try {
      const res = await localPrintService.testPrinterLocally(printer, printSample);
      if (res.ok) {
        message.success(printSample ? `Test print dispatched to "${printer.name}"!` : `Connected to "${printer.name}" successfully!`);
      } else {
        message.error(res.error || "Printer test failed");
      }
    } catch (err) {
      console.error(err);
      message.error(err.message || "Printer test failed. Check if local print service is running.");
    } finally {
      setTestingPrinterId(null);
    }
  };

  const handleSavePairingToken = (token) => {
    savePairingToken(token);
    setCurrentPairingToken(token);
    setPairingTokenModalVisible(false);
    message.success("Pairing token updated!");
    checkPrintService();
  };

  const handleReceiptSettingsSubmit = (values) => {
    setSavingStore(true);
    try {
      const saved = saveReceiptSettings(values);
      receiptForm.setFieldsValue(saved);
      message.success(`Store settings saved! Store name is now "${saved.storeName}".`);
    } catch (error) {
      console.error("Failed to save store settings:", error);
      message.error("Failed to save store settings");
    } finally {
      setSavingStore(false);
    }
  };

  const resetReceiptSettings = () => {
    const resetValues = saveReceiptSettings(defaultReceiptSettings);
    receiptForm.setFieldsValue(resetValues);
    message.success("Store settings reset to defaults (Pozhudhu)");
  };

  const downloadInstallerCommand = () => {
    const defaultTarget = configuredPrinters.find((p) => p.is_default)?.target || "80mm Series Printer";
    const script = `# Local Print Service installer\n# Run this from the extracted local-print-service folder.\n\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\install-startup-shortcut.ps1 -PrinterName "${defaultTarget}"\n\n# For Scheduled Task mode, run PowerShell as Administrator:\n# powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\install-windows-task.ps1 -PrinterName "${defaultTarget}"\n`;
    const blob = new Blob([script], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "duch-local-print-install.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="settings-page">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      <Card variant={"borderless"}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            if (key === "store" || key === "printer") {
              receiptForm.setFieldsValue(getReceiptSettings());
            }
          }}
        >
          <TabPane
            tab={
              <span>
                <UserOutlined /> Profile
              </span>
            }
            key="profile"
          >
            <Spin spinning={fetchingData}>
              {/* <div className="mb-6 flex justify-center">
                <Space direction="vertical" align="center">
                  <Avatar size={100} icon={<UserOutlined />} src={avatarUrl} />
                  <Upload
                    showUploadList={false}
                    beforeUpload={() => false}
                    onChange={handleAvatarChange}
                  >
                    <Button icon={<UploadOutlined />}>Change Avatar</Button>
                  </Upload>
                </Space>
              </div> */}

              <Form
                form={profileForm}
                layout="vertical"
                onFinish={handleProfileSubmit}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="username"
                      label="Username"
                      rules={[
                        { required: true, message: 'Please enter your username' },
                        { min: 3, message: 'Username must be at least 3 characters' }
                      ]}
                    >
                      <Input placeholder="Username" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="email"
                      label="Email"
                      rules={[
                        { required: true, message: 'Please enter your email' },
                        { type: 'email', message: 'Please enter a valid email' }
                      ]}
                    >
                      <Input placeholder="Email" />
                    </Form.Item>
                  </Col>
                </Row>
                
                <Row gutter={16}>
                  <Col span={12}>
                  <Form.Item
                    name="phone"
                    label="Phone Number"
                    rules={[
                      { required: true, message: 'Please enter your phone number' },
                      { pattern: /^\d{10}$/, message: 'Phone must be 10 digits' }
                    ]}
                  >
                    <Input placeholder="Phone Number" maxLength={10} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="role"
                    label="Role"
                  >
                    <Input disabled placeholder="Role" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item className="mb-0">
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={loading}
                >
                  Update Profile
                </Button>
              </Form.Item>
            </Form>
            </Spin>
          </TabPane>

          <TabPane
            tab={
              <span>
                <SecurityScanOutlined /> Security
              </span>
            }
            key="security"
          >
            <Form
              form={securityForm}
              layout="vertical"
              onFinish={handleSecuritySubmit}
            >
              <Form.Item
                name="currentPassword"
                label="Current Password"
                rules={[
                  {
                    required: true,
                    message: "Please enter your current password",
                  },
                ]}
              >
                <Input.Password placeholder="Enter current password" />
              </Form.Item>

              <Form.Item
                name="newPassword"
                label="New Password"
                rules={[
                  { required: true, message: "Please enter your new password" },
                  { min: 6, message: "Password must be at least 6 characters" }
                ]}
              >
                <Input.Password placeholder="Enter new password" />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="Confirm New Password"
                dependencies={["newPassword"]}
                rules={[
                  {
                    required: true,
                    message: "Please confirm your new password",
                  },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("newPassword") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(
                        new Error("The two passwords do not match")
                      );
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="Confirm new password" />
              </Form.Item>

              <Divider />

              <Form.Item className="mb-0">
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<LockOutlined />}
                  loading={loading}
                >
                  Change Password
                </Button>
              </Form.Item>
            </Form>
          </TabPane>
          <TabPane
            tab={
              <span>
                <ShopOutlined /> Store Settings
              </span>
            }
            key="store"
          >
            <div style={{ maxWidth: 840 }}>
              <div className="mb-6 pb-3 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-800 m-0">Store & Receipt Configuration</h2>
                <p className="text-sm text-gray-500 m-0 mt-1">
                  Configure your store name and receipt header details. These apply to all printed receipts, billing copies, and barcode labels.
                </p>
              </div>

              <Form
                form={receiptForm}
                layout="vertical"
                initialValues={getReceiptSettings()}
                onFinish={handleReceiptSettingsSubmit}
              >
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Store Name"
                      name="storeName"
                      rules={[
                        { required: true, message: "Please enter your store name" },
                        { min: 2, message: "Store name must be at least 2 characters" }
                      ]}
                      tooltip="This name appears as the prominent header on bills, receipts, and labels"
                    >
                      <Input placeholder="Pozhudhu" size="large" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Bill Title"
                      name="billTitle"
                      tooltip="Header title under store name (e.g., CUSTOMER COPY or TAX INVOICE)"
                    >
                      <Input placeholder="CUSTOMER COPY" size="large" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item label="Instagram ID" name="instagram">
                      <Input placeholder="@pozhudhu_cafe" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="GST Number (GSTIN)" name="gstin">
                      <Input placeholder="33AYDPV172S01ZO" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item label="Cell Number 1" name="cell1">
                      <Input placeholder="9629103751" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Cell Number 2" name="cell2">
                      <Input placeholder="9042551109" />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider style={{ margin: "16px 0" }} />

                <Form.Item label="Receipt Footer Title" name="footerTitle">
                  <Input placeholder="Terms & Conditions:" />
                </Form.Item>

                <Form.Item
                  label="Receipt Footer Terms"
                  name="footerTerms"
                  tooltip="Enter each term or condition on a new line"
                >
                  <Input.TextArea rows={5} placeholder="One term per line" />
                </Form.Item>

                <Space wrap size="middle">
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={savingStore}
                    size="large"
                  >
                    Save Store Settings
                  </Button>
                  <Button
                    onClick={resetReceiptSettings}
                    icon={<ReloadOutlined />}
                    size="large"
                  >
                    Reset to Pozhudhu Defaults
                  </Button>
                </Space>
              </Form>
            </div>
          </TabPane>

          <TabPane
            tab={
              <span>
                <PrinterOutlined /> Universal Thermal Printers
              </span>
            }
            key="printer"
          >
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              {/* Service Health & Pairing Alert */}
              <Alert
                type={printServiceStatus ? "success" : "warning"}
                showIcon
                icon={printServiceStatus ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                message={
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {printServiceStatus
                        ? `Local Print Service v${printServiceStatus.version || "2.0"} is Online`
                        : "Local Print Service is Offline"}
                    </span>
                    {currentPairingToken && (
                      <Tag color="cyan" icon={<KeyOutlined />}>
                        Authenticated
                      </Tag>
                    )}
                  </div>
                }
                description={
                  <div className="space-y-1">
                    <p>
                      {printServiceStatus
                        ? `Connected to ${printServiceStatus.service} at port ${printServiceStatus.port || 9123}. Ready to print receipts and KOTs.`
                        : "The local thermal printing daemon is not running on this computer. Start the service or install it using the command below."}
                    </p>
                    <div className="flex items-center gap-3 pt-1">
                      <Button size="small" icon={<ReloadOutlined />} loading={printServiceLoading} onClick={checkPrintService}>
                        Refresh Service Status
                      </Button>
                      <Button size="small" icon={<KeyOutlined />} onClick={() => setPairingTokenModalVisible(true)}>
                        Pairing Security Token
                      </Button>
                      <Button size="small" icon={<DownloadOutlined />} onClick={downloadInstallerCommand}>
                        Download Startup Script
                      </Button>
                    </div>
                  </div>
                }
              />

              {/* Configured Printers Table Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 m-0">Configured Thermal Printers</h3>
                  <p className="text-sm text-gray-500 m-0">
                    Assign different printers for Cashier Billing, Kitchen KOT Stations, or Bar counters.
                  </p>
                </div>
                <Space>
                  <Button icon={<ReloadOutlined />} onClick={fetchLocalPrinters} loading={printServiceLoading}>
                    Discover Windows Printers
                  </Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenAddPrinterModal(null)}>
                    Add Printer
                  </Button>
                </Space>
              </div>

              {/* Configured Printers Table */}
              <Table
                dataSource={configuredPrinters}
                rowKey="id"
                pagination={false}
                bordered
                columns={[
                  {
                    title: "Printer Name",
                    dataIndex: "name",
                    key: "name",
                    render: (name, record) => (
                      <div>
                        <div className="font-semibold text-gray-900">{name}</div>
                        <div className="text-xs text-gray-500 font-mono">
                          {record.connection_type === "network" ? (
                            <span><WifiOutlined /> LAN: {record.target}:{record.port || 9100}</span>
                          ) : (
                            <span><UsbOutlined /> Spooler: {record.target}</span>
                          )}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: "Role / Station",
                    dataIndex: "role",
                    key: "role",
                    render: (role, record) => {
                      if (role === "billing") return <Tag color="blue">Cashier Receipt</Tag>;
                      if (role === "kot_station") {
                        const station = kitchenStations.find((k) => String(k.id) === String(record.kitchen_id));
                        return <Tag color="orange">Kitchen KOT ({station?.kitchen_name || "All Stations"})</Tag>;
                      }
                      if (role === "both") return <Tag color="purple">Receipt + KOT</Tag>;
                      return <Tag>{role}</Tag>;
                    },
                  },
                  {
                    title: "Paper / Layout",
                    dataIndex: "paper_width",
                    key: "paper_width",
                    render: (width, record) => (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                        {width || "80mm"} ({record.columns || (width === "58mm" ? 32 : 48)} cols)
                      </span>
                    ),
                  },
                  {
                    title: "Options",
                    key: "options",
                    render: (_, record) => (
                      <Space size="small">
                        {record.has_cutter !== false && <Tag color="green">Auto-Cut</Tag>}
                        {record.has_cash_drawer && <Tag color="gold">Cash Drawer</Tag>}
                        {record.is_default && <Tag color="blue">Default</Tag>}
                      </Space>
                    ),
                  },
                  {
                    title: "Actions",
                    key: "actions",
                    render: (_, record) => (
                      <Space size="middle">
                        <Tooltip title="Print Test Pattern">
                          <Button
                            size="small"
                            icon={<PrinterOutlined />}
                            loading={testingPrinterId === record.id}
                            onClick={() => handleTestPrinter(record, true)}
                          >
                            Test Print
                          </Button>
                        </Tooltip>
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleOpenAddPrinterModal(record)}
                        />
                        <Popconfirm
                          title="Remove Printer"
                          description="Are you sure you want to delete this printer configuration?"
                          onConfirm={() => handleDeletePrinter(record.id)}
                          okText="Delete"
                          cancelText="Cancel"
                        >
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
              />

              <Divider style={{ margin: "16px 0" }} />

              {/* Receipt Header & Store Settings Preview */}
              <Card
                size="small"
                title={<span><ShopOutlined /> Store Receipt Branding</span>}
                extra={
                  <Button type="link" onClick={() => setActiveTab("store")}>
                    Edit Store Header & Terms →
                  </Button>
                }
              >
                <div className="bg-gray-50 p-3 rounded border text-sm grid grid-cols-2 gap-2">
                  <div><strong>Store Name:</strong> {receiptForm.getFieldValue("storeName") || getReceiptSettings().storeName}</div>
                  <div><strong>Bill Title:</strong> {receiptForm.getFieldValue("billTitle") || getReceiptSettings().billTitle}</div>
                  <div><strong>Phone:</strong> {receiptForm.getFieldValue("cell1") || getReceiptSettings().cell1}</div>
                  <div><strong>GSTIN:</strong> {receiptForm.getFieldValue("gstin") || getReceiptSettings().gstin}</div>
                </div>
              </Card>
            </Space>

            {/* Add / Edit Printer Modal */}
            <Modal
              title={editingPrinterId ? "Edit Printer Configuration" : "Add Universal Thermal Printer"}
              open={printerModalVisible}
              onCancel={() => setPrinterModalVisible(false)}
              footer={null}
              destroyOnHidden
            >
              <Form
                form={printerForm}
                layout="vertical"
                onFinish={handleSavePrinter}
                initialValues={{
                  connection_type: "os_spooler",
                  role: "billing",
                  paper_width: "80mm",
                  columns: 48,
                  has_cutter: true,
                  has_cash_drawer: false,
                  port: 9100,
                }}
              >
                <Form.Item
                  label="Display Name"
                  name="name"
                  rules={[{ required: true, message: "Please enter a friendly display name" }]}
                >
                  <Input placeholder="e.g. Counter Cashier Printer" />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Printer Role" name="role" rules={[{ required: true }]}>
                      <Select>
                        <Select.Option value="billing">Cashier Billing Receipt</Select.Option>
                        <Select.Option value="kot_station">Kitchen KOT Station</Select.Option>
                        <Select.Option value="both">Both (Receipt + KOT)</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, curr) => prev.role !== curr.role}
                    >
                      {({ getFieldValue }) =>
                        getFieldValue("role") === "kot_station" || getFieldValue("role") === "both" ? (
                          <Form.Item label="Specific Kitchen Station" name="kitchen_id">
                            <Select placeholder="All Stations (Default)" allowClear>
                              {kitchenStations.map((k) => (
                                <Select.Option key={k.id} value={k.id}>
                                  {k.kitchen_name}
                                </Select.Option>
                              ))}
                            </Select>
                          </Form.Item>
                        ) : null
                      }
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label="Connection Type"
                  name="connection_type"
                  rules={[{ required: true }]}
                >
                  <Select onChange={(val) => setSelectedConnectionType(val)}>
                    <Select.Option value="os_spooler">Windows Spooler (USB / Installed System Driver)</Select.Option>
                    <Select.Option value="network">Network Thermal Printer (Ethernet LAN / Wi-Fi IP)</Select.Option>
                  </Select>
                </Form.Item>

                {selectedConnectionType === "network" ? (
                  <Row gutter={16}>
                    <Col span={16}>
                      <Form.Item
                        label="Printer IP Address"
                        name="target"
                        rules={[
                          { required: true, message: "Please enter network printer IP" },
                          {
                            pattern: /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|127\.0\.0\.1)$/,
                            message: "Must be a private local IP (e.g. 192.168.1.100)",
                          },
                        ]}
                      >
                        <Input placeholder="192.168.1.100" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Port" name="port" rules={[{ required: true }]}>
                        <Input placeholder="9100" />
                      </Form.Item>
                    </Col>
                  </Row>
                ) : (
                  <Form.Item
                    label="System Printer Name"
                    name="target"
                    rules={[{ required: true, message: "Select or enter installed system printer" }]}
                  >
                    <Input
                      list="discovered-system-printers"
                      placeholder="e.g. 80mm Series Printer"
                    />
                    <datalist id="discovered-system-printers">
                      {localPrinters.map((p) => (
                        <option key={p.name} value={p.name} />
                      ))}
                    </datalist>
                  </Form.Item>
                )}

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Paper Width" name="paper_width">
                      <Select>
                        <Select.Option value="80mm">80mm Paper (Standard)</Select.Option>
                        <Select.Option value="58mm">58mm Paper (Compact)</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Character Columns" name="columns">
                      <Select>
                        <Select.Option value={48}>48 Columns (Standard 80mm Font A)</Select.Option>
                        <Select.Option value={42}>42 Columns (Condensed 80mm)</Select.Option>
                        <Select.Option value={32}>32 Columns (Standard 58mm Font A)</Select.Option>
                        <Select.Option value={40}>40 Columns (Condensed 58mm)</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16} className="bg-gray-50 p-3 rounded mb-4">
                  <Col span={8}>
                    <Form.Item label="Auto-Cut Paper" name="has_cutter" valuePropName="checked" className="m-0">
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Cash Drawer" name="has_cash_drawer" valuePropName="checked" className="m-0">
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Default Printer" name="is_default" valuePropName="checked" className="m-0">
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>

                <div className="flex justify-end gap-2">
                  <Button onClick={() => setPrinterModalVisible(false)}>Cancel</Button>
                  <Button type="primary" htmlType="submit">Save Printer</Button>
                </div>
              </Form>
            </Modal>

            {/* Pairing Token Modal */}
            <Modal
              title={<span><KeyOutlined /> Local Print Service Pairing Token</span>}
              open={pairingTokenModalVisible}
              onCancel={() => setPairingTokenModalVisible(false)}
              footer={null}
            >
              <p className="text-sm text-gray-600 mb-3">
                For security against unauthorized websites, the local print service validates an authentication token on port 9123.
              </p>
              <Form
                layout="vertical"
                initialValues={{ token: currentPairingToken }}
                onFinish={(vals) => handleSavePairingToken(vals.token)}
              >
                <Form.Item
                  label="Pairing Token (64 Hex Characters)"
                  name="token"
                  rules={[{ required: true, message: "Enter token or click Auto-Pair" }]}
                >
                  <Input.Password placeholder="Found in local-print-service/.service-token" />
                </Form.Item>
                <div className="flex justify-between items-center pt-2">
                  <Button
                    onClick={async () => {
                      const paired = await localPrintService.autoPairService();
                      if (paired) {
                        setCurrentPairingToken(paired);
                        message.success("Auto-paired token retrieved from localhost!");
                      } else {
                        message.error("Could not auto-retrieve token. Check if print service is running.");
                      }
                    }}
                  >
                    Auto-Pair from Localhost
                  </Button>
                  <Button type="primary" htmlType="submit">Save Token</Button>
                </div>
              </Form>
            </Modal>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default Settings;


