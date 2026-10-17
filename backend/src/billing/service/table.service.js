import Table from "../models/table.model.js";
import Billing from "../models/billing.models.js";
import { Op } from "sequelize";

// Helper to format table identifiers: "T1" -> "Table 1"
const formatTableLabel = (val) => {
  if (!val) return "";
  const str = String(val).trim();
  const matchT = str.match(/^T(\d+)$/i);
  if (matchT) return `Table ${parseInt(matchT[1], 10)}`;
  return str;
};

const tableService = {
  async createTable(data) {
    return await Table.create(data);
  },
  
  async getTablesByBranch(branchId) {
    const tables = await Table.findAll({
      where: { branch_id: branchId, active: true },
    });

    // Query active unpaid orders in this branch to determine real-time occupancy
    const activeBills = await Billing.findAll({
      where: {
        branch_id: branchId,
        status: { [Op.notIn]: ['paid', 'cancelled'] },
        counter_no: { [Op.ne]: null }
      },
      attributes: ['id', 'billing_no', 'counter_no', 'table_id', 'status', 'kot_status', 'customer_name', 'total_amount']
    });

    const activeMap = {};
    activeBills.forEach(b => {
      if (b.table_id) activeMap[String(b.table_id)] = b;
      if (b.counter_no) {
        activeMap[b.counter_no] = b;
        activeMap[b.counter_no.replace('Counter ', 'Table ')] = b;
        activeMap[b.counter_no.replace('Table ', 'Counter ')] = b;
      }
    });

    const enriched = await Promise.all(tables.map(async (table) => {
      const tLabel = formatTableLabel(table.table_name || table.table_no || `Table ${table.id}`);
      const tRawNo = table.table_no;
      const activeBill = activeMap[String(table.id)] || activeMap[tLabel] || activeMap[tRawNo] || activeMap[`Counter ${tRawNo}`] || activeMap[`Table ${tRawNo}`];
      const isOccupied = Boolean(activeBill);
      const computedStatus = isOccupied ? 'occupied' : 'available';

      if (table.status !== computedStatus) {
        await table.update({ status: computedStatus });
      }

      const tableJson = table.toJSON();
      return {
        ...tableJson,
        status: computedStatus,
        is_occupied: isOccupied,
        active_order: activeBill ? {
          id: activeBill.id,
          billing_no: activeBill.billing_no,
          status: activeBill.status,
          kot_status: activeBill.kot_status,
          customer_name: activeBill.customer_name,
          total_amount: activeBill.total_amount
        } : null
      };
    }));

    return enriched.sort((a, b) => {
      const valA = String(a.table_no || a.table_name || "");
      const valB = String(b.table_no || b.table_name || "");
      return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
    });
  },

  async getNextAvailableTable(branchId) {
    const tables = await this.getTablesByBranch(branchId);
    return tables.find(t => !t.is_occupied) || null;
  },

  async updateTable(id, branchId, data) {
    const table = await Table.findOne({ where: { id, branch_id: branchId } });
    if (!table) throw new Error("Table not found");
    return await table.update(data);
  },

  async deleteTable(id, branchId) {
    const table = await Table.findOne({ where: { id, branch_id: branchId } });
    if (!table) throw new Error("Table not found");
    return await table.update({ active: false });
  },

  async updateTableStatus(id, branchId, status) {
    const table = await Table.findOne({ where: { id, branch_id: branchId } });
    if (!table) throw new Error("Table not found");
    return await table.update({ status });
  }
};

export default tableService;
