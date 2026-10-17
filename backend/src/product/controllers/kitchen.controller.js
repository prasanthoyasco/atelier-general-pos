import Kitchen from '../models/kitchen.model.js';
import Product from '../models/product.model.js';
import Category from '../models/category.model.js';
import BillingKOT from '../../billing/models/billingkot.model.js';
import { Op, fn, col } from 'sequelize';

/**
 * Helper to get effective branch ID
 */
const getBranchId = (req) => {
  return req.branchContext?.branchId || req.query.branch_id || req.body.branch_id || req.user?.branch_id || null;
};

/**
 * 1. GET ALL KITCHENS (with product count and active queue status)
 */
export const getKitchens = async (req, res) => {
  try {
    const branchId = getBranchId(req);
    const { search, is_active } = req.query;

    const where = {};
    if (branchId) {
      where.branch_id = branchId;
    }

    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    } else {
      where.is_active = true;
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      where[Op.or] = [
        { kitchen_name: { [Op.iLike]: q } },
        { code: { [Op.iLike]: q } }
      ];
    }

    const kitchens = await Kitchen.findAll({
      where,
      order: [
        ['is_default', 'DESC'],
        ['createdAt', 'ASC']
      ]
    });

    // Populate assigned product counts and live queue statistics
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const enrichedKitchens = await Promise.all(
      kitchens.map(async (k) => {
        const kJson = k.toJSON();

        // 1. Assigned product count
        const productCount = await Product.count({
          where: {
            kitchen_id: k.id,
            is_active: true
          }
        });

        // 2. Live active KOTs in queue (pending + preparing)
        const activeKOTs = await BillingKOT.count({
          where: {
            kitchen_id: k.id,
            status: { [Op.in]: ['pending', 'preparing'] },
            createdAt: { [Op.gte]: todayStart }
          }
        });

        const pendingKOTs = await BillingKOT.count({
          where: {
            kitchen_id: k.id,
            status: 'pending',
            createdAt: { [Op.gte]: todayStart }
          }
        });

        const readyKOTs = await BillingKOT.count({
          where: {
            kitchen_id: k.id,
            status: { [Op.in]: ['ready', 'partially_ready'] },
            createdAt: { [Op.gte]: todayStart }
          }
        });

        return {
          ...kJson,
          products_count: productCount,
          active_kots: activeKOTs,
          pending_kots: pendingKOTs,
          ready_kots: readyKOTs,
        };
      })
    );

    return res.sendSuccess(enrichedKitchens, "Kitchens fetched successfully");
  } catch (error) {
    console.error("Error fetching kitchens:", error);
    return res.sendError("Failed to fetch kitchens: " + error.message, 500);
  }
};

/**
 * 2. GET SINGLE KITCHEN BY ID (with assigned products list)
 */
export const getKitchenById = async (req, res) => {
  try {
    const { id } = req.params;
    const kitchen = await Kitchen.findByPk(id);

    if (!kitchen) {
      return res.sendError("Kitchen station not found", 404);
    }

    const products = await Product.findAll({
      where: {
        kitchen_id: id,
        is_active: true
      },
      attributes: ['id', 'product_name', 'product_code', 'price', 'category_id', 'is_active'],
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'category_name']
        }
      ],
      order: [['product_name', 'ASC']]
    });

    const kData = kitchen.toJSON();
    kData.products = products;
    kData.products_count = products.length;

    return res.sendSuccess(kData, "Kitchen station retrieved successfully");
  } catch (error) {
    console.error("Error fetching kitchen details:", error);
    return res.sendError("Failed to fetch kitchen details: " + error.message, 500);
  }
};

/**
 * 3. CREATE KITCHEN STATION
 */
