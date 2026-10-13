import { Op } from "sequelize";
import { sequelize } from "../../db/index.js";
import DailyInventoryLog from "../models/dailyInventoryLog.model.js";
import Ingredient from "../models/ingredient.model.js";
import Stock from "../models/stock.models.js";
import Product from "../../product/models/product.model.js";
import Category from "../../product/models/category.model.js";
import "../../product/models/associations.js";

const dailyInventoryService = {
  // 1️⃣ Fetch Daily Stock Summary (Morning + Inward + Live Sales + Evening Closing)
  async getDailySummary({ branch_id, date }) {
    if (!branch_id) {
      throw new Error("Branch ID is required");
    }

    const targetDate = date || new Date().toISOString().split("T")[0];

    // A. Fetch all active products
    const products = await Product.findAll({
      where: { is_active: true },
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "category_name"],
          required: false,
        },
      ],
      order: [["product_name", "ASC"]],
    });

    // B. Fetch stock records for this branch
    const branchStocks = await Stock.findAll({
      where: { branch_id },
    });
    const stockMap = new Map();
    branchStocks.forEach((s) => stockMap.set(s.product_id, s));

    // C. Fetch all active ingredients
    const ingredients = await Ingredient.findAll({
      where: {
        is_active: true,
        [Op.or]: [{ branch_id }, { branch_id: null }],
      },
      order: [["name", "ASC"]],
    });

    // D. Fetch today's billing sales per product
    const [salesRows] = await sequelize.query(
      `
      SELECT bi.product_id, COALESCE(SUM(bi.quantity), 0) AS sold_qty
      FROM billing_items bi
      INNER JOIN billing b ON bi.billing_id = b.id
      WHERE b.branch_id = :branch_id
        AND DATE(COALESCE(b.billing_date, b.createdAt)) = :targetDate
      GROUP BY bi.product_id
      `,
      { replacements: { branch_id, targetDate } }
    );

    const salesMap = new Map();
    salesRows.forEach((r) => salesMap.set(r.product_id, Number(r.sold_qty)));

    // E. Fetch existing DailyInventoryLog records for this branch & date
    const existingLogs = await DailyInventoryLog.findAll({
      where: {
        branch_id,
        date: targetDate,
      },
    });

    const logsMap = new Map();
    existingLogs.forEach((l) => logsMap.set(`${l.item_type}_${l.item_id}`, l));

    // F. Process Products
    const productItems = products.map((prod) => {
      const stock = stockMap.get(prod.id);
      const currentStock = stock ? Number(stock.quantity) : 0;
      const soldToday = salesMap.get(prod.id) || 0;
      const logKey = `product_${prod.id}`;
      const log = logsMap.get(logKey);

      if (log) {
        return {
          id: prod.id,
          log_id: log.id,
          item_type: "product",
          name: prod.product_name,
          category: prod.category ? prod.category.category_name : "General",
          unit: prod.unit || "piece",
          current_stock: currentStock,
          opening_stock: Number(log.opening_stock),
          added_stock: Number(log.added_stock),
          billed_qty: Number(log.billed_qty || soldToday),
          expected_stock: Number(log.expected_stock),
          closing_stock: log.closing_stock !== null ? Number(log.closing_stock) : null,
          discrepancy: log.discrepancy !== null ? Number(log.discrepancy) : null,
          wastage_qty: Number(log.wastage_qty || 0),
          wastage_reason: log.wastage_reason || "",
          notes: log.notes || "",
          status: log.status,
          morning_logged_by: log.morning_logged_by_name || null,
          evening_logged_by: log.evening_logged_by_name || null,
        };
      } else {
        const estimatedOpening = Math.max(0, currentStock + soldToday);
        const expected = currentStock;

        return {
          id: prod.id,
          log_id: null,
          item_type: "product",
          name: prod.product_name,
          category: prod.category ? prod.category.category_name : "General",
          unit: prod.unit || "piece",
          current_stock: currentStock,
          opening_stock: estimatedOpening,
          added_stock: 0,
          billed_qty: soldToday,
          expected_stock: expected,
          closing_stock: null,
          discrepancy: null,
          wastage_qty: 0,
          wastage_reason: "",
          notes: "",
          status: "OPEN",
          morning_logged_by: null,
          evening_logged_by: null,
        };
      }
    });

    // G. Process Ingredients
    const ingredientItems = ingredients.map((ing) => {
      const currentStock = Number(ing.stock_quantity);
      const logKey = `ingredient_${ing.id}`;
      const log = logsMap.get(logKey);

      if (log) {
        return {
          id: ing.id,
          log_id: log.id,
          item_type: "ingredient",
          name: ing.name,
          category: "Raw Material",
          unit: ing.base_unit || "kg",
          cost_per_unit: Number(ing.cost_per_unit || 0),
          low_stock_threshold: Number(ing.low_stock_threshold || 5),
          current_stock: currentStock,
          opening_stock: Number(log.opening_stock),
          added_stock: Number(log.added_stock),
          billed_qty: 0,
          expected_stock: Number(log.expected_stock),
          closing_stock: log.closing_stock !== null ? Number(log.closing_stock) : null,
          discrepancy: log.discrepancy !== null ? Number(log.discrepancy) : null,
          wastage_qty: Number(log.wastage_qty || 0),
          wastage_reason: log.wastage_reason || "",
          notes: log.notes || "",
          status: log.status,
          morning_logged_by: log.morning_logged_by_name || null,
          evening_logged_by: log.evening_logged_by_name || null,
        };
      } else {
        return {
          id: ing.id,
          log_id: null,
          item_type: "ingredient",
          name: ing.name,
          category: "Raw Material",
          unit: ing.base_unit || "kg",
          cost_per_unit: Number(ing.cost_per_unit || 0),
          low_stock_threshold: Number(ing.low_stock_threshold || 5),
          current_stock: currentStock,
          opening_stock: currentStock,
          added_stock: 0,
          billed_qty: 0,
          expected_stock: currentStock,
          closing_stock: null,
          discrepancy: null,
          wastage_qty: 0,
          wastage_reason: "",
          notes: "",
          status: "OPEN",
          morning_logged_by: null,
          evening_logged_by: null,
        };
      }
    });

    const allItems = [...productItems, ...ingredientItems];
    const closedCount = allItems.filter((i) => i.status === "CLOSED").length;
    const openCount = allItems.length - closedCount;

    return {
      date: targetDate,
      branch_id,
      products: productItems,
      ingredients: ingredientItems,
      summary: {
        totalItems: allItems.length,
        totalProducts: productItems.length,
        totalIngredients: ingredientItems.length,
        closedCount,
        openCount,
      },
    };
  },

  // 2️⃣ Record Morning / Added Stock (Arrivals or Purchases)
  async addMorningOrPurchaseEntry({ branch_id, date, entries, user }) {
    if (!branch_id) throw new Error("Branch ID is required");
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      throw new Error("No stock entries provided");
    }

    const targetDate = date || new Date().toISOString().split("T")[0];
    const userName = user ? user.name || user.username || user.email : "Billing User";
    const userId = user ? user.id : null;

    return await sequelize.transaction(async (t) => {
      const results = [];

      for (const entry of entries) {
        const addedQty = Number(entry.added_qty || 0);
        if (addedQty <= 0) continue;

        const itemType = entry.item_type || "product";
        const itemId = entry.item_id;

        if (itemType === "product") {
          const product = await Product.findByPk(itemId, { transaction: t });
          if (!product) continue;

          // Find or create Stock
          let stock = await Stock.findOne({
            where: { product_id: itemId, branch_id },
            transaction: t,
          });

          if (!stock) {
            stock = await Stock.create(
              {
                branch_id,
                product_id: itemId,
                unit: product.unit || "piece",
                cost_price: entry.cost_price || product.purchase_price || 0,
                selling_price: product.selling_price || 0,
                quantity: addedQty,
                inward_quantity: addedQty,
                billing_quantity: 0,
                supplier: entry.supplier || null,
              },
              { transaction: t }
            );
          } else {
            stock.quantity += addedQty;
            stock.inward_quantity += addedQty;
            if (entry.supplier) stock.supplier = entry.supplier;
            await stock.save({ transaction: t });
          }

          // Find or create DailyInventoryLog
          let log = await DailyInventoryLog.findOne({
            where: { branch_id, date: targetDate, item_id: itemId, item_type: "product" },
            transaction: t,
          });

          if (!log) {
            const opening = Math.max(0, stock.quantity - addedQty);
            log = await DailyInventoryLog.create(
              {
                branch_id,
                date: targetDate,
                item_type: "product",
                item_id: itemId,
                item_name: product.product_name,
                unit: product.unit || "piece",
                opening_stock: opening,
                added_stock: addedQty,
                billed_qty: 0,
                expected_stock: opening + addedQty,
                notes: entry.notes || null,
                morning_logged_by: userId,
                morning_logged_by_name: userName,
                status: "OPEN",
              },
              { transaction: t }
            );
          } else {
            log.added_stock = Number(log.added_stock) + addedQty;
            log.expected_stock = Number(log.opening_stock) + Number(log.added_stock) - Number(log.billed_qty);
            if (entry.notes) {
              log.notes = log.notes ? `${log.notes}; ${entry.notes}` : entry.notes;
            }
            if (!log.morning_logged_by) {
              log.morning_logged_by = userId;
              log.morning_logged_by_name = userName;
            }
            await log.save({ transaction: t });
          }

          results.push({ item_id: itemId, name: product.product_name, added: addedQty, new_stock: stock.quantity });
        } else if (itemType === "ingredient") {
          const ingredient = await Ingredient.findByPk(itemId, { transaction: t });
          if (!ingredient) continue;

          const oldQty = Number(ingredient.stock_quantity);
          ingredient.stock_quantity = oldQty + addedQty;
          if (entry.cost_price) ingredient.cost_per_unit = entry.cost_price;
          await ingredient.save({ transaction: t });

          let log = await DailyInventoryLog.findOne({
            where: { branch_id, date: targetDate, item_id: itemId, item_type: "ingredient" },
            transaction: t,
          });

          if (!log) {
            log = await DailyInventoryLog.create(
              {
                branch_id,
                date: targetDate,
                item_type: "ingredient",
                item_id: itemId,
                item_name: ingredient.name,
                unit: ingredient.base_unit || "kg",
                opening_stock: oldQty,
                added_stock: addedQty,
                billed_qty: 0,
                expected_stock: oldQty + addedQty,
                notes: entry.notes || null,
                morning_logged_by: userId,
                morning_logged_by_name: userName,
                status: "OPEN",
              },
              { transaction: t }
            );
          } else {
            log.added_stock = Number(log.added_stock) + addedQty;
            log.expected_stock = Number(log.opening_stock) + Number(log.added_stock) - Number(log.billed_qty);
            if (entry.notes) {
              log.notes = log.notes ? `${log.notes}; ${entry.notes}` : entry.notes;
            }
            if (!log.morning_logged_by) {
              log.morning_logged_by = userId;
              log.morning_logged_by_name = userName;
            }
            await log.save({ transaction: t });
          }

          results.push({ item_id: itemId, name: ingredient.name, added: addedQty, new_stock: ingredient.stock_quantity });
        }
      }

      return {
        message: `Successfully updated stock for ${results.length} items`,
        items: results,
      };
    });
  },

  // 3️⃣ Record Evening Closing Stock & Wastage Reconciliation
  async recordEveningClosing({ branch_id, date, closings, user }) {
    if (!branch_id) throw new Error("Branch ID is required");
    if (!closings || !Array.isArray(closings) || closings.length === 0) {
      throw new Error("No closing stock records provided");
    }

    const targetDate = date || new Date().toISOString().split("T")[0];
    const userName = user ? user.name || user.username || user.email : "Billing User";
    const userId = user ? user.id : null;

    return await sequelize.transaction(async (t) => {
      const results = [];

      // Query latest sales count for today
      const [salesRows] = await sequelize.query(
        `
        SELECT bi.product_id, COALESCE(SUM(bi.quantity), 0) AS sold_qty
        FROM billing_items bi
        INNER JOIN billing b ON bi.billing_id = b.id
        WHERE b.branch_id = :branch_id
          AND DATE(COALESCE(b.billing_date, b.createdAt)) = :targetDate
        GROUP BY bi.product_id
        `,
        { replacements: { branch_id, targetDate }, transaction: t }
      );
      const salesMap = new Map();
      salesRows.forEach((r) => salesMap.set(r.product_id, Number(r.sold_qty)));

      for (const item of closings) {
        if (item.closing_stock === undefined || item.closing_stock === null || item.closing_stock === "") {
          continue; // Skip items where user didn't enter a closing count
        }

        const closingQty = Number(item.closing_stock);
        const wastageQty = Number(item.wastage_qty || 0);
        const wastageReason = item.wastage_reason || null;
        const notes = item.notes || null;
        const itemType = item.item_type || "product";
        const itemId = item.item_id;

        if (itemType === "product") {
          const product = await Product.findByPk(itemId, { transaction: t });
          if (!product) continue;

          let stock = await Stock.findOne({
            where: { product_id: itemId, branch_id },
            transaction: t,
          });

          const currentStock = stock ? Number(stock.quantity) : 0;
          const soldToday = salesMap.get(itemId) || 0;

          let log = await DailyInventoryLog.findOne({
            where: { branch_id, date: targetDate, item_id: itemId, item_type: "product" },
            transaction: t,
          });

          let openingStock = 0;
          let addedStock = 0;

          if (!log) {
            openingStock = Math.max(0, currentStock + soldToday);
            addedStock = 0;
            log = await DailyInventoryLog.create(
              {
                branch_id,
                date: targetDate,
                item_type: "product",
                item_id: itemId,
                item_name: product.product_name,
                unit: product.unit || "piece",
                opening_stock: openingStock,
                added_stock: 0,
                billed_qty: soldToday,
                expected_stock: openingStock - soldToday,
                closing_stock: closingQty,
                discrepancy: closingQty - (openingStock - soldToday),
                wastage_qty: wastageQty,
                wastage_reason: wastageReason,
                notes,
                evening_logged_by: userId,
                evening_logged_by_name: userName,
                status: "CLOSED",
              },
              { transaction: t }
            );
          } else {
            openingStock = Number(log.opening_stock);
            addedStock = Number(log.added_stock);
            log.billed_qty = soldToday;
            const expected = openingStock + addedStock - soldToday;
            log.expected_stock = expected;
            log.closing_stock = closingQty;
            log.discrepancy = closingQty - expected;
            log.wastage_qty = wastageQty;
            log.wastage_reason = wastageReason;
            if (notes) log.notes = notes;
            log.evening_logged_by = userId;
            log.evening_logged_by_name = userName;
            log.status = "CLOSED";
            await log.save({ transaction: t });
          }

          // Adjust master stock to the verified physical closing stock
          if (stock) {
            stock.quantity = closingQty;
            await stock.save({ transaction: t });
          } else {
            await Stock.create(
              {
                branch_id,
                product_id: itemId,
                unit: product.unit || "piece",
                cost_price: product.purchase_price || 0,
                selling_price: product.selling_price || 0,
                quantity: closingQty,
                inward_quantity: closingQty,
                billing_quantity: 0,
              },
              { transaction: t }
            );
          }

          results.push({
            item_id: itemId,
            name: product.product_name,
            expected: log.expected_stock,
            actual: closingQty,
            discrepancy: log.discrepancy,
            wastage: wastageQty,
          });
        } else if (itemType === "ingredient") {
          const ingredient = await Ingredient.findByPk(itemId, { transaction: t });
          if (!ingredient) continue;

          let log = await DailyInventoryLog.findOne({
            where: { branch_id, date: targetDate, item_id: itemId, item_type: "ingredient" },
            transaction: t,
          });

          let openingStock = Number(ingredient.stock_quantity);
          let addedStock = 0;

          if (!log) {
            log = await DailyInventoryLog.create(
              {
                branch_id,
                date: targetDate,
                item_type: "ingredient",
                item_id: itemId,
                item_name: ingredient.name,
                unit: ingredient.base_unit || "kg",
                opening_stock: openingStock,
                added_stock: 0,
                billed_qty: 0,
                expected_stock: openingStock,
                closing_stock: closingQty,
                discrepancy: closingQty - openingStock,
                wastage_qty: wastageQty,
                wastage_reason: wastageReason,
                notes,
                evening_logged_by: userId,
                evening_logged_by_name: userName,
                status: "CLOSED",
              },
              { transaction: t }
            );
          } else {
            openingStock = Number(log.opening_stock);
            addedStock = Number(log.added_stock);
            const expected = openingStock + addedStock - Number(log.billed_qty || 0);
            log.expected_stock = expected;
            log.closing_stock = closingQty;
            log.discrepancy = closingQty - expected;
            log.wastage_qty = wastageQty;
            log.wastage_reason = wastageReason;
            if (notes) log.notes = notes;
            log.evening_logged_by = userId;
            log.evening_logged_by_name = userName;
            log.status = "CLOSED";
            await log.save({ transaction: t });
          }

          // Adjust ingredient master stock
          ingredient.stock_quantity = closingQty;
          await ingredient.save({ transaction: t });

          results.push({
            item_id: itemId,
            name: ingredient.name,
            expected: log.expected_stock,
            actual: closingQty,
            discrepancy: log.discrepancy,
            wastage: wastageQty,
          });
        }
      }

      return {
        message: `Successfully closed evening inventory for ${results.length} items`,
        items: results,
      };
    });
  },

  // 4️⃣ Fetch Historical Daily Inventory Logs
  async getHistory({ branch_id, startDate, endDate, item_type, status, page = 1, limit = 50 }) {
    if (!branch_id) throw new Error("Branch ID is required");

    const where = { branch_id };
    if (startDate && endDate) {
      where.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.date = { [Op.gte]: startDate };
    } else if (endDate) {
      where.date = { [Op.lte]: endDate };
    }

    if (item_type) where.item_type = item_type;
    if (status) where.status = status;

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows } = await DailyInventoryLog.findAndCountAll({
      where,
      order: [["date", "DESC"], ["createdAt", "DESC"]],
      limit: Number(limit),
      offset,
    });

    return {
      total: count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(count / limit),
      data: rows,
    };
  },

  // 5️⃣ Ingredients Management (CRUD)
  async getIngredients({ branch_id, search }) {
    const where = { is_active: true };
    if (branch_id) {
      where[Op.or] = [{ branch_id }, { branch_id: null }];
    }
    if (search) {
      where.name = { [Op.like]: `%${search}%` };
    }

    return await Ingredient.findAll({
      where,
      order: [["name", "ASC"]],
    });
  },

  async createIngredient(data) {
    if (!data.name) throw new Error("Ingredient name is required");
    return await Ingredient.create(data);
  },

  async updateIngredient(id, data) {
    const item = await Ingredient.findByPk(id);
    if (!item) throw new Error("Ingredient not found");
    return await item.update(data);
  },

  async deleteIngredient(id) {
    const item = await Ingredient.findByPk(id);
    if (!item) throw new Error("Ingredient not found");
    return await item.update({ is_active: false });
  },
};

export default dailyInventoryService;
