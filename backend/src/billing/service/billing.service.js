// services/billing.service.js
import { Op } from "sequelize";
import { sequelize } from "../../db/index.js";
import Billing from "../models/billing.models.js";
import BillingItem from "../models/billingiteam.models.js";
import Product from "../../product/models/product.model.js";
import Stock from "../../stock/models/stock.models.js";
import Customer from "../models/customer.model.js";
import Branch from "../../user/models/branch.model.js";
import customerService from "./customer.service.js";
import couponService from "./coupon.service.js";
import Category from "../../product/models/category.model.js";
import Kitchen from "../../product/models/kitchen.model.js";
import BillingKOT from "../models/billingkot.model.js";
import BillingKOTItem from "../models/billingkotitem.model.js";
import Table from "../models/table.model.js";
import "../models/associations.js";
import { v4 as uuidv4 } from "uuid";
const billingService = {
  // ✅ Create Billing with Items
  async createBillingWithItems(data) {
    return await sequelize.transaction(async (t) => {
      // 1️⃣ Handle Customer - Find or Create
      let customer = null;
      if (data.customer_phone) {
        customer = await customerService.findOrCreateCustomer({
          customer_phone: data.customer_phone,
          customer_name: data.customer_name,
          customer_email: data.customer_email,
          source: data.source
        }, data.created_by, { transaction: t });
      }

      // 2️⃣ Generate unique random billing_no
      let billingNo;
      let isUnique = false;
      while (!isUnique) {
        // Format: BILL-YYYYMMDD-XXXXX (date + 5 random alphanumeric chars)
        const date = new Date();
        const datePart = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0,O,1,I)
        const randomPart = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        billingNo = `BILL-${datePart}-${randomPart}`;
        const existing = await Billing.findOne({ where: { billing_no: billingNo }, transaction: t });
        if (!existing) isUnique = true;
      }

      // 3️⃣ Validate products and prepare items
      let subtotal = 0;
      let totalQuantity = 0;
      const itemsToCreate = [];
      const KOT_ELIGIBLE_CATEGORIES = ['snack', 'beverage', 'rice', 'pizza', 'salad', 'soup', 'bakery', 'tea', 'coffee', 'juice', 'milk', 'drink'];
      let hasKOTItems = false;

      const itemsList = data.items || data.billing_items;
      if (!itemsList || itemsList.length === 0) {
        throw new Error("Billing must have at least one item");
      }

      for (let i = 0; i < itemsList.length; i++) {
        const item = itemsList[i];

        // Check if product exists
        const product = await Product.findByPk(item.product_id, {
          transaction: t,
        });
        if (!product) {
          throw new Error(`Product with ID ${item.product_id} does not exist`);
        }

        // Check KOT eligibility based on product kitchen or category
        let productNeedsKOT = false;
        let pKitchenId = product.kitchen_id;
        let pKitchenName = 'Main Kitchen';

        if (pKitchenId) {
            const kitchen = await Kitchen.findByPk(pKitchenId, { transaction: t });
            if (kitchen) {
                pKitchenName = kitchen.kitchen_name;
                productNeedsKOT = true;
                hasKOTItems = true;
            }
        } else if (product.category_id) {
          const category = await Category.findByPk(product.category_id, { transaction: t });
          if (category && category.category_name) {
            const catName = category.category_name.toLowerCase();
            const matched = KOT_ELIGIBLE_CATEGORIES.some(cat => catName.includes(cat));
            if (matched) {
              productNeedsKOT = true;
              hasKOTItems = true;
            }
          }
        }

        const quantity = item.quantity || 0;
        const unitPrice = item.unit_price || product.selling_price || 0;
        const itemSubtotal = quantity * unitPrice; // Subtotal without tax

        subtotal += itemSubtotal;
        totalQuantity += quantity;

        itemsToCreate.push({
          id: uuidv4(),
          product_id: item.product_id,
          size: item.size,
          color: item.color,
          quantity,
          unit_price: unitPrice,
          mrp: item.mrp || product.mrp,
          discount_percentage: item.discount_percentage || 0,
          discount: item.discount_amount || item.discount || 0,
          tax: item.tax_amount || item.tax || 0,
          total_price: item.total_price || (quantity * unitPrice + (item.tax_amount || 0) - (item.discount_amount || 0)),
          barcode: item.barcode,
          needsKOT: productNeedsKOT,
          kitchen_id: pKitchenId,
          kitchen_name: pKitchenName
        });

        // 4️⃣ Update Stock (reduce quantity) - Allow negative stock
        const stockWhere = {
          product_id: item.product_id,
          branch_id: data.branch_id
        };

        // If size and color specified, find exact match
        if (item.size) stockWhere.size = item.size;
        if (item.color) stockWhere.color = item.color;

        let stock = await Stock.findOne({
          where: stockWhere,
          transaction: t,
        });

        // If stock doesn't exist, create it with negative quantity
        if (!stock) {
          stock = await Stock.create({
            product_id: item.product_id,
            branch_id: data.branch_id,
            size: item.size || null,
            color: item.color || null,
            quantity: -quantity, // Start with negative quantity
            unit: product.unit || 'piece',
            cost_price: product.cost_price || 0,
            selling_price: product.selling_price || unitPrice,
            mrp: product.mrp || item.mrp || 0,
            inward_quantity: 0,
            return_quantity: 0,
            billing_quantity: quantity,
            customer_billing_quantity: 0,
            barcode: item.barcode || null,
            sku: null,
            created_by: data.created_by,
            created_by_name: data.created_by_name
          }, { transaction: t });
        } else {
          // Stock exists - update it (allow negative values)
          stock.quantity -= quantity;
          stock.billing_quantity += quantity;
          await stock.save({ transaction: t });
        }
      }

      // 5️⃣ Handle Coupon if provided
      let couponDiscount = 0;
      let appliedCoupon = null;

      if (data.coupon_code && data.customer_phone) {
        // Validate coupon
        const validation = await couponService.validateCoupon(
          data.coupon_code,
          data.customer_phone,
          subtotal,
          { transaction: t }
        );

        if (!validation.valid) {
          throw new Error(validation.message);
        }

        couponDiscount = validation.discount_amount;
        appliedCoupon = validation.coupon;
      }

      // 6️⃣ Calculate Final Amount
      console.log('[BILLING CREATE] discount_amount from payload:', data.discount_amount);
      console.log('[BILLING CREATE] coupon_discount:', data.coupon_discount);
      console.log('[BILLING CREATE] subtotal:', subtotal);
      const discountAmount = (data.discount_amount || 0) + couponDiscount;
      console.log('[BILLING CREATE] final discountAmount:', discountAmount);
      const taxAmount = data.tax_amount || 0;
      const totalAmount = subtotal - discountAmount + taxAmount;
      const paidAmount = data.paid_amount || 0;
      const dueAmount = totalAmount - paidAmount;

      // 7️⃣ Create Billing (without customer_id, using customer_phone)
      const billing = await Billing.create(
        {
          billing_no: billingNo,
          branch_id: data.branch_id,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          type: data.type,
          billing_date: data.billing_date || new Date(),
          inward_id: data.inward_id || null,
          total_quantity: totalQuantity,
          subtotal_amount: subtotal,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          due_amount: dueAmount,
          payment_method: data.payment_method,
          payment_details: data.payment_details || null,
          status: data.status,
          kot_status: hasKOTItems ? 'pending' : null,
          kot_created_at: hasKOTItems ? new Date() : null,
          counter_no: data.counter_no || null,
          notes: data.notes || null,
          source: data.source || null,
          created_by: data.created_by,
          created_by_name: data.created_by_name,
          created_by_email: data.created_by_email,
        },
        { transaction: t }
      );

      // 7.5️⃣ Update Table Status if table_id is present
      if (data.table_id) {
         await Table.update(
            { status: data.status === 'paid' ? 'available' : 'occupied' },
            { where: { id: data.table_id }, transaction: t }
         );
      }

      // 8️⃣ Create Billing Items
      const itemsWithBillingId = itemsToCreate.map((item) => ({
        ...item,
        billing_id: billing.id,
      }));
      const createdItems = await BillingItem.bulkCreate(itemsWithBillingId, { transaction: t });

      // 8.5️⃣ Split Orders into independent KOTs per Kitchen
      if (hasKOTItems) {
        const kotGroups = {}; // grouped by kitchen_name for simplicity

        for (let i = 0; i < itemsToCreate.length; i++) {
          const itemReq = itemsToCreate[i];
          const createdItem = createdItems.find(ci => ci.id === itemReq.id) || itemsWithBillingId[i];

          if (itemReq.needsKOT) {
             const key = itemReq.kitchen_name || 'Main Kitchen';
             if (!kotGroups[key]) {
                 kotGroups[key] = {
                     kitchen_id: itemReq.kitchen_id || null,
                     kitchen_name: key,
                     items: []
                 };
             }
             kotGroups[key].items.push(createdItem);
          }
        }

        let kotIndex = 1;
        for (const [kName, group] of Object.entries(kotGroups)) {
           // Get or ensure Main Kitchen fallback exists
           let kId = group.kitchen_id;
           if (!kId) {
               const fallback = await Kitchen.findOne({ where: { branch_id: data.branch_id, kitchen_name: 'Main Kitchen' }, transaction: t });
               if (fallback) kId = fallback.id;
           }
           
           const kotNum = billingNo ? `${billingNo.split('-').pop()}-K${kotIndex}` : `KOT-${Date.now().toString().slice(-4)}`;
           const kot = await BillingKOT.create({
               billing_id: billing.id,
               kitchen_id: kId,
               kitchen_name: kName,
               kot_number: kotNum,
               status: 'pending',
               branch_id: data.branch_id,
               createdAt: new Date()
           }, { transaction: t });

           const kotItemsPayload = group.items.map(bItem => ({
               id: uuidv4(),
               kot_id: kot.id,
               billing_item_id: bItem.id,
               status: 'pending'
           }));
           
           await BillingKOTItem.bulkCreate(kotItemsPayload, { transaction: t });
           kotIndex++;
        }
      }

      // 9️⃣ Apply coupon if used (mark as used and award points)
      if (appliedCoupon && data.customer_phone) {
        await couponService.applyCoupon(
          data.coupon_code,
          data.customer_phone,
          billing.id,
          couponDiscount,
          { transaction: t }
        );
      }

      // 🔟 Check if customer qualifies for new coupon (purchase >= 2000)
      let generatedCoupon = null;
      if (data.customer_phone && totalAmount >= 2000) {
        generatedCoupon = await couponService.checkAndGenerateCoupon(
          totalAmount,
          data.customer_phone,
          billing.id,
          { transaction: t }
        );
      }

      // 1️⃣1️⃣ Return Billing with Items, Customer, and Coupon info
      const result = await Billing.findByPk(billing.id, {
        include: [
          { model: BillingItem, as: "items" },
          { model: Customer, as: "customer" }
        ],
        transaction: t,
      });

      // Add coupon info to result
      return {
        ...result.toJSON(),
        coupon_applied: appliedCoupon ? {
          code: appliedCoupon.coupon_code,
          discount: couponDiscount,
          referrer_rewarded: true
        } : null,
        coupon_generated: generatedCoupon ? {
          code: generatedCoupon.coupon_code,
          valid_from: generatedCoupon.valid_from,
          valid_until: generatedCoupon.valid_until,
          discount: `${generatedCoupon.discount_value}% off`,
          message: 'Share this code with friends! Valid after 24 hours.'
        } : null
      };
    });
  },

  // ✅ Get All Billings with Filters + Pagination
  async getAllBillings({ filters = {}, limit = 10, offset = 0 } = {}) {
    const where = {};

    // Filter by branch_id or branch_ids
    if (filters.branch_id) {
      where.branch_id = filters.branch_id;
    } else if (filters.branch_ids && filters.branch_ids.length > 0) {
      where.branch_id = { [Op.in]: filters.branch_ids };
    }

    // Generic search across multiple fields
    if (filters.search) {
      where[Op.or] = [
        { billing_no: { [Op.like]: `%${filters.search}%` } },
        { customer_name: { [Op.like]: `%${filters.search}%` } },
        { customer_phone: { [Op.like]: `%${filters.search}%` } },
      ];
    }

    // Specific field filters (override search if provided)
    if (filters.billing_no) {
      where.billing_no = { [Op.like]: `%${filters.billing_no}%` };
    }
    if (filters.customer_name) {
      where.customer_name = { [Op.like]: `%${filters.customer_name}%` };
    }
    if (filters.customer_phone) {
      where.customer_phone = { [Op.like]: `%${filters.customer_phone}%` };
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.payment_method) {
      where.payment_method = filters.payment_method;
    }

    if (filters.period || (filters.startDate && filters.endDate)) {
      const now = new Date();
      let s, e;
      const period = filters.period;

      if (period === 'today') {
        s = new Date(now); s.setHours(0,0,0,0);
        e = new Date(now); e.setHours(23,59,59,999);
      } else if (period === 'yesterday') {
        const y = new Date(now); y.setDate(y.getDate() - 1);
        s = new Date(y); s.setHours(0,0,0,0);
        e = new Date(y); e.setHours(23,59,59,999);
      } else if (period === 'this_month') {
        s = new Date(now.getFullYear(), now.getMonth(), 1);
        e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      } else if (period === 'this_year') {
        s = new Date(now.getFullYear(), 0, 1);
        e = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      } else if (period === 'custom' && filters.startDate && filters.endDate) {
        s = new Date(filters.startDate); s.setHours(0,0,0,0);
        e = new Date(filters.endDate); e.setHours(23,59,59,999);
      } else if (period === 'all') {
         s = null;
         e = null;
      } else if (filters.startDate && filters.endDate) {
        s = new Date(filters.startDate); s.setHours(0,0,0,0);
        e = new Date(filters.endDate); e.setHours(23,59,59,999);
      }

      if (s && e) {
        where.billing_date = { [Op.between]: [s, e] };
      }
    } else if (filters.billing_date) {
      where.billing_date = filters.billing_date;
    }

    const { count, rows } = await Billing.findAndCountAll({
      where,
      distinct: true,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: BillingItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "product_name", "product_code", "unit", "tax_percentage", "image_url", "selling_price"],
            },
          ],
        },
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "customer_name", "customer_phone", "customer_email"]
        },
        {
          model: Branch,
          as: "branch",
          attributes: ["id", "branch_name", "branch_code", "city"],
        },
      ],
    });

    return {
      total: count,
      page: Math.floor(offset / limit) + 1,
      limit,
      data: rows,
    };
  },

  // ✅ Get Billing by ID
  async getBillingById(id) {
    return await Billing.findByPk(id, {
      include: [
        {
          model: BillingItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "product_name", "product_code", "unit", "tax_percentage", "image_url", "selling_price"],
            },
          ],
        },
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "customer_name", "customer_phone", "customer_email", "address", "city"]
        },
        {
          model: Branch,
          as: "branch",
          attributes: ["id", "branch_name", "branch_code", "address", "city", "state", "phone"]
        }
      ],
    });
  },

  // ✅ Update Billing with Items
  async updateBillingWithItems(id, data) {
    return await sequelize.transaction(async (t) => {
      const billing = await Billing.findByPk(id, {
        include: [{ model: BillingItem, as: "items" }],
        transaction: t
      });

      if (!billing) return null;

      console.log("=== UPDATE BILLING WITH ITEMS START ===");
      console.log("Billing ID:", id);

      // 1. Update Billing header (never update customer_phone — FK constraint)
      await billing.update(
        {
          customer_name:  data.customer_name  || billing.customer_name,
          billing_date:   data.billing_date   || billing.billing_date,
          payment_method: data.payment_method || billing.payment_method,
          payment_details: data.payment_method === 'split'
            ? (data.payment_details || billing.payment_details)
            : null,
          source:  data.source  !== undefined ? data.source  : billing.source,
          counter_no: data.counter_no || billing.counter_no,
          status:  data.status  || billing.status,
          paid_amount: (data.status === 'paid' || (!data.status && billing.status === 'paid'))
            ? billing.total_amount
            : (data.paid_amount !== undefined ? data.paid_amount : billing.paid_amount),
          due_amount: (data.status === 'paid' || (!data.status && billing.status === 'paid'))
            ? 0
            : (data.due_amount !== undefined ? data.due_amount : billing.due_amount),
          notes:          data.notes !== undefined ? data.notes : billing.notes,
          updated_by:       data.updated_by,
          updated_by_name:  data.updated_by_name,
          updated_by_email: data.updated_by_email,
        },
        { transaction: t }
      );

      // 2. If items exist → adjust stock and replace items
      if (data.billing_items && data.billing_items.length > 0) {
        // Step A: Reverse old stock changes
        console.log("=== REVERSING OLD STOCK CHANGES ===");
        for (const oldItem of billing.items) {
          const stock = await Stock.findOne({
            where: {
              product_id: oldItem.product_id,
              branch_id: billing.branch_id
            },
            transaction: t,
          });

          if (stock) {
            // Add back the old quantities to stock
            stock.quantity += oldItem.quantity;
            stock.billing_quantity -= oldItem.quantity;

            console.log(`Product ${oldItem.product_id}: Added back ${oldItem.quantity} units`);
            await stock.save({ transaction: t });
          }
        }

        // Step B: Delete old items
        await BillingItem.destroy({
          where: { billing_id: id },
          transaction: t,
        });

        // Step C: Apply new stock changes and create new items
        console.log("=== APPLYING NEW STOCK CHANGES ===");
        let subtotal = 0;
        let totalQuantity = 0;
        let totalDiscount = 0;
        let totalTax = 0;
        const itemsToCreate = [];

        for (const item of data.billing_items) {
          // Validate product exists
          const product = await Product.findByPk(item.product_id, { transaction: t });
          if (!product) {
            throw new Error(`Product with ID ${item.product_id} does not exist`);
          }

          const quantity = item.quantity || 0;
          const unitPrice = item.unit_price || 0;
          const discount = item.discount_amount || 0;
          const tax = item.tax_amount || 0;
          const totalPrice = item.total_price || (quantity * unitPrice + tax - discount);

          subtotal += quantity * unitPrice;
          totalQuantity += quantity;
          totalDiscount += discount;
          totalTax += tax;

          itemsToCreate.push({
            billing_id: id,
            product_id: item.product_id,
            quantity,
            unit_price: unitPrice,
            unit: item.unit || product.unit,
            mrp: item.mrp || product.mrp,
            discount_percentage: item.discount_percentage || 0,
            discount: discount,
            tax: tax,
            total_price: totalPrice,
            size: item.size || null,
            color: item.color || null,
            barcode: item.barcode || null,
          });

          // Update stock with new quantities - Allow negative stock
          let stock = await Stock.findOne({
            where: {
              product_id: item.product_id,
              branch_id: billing.branch_id,
              ...(item.size && { size: item.size }),
              ...(item.color && { color: item.color })
            },
            transaction: t,
          });

          // If stock doesn't exist, create it with negative quantity
          if (!stock) {
            stock = await Stock.create({
              product_id: item.product_id,
              branch_id: billing.branch_id,
              size: item.size || null,
              color: item.color || null,
              quantity: -quantity, // Start with negative quantity
              unit: product.unit || 'piece',
              cost_price: product.cost_price || 0,
              selling_price: product.selling_price || unitPrice,
              mrp: product.mrp || item.mrp || 0,
              inward_quantity: 0,
              return_quantity: 0,
              billing_quantity: quantity,
              customer_billing_quantity: 0,
              barcode: item.barcode || null,
              sku: null,
              created_by: data.updated_by,
              created_by_name: data.updated_by_name
            }, { transaction: t });
          } else {
            // Stock exists - update it (allow negative values)
            stock.quantity -= quantity;
            stock.billing_quantity += quantity;
            await stock.save({ transaction: t });
          }

          console.log(`Product ${item.product_id}: Removed ${quantity} units (Current stock: ${stock.quantity})`);
        }

        // Step D: Create new items
        await BillingItem.bulkCreate(itemsToCreate, { transaction: t });

        // Step E: Update billing totals — always sync paid_amount to total for paid bills
        // totalDiscount = per-item discounts; bill-level discount comes from data.discount_amount
        const itemDiscounts = totalDiscount; // sum of per-item discount_amount
        const billLevelDiscount = Math.max(0, (data.discount_amount || 0) - itemDiscounts);
        const finalDiscountAmount = itemDiscounts + billLevelDiscount; // = data.discount_amount (bill-level already includes items)
        const totalAmount = subtotal - (data.discount_amount || 0) + totalTax - (data.coupon_discount || 0);
        const isBillPaid  = (data.status || billing.status) === 'paid';
        const paidAmount  = isBillPaid ? totalAmount : (data.paid_amount || totalAmount);
        const dueAmount   = Math.max(0, totalAmount - paidAmount);

        // Update Table status if provided or already linked
        const targetTableId = data.table_id || billing.table_id;
        if (targetTableId) {
           await Table.update(
             { status: isBillPaid ? 'available' : 'occupied' },
             { where: { id: targetTableId }, transaction: t }
           );
        }

        await billing.update(
          {
            total_quantity: totalQuantity,
            subtotal_amount: subtotal,
            discount_amount: data.discount_amount || 0,
            tax_amount: totalTax,
            total_amount: totalAmount,
            paid_amount: paidAmount,
            due_amount: dueAmount,
          },
          { transaction: t }
        );
      }

      console.log("=== UPDATE BILLING WITH ITEMS COMPLETE ===");

      // Return updated billing with items
      return await Billing.findByPk(id, {
        include: [
          {
            model: BillingItem,
            as: "items",
            include: [
              {
                model: Product,
                as: "product",
                attributes: ["id", "product_name", "product_code"],
              },
            ],
          },
          {
            model: Customer,
            as: "customer",
            attributes: ["id", "customer_name", "customer_phone", "customer_email"]
          }
        ],
        transaction: t,
      });
    });
  },


  // ✅ Delete Billing (soft delete)
  async deleteBilling(id, user) {
    return await sequelize.transaction(async (t) => {
      const billing = await Billing.findByPk(id, { transaction: t });
      if (!billing) return null;

      await billing.update(
        {
          is_active: false,
          deleted_by: user.id || null,
          deleted_by_name: user.username || user.name || null,
          deleted_by_email: user.email || null,
        },
        { transaction: t }
      );

      return { message: "Billing soft deleted successfully" };
    });
  },

  // ✅ Get active kitchen queue & live table orders
  async getKitchenQueue(branchId, query = {}) {
    const onlyKitchen = query.only_kitchen === 'true' || query.only_kitchen === true;

    if (onlyKitchen) {
      // For KDS: Fetch from BillingKOT
      const kots = await BillingKOT.findAll({
        where: {
          branch_id: branchId,
          status: { [Op.in]: ['pending', 'preparing', 'ready'] }
        },
        include: [
          {
            model: Billing,
            as: "billing",
            attributes: ['billing_no', 'counter_no', 'notes', 'customer_name', 'customer_phone', 'status', 'payment_method'],
            where: { status: { [Op.notIn]: ['paid', 'cancelled'] } }
          },
          {
            model: BillingKOTItem,
            as: "kotItems",
            include: [{
              model: BillingItem,
              as: "billingItem",
              include: [{
                model: Product,
                as: "product",
                attributes: ['id', 'product_name', 'product_code', 'image_url', 'selling_price', 'tax_percentage', 'unit']
              }]
            }]
          }
        ],
        order: [['createdAt', 'ASC']]
      });

      return kots.map(kot => {
        const bill = kot.billing;
        const formattedItems = kot.kotItems.map(kItem => {
          const item = kItem.billingItem;
          const unitPrice = parseFloat(item.unit_price || item.product?.selling_price || 0);
          const taxRate = parseFloat(item.tax || item.product?.tax_percentage || 0);
          return {
            id: kItem.id, // return KOT item ID or Billing item ID? Frontend probably expects billing_item_id or just an id
            billing_item_id: item.id,
            product_id: item.product_id || item.product?.id,
            product_name: item.product?.product_name || 'Unknown Item',
            image_url: item.product?.image_url || null,
            quantity: item.quantity,
            qty: item.quantity,
            unit_price: unitPrice,
            price: unitPrice,
            tax: parseFloat(item.tax || 0),
            tax_percentage: taxRate,
            tax_rate: taxRate,
            total_price: parseFloat(item.total_price || (unitPrice * item.quantity)),
            size: item.size,
            color: item.color,
            barcode: item.barcode || item.product?.product_code,
            product: item.product ? {
              id: item.product.id,
              product_name: item.product.product_name,
              product_code: item.product.product_code,
              image_url: item.product.image_url,
              selling_price: parseFloat(item.product.selling_price || 0),
              tax_percentage: parseFloat(item.product.tax_percentage || 0),
              unit: item.product.unit
            } : null
          };
        });

        return {
          id: kot.id, // frontend uses this for updating status
          billing_id: bill.id,
          billing_no: bill.billing_no,
          kitchen_name: kot.kitchen_name,
          kot_number: kot.kot_number,
          table_no: bill.counter_no ? bill.counter_no.replace('Counter ', 'Table ') : 'Walk-in',
          counter_no: bill.counter_no,
          customer_name: bill.customer_name || '',
          customer_phone: bill.customer_phone || '',
          payment_method: bill.payment_method,
          status: bill.status,
          kot_status: kot.status,
          kot_created_at: kot.createdAt,
          kot_preparing_at: kot.preparing_at,
          kot_ready_at: kot.ready_at,
          kot_served_at: kot.served_at,
          notes: bill.notes,
          items: formattedItems
        };
      });
    } else {
      // For POS Table Management: Fetch from Billing (original logic)
      const rows = await Billing.findAll({
        where: {
          branch_id: branchId,
          status: { [Op.notIn]: ['paid', 'cancelled'] },
          counter_no: { [Op.ne]: null }
        },
        attributes: [
          'id', 'billing_no', 'counter_no', 'notes',
          'customer_name', 'customer_phone', 'subtotal_amount',
          'tax_amount', 'discount_amount', 'total_amount', 'payment_method', 'status', 'createdAt'
        ],
        include: [
          {
            model: BillingKOT,
            as: "kots"
          },
          {
            model: BillingItem,
            as: "items",
            include: [{
                model: Product,
                as: "product",
                attributes: ['id', 'product_name', 'product_code', 'image_url', 'selling_price', 'tax_percentage', 'unit']
            }]
          }
        ],
        order: [['createdAt', 'ASC']]
      });

      return rows.map(bill => {
        // Aggregate KOT statuses for the bill
        let overallKotStatus = null;
        if (bill.kots && bill.kots.length > 0) {
           const statuses = bill.kots.map(k => k.status);
           if (statuses.every(s => s === 'served')) overallKotStatus = 'served';
           else if (statuses.every(s => s === 'ready' || s === 'served')) overallKotStatus = 'ready';
           else if (statuses.includes('preparing')) overallKotStatus = 'preparing';
           else overallKotStatus = 'pending';
        }

        const formattedItems = bill.items.map(item => {
          const unitPrice = parseFloat(item.unit_price || item.product?.selling_price || 0);
          const taxRate = parseFloat(item.tax || item.product?.tax_percentage || 0);
          return {
            id: item.id,
            product_id: item.product_id || item.product?.id,
            product_name: item.product?.product_name || 'Unknown Item',
            image_url: item.product?.image_url || null,
            quantity: item.quantity,
            qty: item.quantity,
            unit_price: unitPrice,
            price: unitPrice,
            tax: parseFloat(item.tax || 0),
            tax_percentage: taxRate,
            tax_rate: taxRate,
            total_price: parseFloat(item.total_price || (unitPrice * item.quantity)),
            size: item.size,
            color: item.color,
            barcode: item.barcode || item.product?.product_code,
          };
        });

        return {
          id: bill.id,
          billing_no: bill.billing_no,
          table_no: bill.counter_no ? bill.counter_no.replace('Counter ', 'Table ') : 'Walk-in',
          counter_no: bill.counter_no,
          customer_name: bill.customer_name || '',
          customer_phone: bill.customer_phone || '',
          subtotal_amount: parseFloat(bill.subtotal_amount || 0),
          tax_amount: parseFloat(bill.tax_amount || 0),
          discount_amount: parseFloat(bill.discount_amount || 0),
          total_amount: parseFloat(bill.total_amount || 0),
          payment_method: bill.payment_method,
          status: bill.status,
          kot_status: overallKotStatus,
          notes: bill.notes,
          items: formattedItems
        };
      });
    }
  },

  // ✅ Update KOT Status (atomic, concurrency check, idempotency)
  async updateKOTStatus({ id, newStatus, userId, branchId, cancelReason = null }) {
    // 1. Fetch current status from BillingKOT
    const kot = await BillingKOT.findOne({
      where: { id, branch_id: branchId }
    });

    if (!kot) {
      throw new Error("KOT not found");
    }

    const currentStatus = kot.status;

    // 2. Idempotency Check
    if (currentStatus === newStatus) {
      return {
        statusCode: 200,
        success: true,
        message: `KOT status is already ${newStatus}`,
        data: kot
      };
    }

    // 3. State Machine Transitions Validation
    const validTransitions = {
      'pending': ['preparing', 'cancelled'],
      'preparing': ['ready', 'cancelled'],
      'ready': ['served']
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      const err = new Error(`Invalid state transition from "${currentStatus}" to "${newStatus}"`);
      err.name = 'TransitionError';
      throw err;
    }

    // 4. Prepare update fields
    const updatePayload = { status: newStatus };
    const now = new Date();

    if (newStatus === 'preparing') {
      updatePayload.preparing_at = now;
      updatePayload.preparing_by = userId;
    } else if (newStatus === 'ready') {
      updatePayload.ready_at = now;
      updatePayload.ready_by = userId;
    } else if (newStatus === 'served') {
      updatePayload.served_at = now;
      updatePayload.served_by = userId;
    } else if (newStatus === 'cancelled') {
      updatePayload.cancelled_at = now;
      updatePayload.cancelled_by = userId;
      updatePayload.cancel_reason = cancelReason;
    }

    // 5. Atomic Update
    const [affectedRows] = await BillingKOT.update(updatePayload, {
      where: {
        id,
        branch_id: branchId,
        status: currentStatus // Enforce previous status match
      }
    });

    // 6. Concurrency Check
    if (affectedRows === 1) {
      // Also update kotItems status
      await BillingKOTItem.update({ status: newStatus }, { where: { kot_id: id } });

      const updatedKOT = await BillingKOT.findOne({ where: { id, branch_id: branchId } });
      return {
        statusCode: 200,
        success: true,
        message: "KOT status updated successfully",
        data: updatedKOT
      };
    } else {
      // Re-fetch to see if concurrent request succeeded to the requested state
      const reFetched = await BillingKOT.findOne({ where: { id, branch_id: branchId } });
      if (reFetched && reFetched.status === newStatus) {
        return {
          statusCode: 200,
          success: true,
          message: `KOT status is already ${newStatus} (concurrently updated)`,
          data: reFetched
        };
      } else {
        const err = new Error("KOT status has been concurrently modified by another user.");
        err.name = 'ConflictError';
        throw err;
      }
    }
  },
};

export default billingService;
