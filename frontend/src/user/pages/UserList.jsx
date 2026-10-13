import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Table, Button, Space, Popconfirm, message, Input, Tag, Grid, List, Card, Select } from "antd";
import { EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined, ShopOutlined } from "@ant-design/icons";
import userService from "../service/userService";

const UserList = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [messageApi, contextHolder] = message.useMessage();
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [pagination.current, pagination.pageSize, searchText, selectedBranch]);

  const fetchBranches = async () => {
    try {
      const response = await userService.getBranches();
      const branchesData = response.data.data || [];
      setBranches(branchesData);
    } catch (error) {
      console.error("Failed to fetch branches:", error);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await userService.getUsers({
        page: pagination.current,
        limit: pagination.pageSize,
        search: searchText,
        branch_id: selectedBranch !== "all" ? selectedBranch : undefined,
      });

      const usersData = response.data.data || [];

      // Map backend field names to frontend field names
      const mappedUsers = usersData.map(user => ({
        id: user.id,
        name: user.username,
        email: user.email,
        phone: user.phone,
        role_id: user.role_id,
        Role: user.role ? { name: user.role.role_name } : { name: 'N/A' },
        branches: user.branches || [],
        isActive: user.is_active,
        isDeleted: user.deleted_by !== null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));

      setUsers(mappedUsers);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination?.total || 0,
      }));
    } catch (error) {
      message.error("Failed to fetch users");
      console.error('Fetch users error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination({
      current: newPagination.current,
      pageSize: newPagination.pageSize,
      total: pagination.total,
    });
  };

  const handleSearch = (value) => {
    setSearchText(value);
    setPagination(prev => ({ ...prev, current: 1 })); // Reset to first page on search
  };

  const handleBranchChange = (value) => {
    setSelectedBranch(value);
    setPagination(prev => ({ ...prev, current: 1 })); // Reset to first page on branch change
  };

  const handleDelete = async (id) => {
    try {
      await userService.deleteUser(id);
      messageApi.success("User deleted successfully");
      fetchUsers();
    } catch (error) {
      messageApi.error("Failed to delete user");
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Phone",
      dataIndex: "phone",
      key: "phone",
    },
    {
      title: "Role",
      dataIndex: ["Role", "name"],
      key: "role",
      render: (role) => <Tag color="blue">{role}</Tag>,
    },
    {
      title: "Branches",
      dataIndex: "branches",
      key: "branches",
      render: (userBranches) => (
        <Space wrap size={[0, 4]}>
          {userBranches && userBranches.length > 0 ? (
            userBranches.map(b => (
              <Tag key={b.id} color="purple">
                {b.branch_name}
              </Tag>
            ))
          ) : (
            <span className="text-gray-400 text-xs">No Branch</span>
          )}
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "isDeleted",
      key: "status",
      render: (isDeleted) => (
        <Tag color={isDeleted ? "red" : "green"}>
          {isDeleted ? "Inactive" : "Active"}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <>
          {contextHolder}
          <Space>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => navigate(`/user/users/edit/${record.id}`)}
            />
            {/* <Popconfirm
            title="Delete user?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="primary" danger icon={<DeleteOutlined />} />
          </Popconfirm> */}
          </Space>
        </>
      ),
    },
  ];

  /* ... inside UserList component ... */
  const screens = Grid.useBreakpoint();

  /* ... return block ... */
  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold m-0">Users</h1>
          <p className="text-xs text-gray-500 m-0 mt-0.5">Manage users and filter by assigned branch</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Select
            value={selectedBranch}
            onChange={handleBranchChange}
            suffixIcon={<ShopOutlined />}
            placeholder="Filter by Branch"
            className="w-full sm:w-[200px]"
            options={[
              { label: "All Branches", value: "all" },
              ...branches.map(b => ({
                label: b.branch_code ? `${b.branch_name} (${b.branch_code})` : b.branch_name,
                value: b.id,
              })),
            ]}
          />
          <Input
            placeholder="Search by name, email, or phone..."
            prefix={<SearchOutlined />}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full sm:w-[260px]"
            allowClear
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/user/users/add")}
            className="w-full sm:w-auto !text-white"
          >
            Add User
          </Button>
        </div>
      </div>

      {!screens.md ? (
        <List
          grid={{ gutter: 16, column: 1 }}
          dataSource={users}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page, pageSize) => handleTableChange({ current: page, pageSize }),
            // showSizeChanger: true, // List pagination is simpler usually
          }}
          renderItem={(item) => (
            <List.Item>
              <Card
                title={item.name}
                bordered={false}
                style={{ borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
                actions={[
                  <Button type="text" icon={<EditOutlined />} onClick={() => navigate(`/user/users/edit/${item.id}`)}>
                    Edit
                  </Button>,
                  /* 
                  <Popconfirm title="Delete user?" onConfirm={() => handleDelete(item.id)}>
                    <Button type="text" danger icon={<DeleteOutlined />}>Delete</Button>
                  </Popconfirm> 
                  */
                ]}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email:</span>
                    <span className="font-medium break-all">{item.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone:</span>
                    <span className="font-medium">{item.phone}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Role:</span>
                    <Tag color="blue">{item.Role?.name}</Tag>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-gray-500">Branches:</span>
                    <div className="flex flex-wrap gap-1 justify-end max-w-[65%]">
                      {item.branches && item.branches.length > 0 ? (
                        item.branches.map(b => (
                          <Tag key={b.id} color="purple">
                            {b.branch_name}
                          </Tag>
                        ))
                      ) : (
                        <span className="text-gray-400 text-xs">No Branch</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Status:</span>
                    <Tag color={item.isDeleted ? "red" : "green"}>
                      {item.isDeleted ? "Inactive" : "Active"}
                    </Tag>
                  </div>
                </div>
              </Card>
            </List.Item>
          )}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={users}
          loading={loading}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          onChange={handleTableChange}
          scroll={{ x: true }}
        />
      )}
    </div>
  );
};

export default UserList;