export const createKitchen = async (req, res) => {
  try {
    const branchId = getBranchId(req);
    const {
      kitchen_name,
      code,
      description,
      color_tag,
      default_prep_time,
      printer_ip,
      printer_port,
      auto_print,
      is_default
    } = req.body;

    if (!kitchen_name || !kitchen_name.trim()) {
      return res.sendError("Kitchen name is required", 400);
    }

    if (!branchId) {
      return res.sendError("Branch ID is required", 400);
    }

    // Check duplicate name in branch
    const existing = await Kitchen.findOne({
      where: {
        branch_id: branchId,
        kitchen_name: kitchen_name.trim(),
        is_active: true
      }
    });

    if (existing) {
      return res.sendError("A kitchen station with this name already exists in this branch", 409);
    }

    // If marked default, unset default on other stations in this branch
    if (is_default) {
      await Kitchen.update(
        { is_default: false },
        { where: { branch_id: branchId } }
      );
    } else {
      // If this is the FIRST kitchen in this branch, make it default automatically
      const count = await Kitchen.count({ where: { branch_id: branchId, is_active: true } });
      if (count === 0) {
        req.body.is_default = true;
      }
    }

    const newKitchen = await Kitchen.create({
      kitchen_name: kitchen_name.trim(),
      code: code ? code.trim().toUpperCase() : null,
      description: description ? description.trim() : null,
      color_tag: color_tag || "#4F46E5",
      default_prep_time: parseInt(default_prep_time) || 15,
      printer_ip: printer_ip ? printer_ip.trim() : null,
      printer_port: parseInt(printer_port) || 9100,
      auto_print: auto_print === true || auto_print === 'true',
      is_default: req.body.is_default === true,
      branch_id: branchId,
      is_active: true,
      created_by: req.user?.id || null
    });

    return res.sendSuccess(newKitchen, "Kitchen station created successfully", 201);
  } catch (error) {
    console.error("Error creating kitchen:", error);
    return res.sendError("Failed to create kitchen: " + error.message, 500);
  }
};

/**
 * 4. UPDATE KITCHEN STATION
 */
export const updateKitchen = async (req, res) => {
  try {
    const { id } = req.params;
    const kitchen = await Kitchen.findByPk(id);

    if (!kitchen) {
      return res.sendError("Kitchen station not found", 404);
    }

    const {
      kitchen_name,
      code,
      description,
      color_tag,
      default_prep_time,
      printer_ip,
      printer_port,
      auto_print,
      is_default,
      is_active
    } = req.body;

    // Check duplicate name if renamed
    if (kitchen_name && kitchen_name.trim() !== kitchen.kitchen_name) {
      const duplicate = await Kitchen.findOne({
        where: {
          branch_id: kitchen.branch_id,
          kitchen_name: kitchen_name.trim(),
          id: { [Op.ne]: id },
          is_active: true
        }
      });
      if (duplicate) {
        return res.sendError("Another kitchen station with this name already exists in this branch", 409);
      }
    }

    // Handle is_default logic
    if (is_default === true) {
      await Kitchen.update(
        { is_default: false },
        { where: { branch_id: kitchen.branch_id, id: { [Op.ne]: id } } }
      );
    }

    await kitchen.update({
      kitchen_name: kitchen_name !== undefined ? kitchen_name.trim() : kitchen.kitchen_name,
      code: code !== undefined ? (code ? code.trim().toUpperCase() : null) : kitchen.code,
      description: description !== undefined ? description : kitchen.description,
      color_tag: color_tag !== undefined ? color_tag : kitchen.color_tag,
      default_prep_time: default_prep_time !== undefined ? parseInt(default_prep_time) : kitchen.default_prep_time,
      printer_ip: printer_ip !== undefined ? (printer_ip ? printer_ip.trim() : null) : kitchen.printer_ip,
      printer_port: printer_port !== undefined ? parseInt(printer_port) : kitchen.printer_port,
      auto_print: auto_print !== undefined ? (auto_print === true || auto_print === 'true') : kitchen.auto_print,
      is_default: is_default !== undefined ? is_default : kitchen.is_default,
      is_active: is_active !== undefined ? is_active : kitchen.is_active,
      updated_by: req.user?.id || null
    });

    return res.sendSuccess(kitchen, "Kitchen station updated successfully");
  } catch (error) {
    console.error("Error updating kitchen:", error);
    return res.sendError("Failed to update kitchen: " + error.message, 500);
  }
};

/**
 * 5. DELETE / DEACTIVATE KITCHEN STATION
 */
export const deleteKitchen = async (req, res) => {
  try {
    const { id } = req.params;
    const kitchen = await Kitchen.findByPk(id);

    if (!kitchen) {
      return res.sendError("Kitchen station not found", 404);
    }

    // Do not allow deleting the sole default station if other stations exist
    if (kitchen.is_default) {
      const otherKitchen = await Kitchen.findOne({
        where: {
          branch_id: kitchen.branch_id,
          id: { [Op.ne]: id },
          is_active: true
        }
      });
      if (otherKitchen) {
        // Promote another kitchen to default before deleting
        await otherKitchen.update({ is_default: true });
      }
    }

    // Find the default or fallback kitchen for reassigning orphaned products
    const fallbackKitchen = await Kitchen.findOne({
      where: {
        branch_id: kitchen.branch_id,
        id: { [Op.ne]: id },
        is_active: true
      },
      order: [['is_default', 'DESC']]
    });

    // Reassign products to fallback station, or null
    await Product.update(
      { kitchen_id: fallbackKitchen ? fallbackKitchen.id : null },
      { where: { kitchen_id: id } }
    );

    // Soft delete
    await kitchen.update({
      is_active: false,
      is_default: false,
      updated_by: req.user?.id || null
    });

    return res.sendSuccess({ reassigned_to: fallbackKitchen?.id || null }, "Kitchen station removed successfully");
  } catch (error) {
    console.error("Error deleting kitchen:", error);
    return res.sendError("Failed to delete kitchen: " + error.message, 500);
  }
};

/**
 * 6. ASSIGN PRODUCTS / CATEGORIES TO KITCHEN STATION (Bulk Routing)
 */
export const assignItemsToKitchen = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_ids = [], product_ids = [] } = req.body;

    const kitchen = await Kitchen.findByPk(id);
    if (!kitchen || !kitchen.is_active) {
      return res.sendError("Kitchen station not found or inactive", 404);
    }

    let affectedCount = 0;

    // 1. Assign all active products from specified categories
    if (Array.isArray(category_ids) && category_ids.length > 0) {
      const [catUpdated] = await Product.update(
        { kitchen_id: id },
        {
          where: {
            category_id: { [Op.in]: category_ids },
            is_active: true
          }
        }
      );
      affectedCount += catUpdated;
    }

    // 2. Assign specifically selected product IDs
    if (Array.isArray(product_ids) && product_ids.length > 0) {
      const [prodUpdated] = await Product.update(
        { kitchen_id: id },
        {
          where: {
            id: { [Op.in]: product_ids },
            is_active: true
          }
        }
      );
      affectedCount += prodUpdated;
    }

    return res.sendSuccess({ affected_products: affectedCount }, `Successfully routed ${affectedCount} product(s) to ${kitchen.kitchen_name}`);
  } catch (error) {
    console.error("Error assigning items to kitchen:", error);
    return res.sendError("Failed to assign items to kitchen: " + error.message, 500);
  }
};

/**
 * 7. GET OVERVIEW METRICS ACROSS ALL KITCHEN STATIONS
 */
export const getKitchenOverviewStats = async (req, res) => {
  try {
    const branchId = getBranchId(req);
    const where = { is_active: true };
    if (branchId) where.branch_id = branchId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const totalStations = await Kitchen.count({ where });

    // Active KOTs (pending + preparing)
    const activeKOTCount = await BillingKOT.count({
      where: {
        ...(branchId ? { branch_id: branchId } : {}),
        status: { [Op.in]: ['pending', 'preparing'] },
        createdAt: { [Op.gte]: todayStart }
      }
    });

    // Completed KOTs today
    const completedKOTCount = await BillingKOT.count({
      where: {
        ...(branchId ? { branch_id: branchId } : {}),
        status: { [Op.in]: ['ready', 'served', 'partially_served'] },
        createdAt: { [Op.gte]: todayStart }
      }
    });

    // Delayed KOTs (in preparing or pending for > 20 mins)
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
    const delayedCount = await BillingKOT.count({
      where: {
        ...(branchId ? { branch_id: branchId } : {}),
        status: { [Op.in]: ['pending', 'preparing'] },
        createdAt: { [Op.lte]: twentyMinsAgo }
      }
    });

    return res.sendSuccess({
      total_stations: totalStations,
      active_kots: activeKOTCount,
      completed_today: completedKOTCount,
      delayed_kots: delayedCount
    }, "Kitchen overview metrics retrieved successfully");
  } catch (error) {
    console.error("Error fetching kitchen overview stats:", error);
    return res.sendError("Failed to fetch kitchen metrics: " + error.message, 500);
  }
};
