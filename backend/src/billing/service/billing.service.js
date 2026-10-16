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
        throw new Error("Cannot create KOT or billing without items. At least 1 item is required.");
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
          addons: item.addons || null,
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
           if (!group.items || group.items.length === 0) continue;
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
               quantity: bItem.quantity || 1,
               served_quantity: 0,
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
    if (filters.created_by) {
      let kotBillIds = [];
      try {
        const matchingKots = await BillingKOT.findAll({
          where: { served_by: filters.created_by },
          attributes: ['billing_id'],
          raw: true,
        });
        kotBillIds = matchingKots.map(k => k.billing_id).filter(Boolean);
      } catch (err) {
        console.warn("Could not query BillingKOT by served_by:", err.message);
      }

      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          [Op.or]: [
            { created_by: filters.created_by },
            { kot_served_by: filters.created_by },
            ...(kotBillIds.length > 0 ? [{ id: { [Op.in]: kotBillIds } }] : [])
          ]
        }
      ];
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
        include: [
          { model: BillingItem, as: "items" },
          {
            model: BillingKOT,
            as: "kots",
            include: [{ model: BillingKOTItem, as: "kotItems" }]
          }
        ],
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

      // 2. Intelligent Reconciliation of items, stock, and KOT tickets
      if (data.billing_items !== undefined) {
        if (!Array.isArray(data.billing_items) || data.billing_items.length === 0) {
          throw new Error("Cannot update KOT or order with 0 items. At least 1 item is required.");
        }
      }
      if (data.billing_items && data.billing_items.length > 0) {
        console.log("=== RECONCILING BILLING ITEMS & KOT TICKETS ===");
        
        const existingItems = billing.items || [];
        const matchedExistingIds = new Set();
        const itemsToUpdate = [];
        const itemsToCreate = [];
        const newItemsForKOT = [];

        // Match incoming items to existing items
        for (const incItem of data.billing_items) {
          const match = existingItems.find(e => 
            !matchedExistingIds.has(e.id) &&
            ((incItem.id && incItem.id === e.id) ||
             (incItem.billing_item_id && incItem.billing_item_id === e.id) ||
             (e.product_id === incItem.product_id && (e.size || null) === (incItem.size || null) && (e.color || null) === (incItem.color || null)))
          );

          if (match) {
            matchedExistingIds.add(match.id);
            itemsToUpdate.push({ existingItem: match, incomingItem: incItem });
          } else {
            itemsToCreate.push(incItem);
          }
        }

        const itemsToDelete = existingItems.filter(e => !matchedExistingIds.has(e.id));

        // Step A: Handle deleted items (customer removed from order)
        for (const oldItem of itemsToDelete) {
          // Revert stock
          let stock = await Stock.findOne({
            where: {
              product_id: oldItem.product_id,
              branch_id: billing.branch_id,
              ...(oldItem.size && { size: oldItem.size }),
              ...(oldItem.color && { color: oldItem.color })
            },
            transaction: t,
          });
          if (stock) {
            stock.quantity += oldItem.quantity;
            stock.billing_quantity -= oldItem.quantity;
            await stock.save({ transaction: t });
          }

          // Cancel or remove associated KOT item
          const kotItem = await BillingKOTItem.findOne({
            where: { billing_item_id: oldItem.id },
            transaction: t
          });
          if (kotItem) {
            if (kotItem.status === 'pending' || kotItem.status === 'preparing') {
              await kotItem.update({ status: 'cancelled' }, { transaction: t });
            }
          }

          await oldItem.destroy({ transaction: t });
        }

        // Step B: Handle updated items (quantity or price changes)
        let subtotal = 0;
        let totalQuantity = 0;
        let totalDiscount = 0;
        let totalTax = 0;

        for (const { existingItem, incomingItem } of itemsToUpdate) {
          const oldQty = existingItem.quantity || 0;
          const newQty = incomingItem.quantity || 0;
          const qtyDelta = newQty - oldQty;

          // Adjust stock for delta
          if (qtyDelta !== 0) {
            let stock = await Stock.findOne({
              where: {
                product_id: incomingItem.product_id,
                branch_id: billing.branch_id,
                ...(incomingItem.size && { size: incomingItem.size }),
                ...(incomingItem.color && { color: incomingItem.color })
              },
              transaction: t,
            });
            if (stock) {
              stock.quantity -= qtyDelta;
              stock.billing_quantity += qtyDelta;
              await stock.save({ transaction: t });
            }
          }

          const unitPrice = incomingItem.unit_price || existingItem.unit_price || 0;
          const discount = incomingItem.discount_amount || 0;
          const tax = incomingItem.tax_amount || 0;
          const totalPrice = incomingItem.total_price || (newQty * unitPrice + tax - discount);

          subtotal += newQty * unitPrice;
          totalQuantity += newQty;
          totalDiscount += discount;
          totalTax += tax;

          await existingItem.update({
            quantity: newQty,
            unit_price: unitPrice,
            discount: discount,
            tax: tax,
            total_price: totalPrice,
            addons: incomingItem.addons !== undefined ? incomingItem.addons : existingItem.addons
          }, { transaction: t });

          // Reconcile KOT for this item
          const kotItem = await BillingKOTItem.findOne({
            where: { billing_item_id: existingItem.id },
            include: [{ model: BillingKOT, as: 'kot' }],
            transaction: t
          });

          if (kotItem) {
            if (qtyDelta > 0) {
              // Increased quantity: if pending, update in place; otherwise queue supplementary KOT item
              if (kotItem.kot?.status === 'pending') {
                await kotItem.update({ quantity: newQty }, { transaction: t });
              } else {
                newItemsForKOT.push({
                  billing_item_id: existingItem.id,
                  product_id: incomingItem.product_id,
                  quantity: qtyDelta,
                  kitchen_id: kotItem.kot?.kitchen_id,
                  kitchen_name: kotItem.kot?.kitchen_name || 'Main Kitchen',
                  isAddonDelta: true
                });
              }
            } else if (qtyDelta < 0) {
              const safeQty = Math.max(kotItem.served_quantity || 0, newQty);
              await kotItem.update({ quantity: safeQty }, { transaction: t });
            }
          }
        }

        // Step C: Handle brand new items added to order (running table order)
        for (const newItem of itemsToCreate) {
          const product = await Product.findByPk(newItem.product_id, { transaction: t });
          if (!product) {
            throw new Error(`Product with ID ${newItem.product_id} does not exist`);
          }

          const quantity = newItem.quantity || 0;
          const unitPrice = newItem.unit_price || product.selling_price || 0;
          const discount = newItem.discount_amount || 0;
          const tax = newItem.tax_amount || 0;
          const totalPrice = newItem.total_price || (quantity * unitPrice + tax - discount);

          subtotal += quantity * unitPrice;
          totalQuantity += quantity;
          totalDiscount += discount;
          totalTax += tax;

          // Adjust stock for new item
          let stock = await Stock.findOne({
            where: {
              product_id: newItem.product_id,
              branch_id: billing.branch_id,
              ...(newItem.size && { size: newItem.size }),
              ...(newItem.color && { color: newItem.color })
            },
            transaction: t,
          });

          if (!stock) {
            stock = await Stock.create({
              product_id: newItem.product_id,
              branch_id: billing.branch_id,
              size: newItem.size || null,
              color: newItem.color || null,
              quantity: -quantity,
              unit: product.unit || 'piece',
              cost_price: product.cost_price || 0,
              selling_price: product.selling_price || unitPrice,
              mrp: product.mrp || newItem.mrp || 0,
              inward_quantity: 0,
              return_quantity: 0,
              billing_quantity: quantity,
              customer_billing_quantity: 0,
              barcode: newItem.barcode || null,
              created_by: data.updated_by,
              created_by_name: data.updated_by_name
            }, { transaction: t });
          } else {
            stock.quantity -= quantity;
            stock.billing_quantity += quantity;
            await stock.save({ transaction: t });
          }

          // Create new BillingItem
          const createdBillingItem = await BillingItem.create({
            id: uuidv4(),
            billing_id: id,
            product_id: newItem.product_id,
            quantity,
            unit_price: unitPrice,
            unit: newItem.unit || product.unit,
            mrp: newItem.mrp || product.mrp,
            discount_percentage: newItem.discount_percentage || 0,
            discount: discount,
            tax: tax,
            total_price: totalPrice,
            size: newItem.size || null,
            color: newItem.color || null,
            barcode: newItem.barcode || null,
            addons: newItem.addons || null,
          }, { transaction: t });

          // Determine KOT eligibility
          let productNeedsKOT = false;
          let pKitchenId = product.kitchen_id;
          let pKitchenName = 'Main Kitchen';

          if (pKitchenId) {
            const kitchen = await Kitchen.findByPk(pKitchenId, { transaction: t });
            if (kitchen) {
              pKitchenName = kitchen.kitchen_name;
              productNeedsKOT = true;
            }
          } else if (product.category_id) {
            const category = await Category.findByPk(product.category_id, { transaction: t });
            if (category && category.category_name) {
              const catName = category.category_name.toLowerCase();
              const KOT_CATEGORIES = ['snack', 'beverage', 'rice', 'pizza', 'salad', 'soup', 'bakery', 'tea', 'coffee', 'juice', 'milk', 'drink', 'food', 'fast food', 'kitchen'];
              if (KOT_CATEGORIES.some(cat => catName.includes(cat))) {
                productNeedsKOT = true;
              }
            }
          } else {
            productNeedsKOT = true;
          }

          if (productNeedsKOT) {
            newItemsForKOT.push({
              billing_item_id: createdBillingItem.id,
              product_id: newItem.product_id,
              quantity,
              kitchen_id: pKitchenId,
              kitchen_name: pKitchenName,
              isAddonDelta: false
            });
          }
        }

        // Step D: Dispatch new items or add-ons to Kitchen KOT tickets
        if (newItemsForKOT.length > 0) {
          const kotGroups = {};
          for (const item of newItemsForKOT) {
            const kKey = item.kitchen_name || 'Main Kitchen';
            if (!kotGroups[kKey]) {
              kotGroups[kKey] = {
                kitchen_id: item.kitchen_id,
                items: []
              };
            }
            kotGroups[kKey].items.push(item);
          }

          for (const [kName, group] of Object.entries(kotGroups)) {
            if (!group.items || group.items.length === 0) continue;
            // Check for existing pending KOT for this kitchen
            const existingPendingKot = (billing.kots || []).find(
              k => k.status === 'pending' && (k.kitchen_name === kName || (group.kitchen_id && k.kitchen_id === group.kitchen_id))
            );

            if (existingPendingKot) {
              // Attach to existing pending KOT
              for (const it of group.items) {
                await BillingKOTItem.create({
                  id: uuidv4(),
                  kot_id: existingPendingKot.id,
                  billing_item_id: it.billing_item_id,
                  quantity: it.quantity,
                  served_quantity: 0,
                  status: 'pending'
                }, { transaction: t });
              }
            } else {
              // Create new Supplementary KOT ticket
              const existingKotCount = await BillingKOT.count({
                where: { billing_id: id },
                transaction: t
              });

              let kId = group.kitchen_id;
              if (!kId) {
                const fallback = await Kitchen.findOne({
                  where: { branch_id: billing.branch_id, kitchen_name: 'Main Kitchen' },
                  transaction: t
                });
                if (fallback) kId = fallback.id;
              }

              const kotNum = billing.billing_no
                ? `${billing.billing_no.split('-').pop()}-K${existingKotCount + 1}`
                : `KOT-${Date.now().toString().slice(-4)}`;

              const newKot = await BillingKOT.create({
                billing_id: id,
                kitchen_id: kId,
                kitchen_name: kName,
                kot_number: kotNum,
                status: 'pending',
                branch_id: billing.branch_id,
                createdAt: new Date()
              }, { transaction: t });

              for (const it of group.items) {
                await BillingKOTItem.create({
                  id: uuidv4(),
                  kot_id: newKot.id,
                  billing_item_id: it.billing_item_id,
                  quantity: it.quantity,
                  served_quantity: 0,
                  status: 'pending'
                }, { transaction: t });
              }
            }
          }
        }

        // Step E: Recalculate parent billing totals and KOT status
        const itemDiscounts = totalDiscount;
        const totalAmount = subtotal - (data.discount_amount || 0) + totalTax - (data.coupon_discount || 0);
        const isBillPaid = (data.status || billing.status) === 'paid';
        const paidAmount = isBillPaid ? totalAmount : (data.paid_amount || totalAmount);
        const dueAmount = Math.max(0, totalAmount - paidAmount);

        // Update Table status
        const targetTableId = data.table_id || billing.table_id;
        if (targetTableId) {
          await Table.update(
            { status: isBillPaid ? 'available' : 'occupied' },
            { where: { id: targetTableId }, transaction: t }
          );
        }

        // Recalculate overall KOT status
        const allKots = await BillingKOT.findAll({
          where: { billing_id: id },
          transaction: t
        });

        let overallKotStatus = billing.kot_status || 'pending';
        if (allKots.length > 0) {
          const allCancelled = allKots.every(k => k.status === 'cancelled');
          const allServed = allKots.every(k => k.status === 'served');
          const anyPreparing = allKots.some(k => k.status === 'preparing');
          const anyReady = allKots.some(k => k.status === 'ready' || k.status === 'partially_ready');
          const anyServed = allKots.some(k => k.status === 'served' || k.status === 'partially_served');
          const anyPending = allKots.some(k => k.status === 'pending');

          if (allCancelled) overallKotStatus = 'cancelled';
          else if (allServed) overallKotStatus = 'served';
          else if (anyServed) overallKotStatus = 'partially_served';
          else if (anyReady) overallKotStatus = 'ready';
          else if (anyPreparing) overallKotStatus = 'preparing';
          else if (anyPending) overallKotStatus = 'pending';
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
            kot_status: overallKotStatus,
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

  // ✅ Recalculate status of a BillingKOT and its parent Billing order
  async recalculateKotAndBillingStatus(kotId, userId = null) {
    const kot = await BillingKOT.findByPk(kotId, {
      include: [{ model: BillingKOTItem, as: 'kotItems' }]
    });
    if (!kot) return { kot: null, newKotStatus: null };

    const items = kot.kotItems || [];
    const activeItems = items.filter(it => it.status !== 'cancelled');

    let newKotStatus = 'pending';
    if (activeItems.length > 0) {
      const allServed = activeItems.every(it => (it.served_quantity >= it.quantity) || it.status === 'served');
      const anyServed = activeItems.some(it => (it.served_quantity > 0) || it.status === 'served' || it.status === 'partially_served');
      const allReady = activeItems.every(it => it.status === 'ready' || it.status === 'served');
      const anyReady = activeItems.some(it => it.status === 'ready' || it.status === 'partially_ready');
      const anyPreparing = activeItems.some(it => it.status === 'preparing');

      if (allServed) {
        newKotStatus = 'served';
      } else if (anyServed) {
        newKotStatus = 'partially_served';
      } else if (allReady) {
        newKotStatus = 'ready';
      } else if (anyReady) {
        newKotStatus = 'partially_ready';
      } else if (anyPreparing) {
        newKotStatus = 'preparing';
      } else {
        newKotStatus = 'pending';
      }
    }

    const now = new Date();
    const kotUpdate = { status: newKotStatus };
    if (newKotStatus === 'served' && !kot.served_at) {
      kotUpdate.served_at = now;
      if (userId) kotUpdate.served_by = userId;
    } else if (newKotStatus === 'ready' && !kot.ready_at) {
      kotUpdate.ready_at = now;
      if (userId) kotUpdate.ready_by = userId;
    }
    await kot.update(kotUpdate);

    // Now recalculate parent bill overall kot_status (keeping bill.status / payment status separate!)
    if (kot.billing_id) {
      const allKots = await BillingKOT.findAll({ where: { billing_id: kot.billing_id } });
      const activeKots = allKots.filter(k => k.status !== 'cancelled');

      let overallKotStatus = 'pending';
      if (activeKots.length > 0) {
        if (activeKots.every(k => k.status === 'served')) {
          overallKotStatus = 'served';
        } else if (activeKots.some(k => k.status === 'served' || k.status === 'partially_served')) {
          overallKotStatus = 'partially_served';
        } else if (activeKots.every(k => k.status === 'ready' || k.status === 'served')) {
          overallKotStatus = 'ready';
        } else if (activeKots.some(k => k.status === 'ready' || k.status === 'partially_ready')) {
          overallKotStatus = 'partially_ready';
        } else if (activeKots.some(k => k.status === 'preparing')) {
          overallKotStatus = 'preparing';
        } else {
          overallKotStatus = 'pending';
        }
      }

      const billUpdate = { kot_status: overallKotStatus };
      if (overallKotStatus === 'served') {
        billUpdate.kot_served_at = now;
        if (userId) billUpdate.kot_served_by = userId;
      }
      // Critical requirement: Keep payment and billing status (status) separate!
      await Billing.update(billUpdate, { where: { id: kot.billing_id } });
    }

    return { kot, newKotStatus };
  },

  // ✅ Get active kitchen queue & live table orders
  async getKitchenQueue(branchId, query = {}) {
    const onlyKitchen = query.only_kitchen === 'true' || query.only_kitchen === true;

    if (onlyKitchen) {
      // For KDS: Fetch from BillingKOT
      const kots = await BillingKOT.findAll({
        where: {
          branch_id: branchId,
          status: { [Op.in]: ['pending', 'preparing', 'partially_ready', 'ready', 'partially_served'] }
        },
        include: [
          {
            model: Billing,
            as: "billing",
            attributes: ['id', 'billing_no', 'counter_no', 'notes', 'customer_name', 'customer_phone', 'status', 'payment_method', 'created_by', 'created_by_name'],
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

      return kots
        .filter(kot => kot.kotItems && kot.kotItems.length > 0)
        .map(kot => {
        const bill = kot.billing;
        const formattedItems = kot.kotItems.map(kItem => {
          const item = kItem.billingItem;
          const unitPrice = parseFloat(item.unit_price || item.product?.selling_price || 0);
          const taxRate = parseFloat(item.tax || item.product?.tax_percentage || 0);
          const totalQty = kItem.quantity || item.quantity || 1;
          const servedQty = kItem.served_quantity || 0;

          return {
            id: kItem.id,
            kot_item_id: kItem.id,
            billing_item_id: item.id,
            product_id: item.product_id || item.product?.id,
            product_name: item.product?.product_name || 'Unknown Item',
            image_url: item.product?.image_url || null,
            quantity: totalQty,
            qty: totalQty,
            served_quantity: servedQty,
            status: kItem.status || 'pending',
            is_served: servedQty >= totalQty || kItem.status === 'served',
            kitchen_name: kot.kitchen_name,
            kitchen_id: kot.kitchen_id,
            kot_id: kot.id,
            kot_number: kot.kot_number,
            unit_price: unitPrice,
            price: unitPrice,
            tax: parseFloat(item.tax || 0),
            tax_percentage: taxRate,
            tax_rate: taxRate,
            total_price: parseFloat(item.total_price || (unitPrice * totalQty)),
            size: item.size,
            color: item.color,
            barcode: item.barcode || item.product?.product_code,
            addons: item.addons || [],
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
          id: kot.id,
          billing_id: kot.billing_id || bill?.id,
          billing_no: bill.billing_no,
          kitchen_name: kot.kitchen_name,
          kitchen_id: kot.kitchen_id,
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
          items: formattedItems,
          created_by: bill.created_by,
          created_by_name: bill.created_by_name,
          createdAt: bill.createdAt
        };
      });
    } else {
      // For POS Table Management & Waiter Pickup Queues: Fetch from Billing
      const rows = await Billing.findAll({
        where: {
          branch_id: branchId,
          status: { [Op.notIn]: ['paid', 'cancelled'] },
          counter_no: { [Op.ne]: null }
        },
        attributes: [
          'id', 'billing_no', 'counter_no', 'notes',
          'customer_name', 'customer_phone', 'subtotal_amount',
          'tax_amount', 'discount_amount', 'total_amount', 'payment_method', 'status', 'kot_status', 'created_by', 'created_by_name', 'createdAt'
        ],
        include: [
          {
            model: BillingKOT,
            as: "kots",
            include: [{
              model: BillingKOTItem,
              as: "kotItems"
            }]
          },
          {
            model: BillingItem,
            as: "items",
            include: [
              {
                model: Product,
                as: "product",
                attributes: ['id', 'product_name', 'product_code', 'image_url', 'selling_price', 'tax_percentage', 'unit']
              },
              {
                model: BillingKOTItem,
                as: "kotItem",
                include: [{
                  model: BillingKOT,
                  as: "kot",
                  attributes: ['id', 'kitchen_name', 'kitchen_id', 'kot_number', 'status']
                }]
              }
            ]
          }
        ],
        order: [['createdAt', 'ASC']]
      });

      return rows.map(bill => {
        // Aggregate KOT statuses for the bill
        let overallKotStatus = bill.kot_status;
        if (bill.kots && bill.kots.length > 0) {
          const statuses = bill.kots.map(k => k.status);
          if (statuses.every(s => s === 'served')) overallKotStatus = 'served';
          else if (statuses.some(s => s === 'served' || s === 'partially_served')) overallKotStatus = 'partially_served';
          else if (statuses.every(s => s === 'ready' || s === 'served')) overallKotStatus = 'ready';
          else if (statuses.some(s => s === 'ready' || s === 'partially_ready')) overallKotStatus = 'partially_ready';
          else if (statuses.some(s => s === 'preparing')) overallKotStatus = 'preparing';
          else overallKotStatus = 'pending';
        }

        const formattedItems = bill.items.map(item => {
          const kItem = item.kotItem;
          const kName = kItem?.kot?.kitchen_name || 'Main Kitchen';
          const totalQty = kItem?.quantity || item.quantity || 1;
          const servedQty = kItem?.served_quantity || 0;
          const itemStatus = kItem?.status || 'pending';
          const unitPrice = parseFloat(item.unit_price || item.product?.selling_price || 0);
          const taxRate = parseFloat(item.tax || item.product?.tax_percentage || 0);

          return {
            id: item.id,
            billing_item_id: item.id,
            kot_item_id: kItem?.id || null,
            product_id: item.product_id || item.product?.id,
            product_name: item.product?.product_name || 'Unknown Item',
            image_url: item.product?.image_url || null,
            quantity: totalQty,
            qty: totalQty,
            served_quantity: servedQty,
            status: itemStatus,
            is_served: servedQty >= totalQty || itemStatus === 'served',
            kitchen_name: kName,
            kitchen_id: kItem?.kot?.kitchen_id || null,
            kot_id: kItem?.kot?.id || null,
            kot_number: kItem?.kot?.kot_number || null,
            unit_price: unitPrice,
            price: unitPrice,
            tax: parseFloat(item.tax || 0),
            tax_percentage: taxRate,
            tax_rate: taxRate,
            total_price: parseFloat(item.total_price || (unitPrice * totalQty)),
            size: item.size,
            color: item.color,
            barcode: item.barcode || item.product?.product_code,
            addons: item.addons || [],
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
          kots: bill.kots || [],
          items: formattedItems,
          created_by: bill.created_by,
          created_by_name: bill.created_by_name,
          createdAt: bill.createdAt
        };
      });
    }
  },

  // ✅ Mark an individual KOT item as served with quantity tracking (Waiter/Server)
  async serveKOTItem({ itemId, servedQty = null, userId, branchId }) {
    const kotItem = await BillingKOTItem.findByPk(itemId, {
      include: [
        {
          model: BillingKOT,
          as: 'kot',
          include: [{ model: Billing, as: 'billing' }]
        },
        {
          model: BillingItem,
          as: 'billingItem',
          include: [{ model: Product, as: 'product' }]
        }
      ]
    });

    if (!kotItem) {
      throw new Error("KOT item record not found");
    }

    if (branchId && kotItem.kot?.branch_id !== branchId) {
      throw new Error("Access denied: item belongs to another branch");
    }

    // 1. Preparation status validation: Cannot serve items that are still pending or cooking
    const isReadyForServing =
      kotItem.status === 'ready' ||
      kotItem.status === 'partially_ready' ||
      kotItem.status === 'partially_served' ||
      kotItem.kot?.status === 'ready';

    if (!isReadyForServing) {
      const err = new Error(
        `Cannot mark "${kotItem.billingItem?.product?.product_name || 'Item'}" as served because kitchen has not marked it ready (current status: ${kotItem.status}).`
      );
      err.statusCode = 400;
      throw err;
    }

    const totalQty = kotItem.quantity || kotItem.billingItem?.quantity || 1;
    const currentServed = kotItem.served_quantity || 0;

    // 2. Idempotency: already fully served
    if (currentServed >= totalQty && kotItem.status === 'served') {
      return {
        statusCode: 200,
        success: true,
        message: "Item is already fully served",
        data: {
          item_id: kotItem.id,
          status: 'served',
          served_quantity: totalQty,
          quantity: totalQty,
          kot_id: kotItem.kot_id,
          is_served: true
        }
      };
    }

    let newServed = totalQty;
    if (servedQty !== null && servedQty !== undefined) {
      const inc = parseInt(servedQty, 10);
      if (isNaN(inc) || inc <= 0) {
        throw new Error("served_quantity increment must be a positive integer");
      }
      newServed = Math.min(totalQty, currentServed + inc);
    }

    const newStatus = newServed >= totalQty ? 'served' : 'partially_served';

    // 3. Update the specific item atomically
    await kotItem.update({
      served_quantity: newServed,
      status: newStatus
    });

    // 4. Recalculate parent KOT and overall Billing status
    const { kot, newKotStatus } = await this.recalculateKotAndBillingStatus(kotItem.kot_id, userId);

    return {
      statusCode: 200,
      success: true,
      message: newStatus === 'served'
        ? `${kotItem.billingItem?.product?.product_name || 'Item'} fully served (${newServed}/${totalQty})`
        : `${kotItem.billingItem?.product?.product_name || 'Item'} partially served (${newServed}/${totalQty})`,
      data: {
        item_id: kotItem.id,
        status: newStatus,
        served_quantity: newServed,
        quantity: totalQty,
        is_served: newServed >= totalQty,
        kot_id: kotItem.kot_id,
        kot_status: newKotStatus,
        billing_id: kot?.billing_id,
        table_no: kot?.billing?.counter_no ? kot.billing.counter_no.replace('Counter ', 'Table ') : 'Table',
        kitchen_name: kot?.kitchen_name || 'Main Kitchen',
        product_name: kotItem.billingItem?.product?.product_name || 'Item'
      }
    };
  },

  // ✅ Update individual KOT item status (Kitchen preparation)
  async updateKOTItemStatus({ itemId, newStatus, userId, branchId }) {
    const kotItem = await BillingKOTItem.findByPk(itemId, {
      include: [
        {
          model: BillingKOT,
          as: 'kot',
          include: [{ model: Billing, as: 'billing' }]
        },
        {
          model: BillingItem,
          as: 'billingItem',
          include: [{ model: Product, as: 'product' }]
        }
      ]
    });

    if (!kotItem) {
      throw new Error("KOT item not found");
    }

    if (branchId && kotItem.kot?.branch_id !== branchId) {
      throw new Error("Access denied: item belongs to another branch");
    }

    const currentStatus = kotItem.status;
    if (currentStatus === newStatus) {
      return {
        statusCode: 200,
        success: true,
        message: `Item status is already ${newStatus}`,
        data: kotItem
      };
    }

    const totalQty = kotItem.quantity || kotItem.billingItem?.quantity || 1;
    const updatePayload = { status: newStatus };
    if (newStatus === 'served') {
      updatePayload.served_quantity = totalQty;
    }

    await kotItem.update(updatePayload);

    // Recalculate parent KOT and overall Billing status
    const { kot, newKotStatus } = await this.recalculateKotAndBillingStatus(kotItem.kot_id, userId);

    return {
      statusCode: 200,
      success: true,
      message: `Item status updated to ${newStatus}`,
      data: {
        item_id: kotItem.id,
        status: newStatus,
        served_quantity: updatePayload.served_quantity ?? kotItem.served_quantity,
        quantity: totalQty,
        is_served: (updatePayload.served_quantity ?? kotItem.served_quantity) >= totalQty,
        kot_id: kotItem.kot_id,
        kot_status: newKotStatus,
        billing_id: kot?.billing_id,
        table_no: kot?.billing?.counter_no ? kot.billing.counter_no.replace('Counter ', 'Table ') : 'Table',
        kitchen_name: kot?.kitchen_name || 'Main Kitchen',
        product_name: kotItem.billingItem?.product?.product_name || 'Item'
      }
    };
  },

  // ✅ Update KOT Status (atomic, concurrency check, idempotency)
  async updateKOTStatus({ id, newStatus, userId, branchId, cancelReason = null }) {
    // 1. Fetch current status from BillingKOT
    let kot = await BillingKOT.findOne({
      where: { id, branch_id: branchId }
    });

    // 1b. If not found in BillingKOT, check if `id` is a parent Billing order ID (e.g. from POS / Waiter interface)
    if (!kot) {
      const bill = await Billing.findOne({
        where: { id, branch_id: branchId }
      });

      if (bill) {
        // Find all KOTs belonging to this billing order
        const relatedKots = await BillingKOT.findAll({
          where: { billing_id: id, branch_id: branchId }
        });

        const now = new Date();

        if (relatedKots.length === 0) {
          await bill.update({ kot_status: newStatus });
          return {
            statusCode: 200,
            success: true,
            message: `Order status updated to ${newStatus}`,
            data: bill
          };
        }

        // For each related KOT, update its status and all its items
        for (const rKot of relatedKots) {
          const updatePayload = { status: newStatus };
          if (newStatus === 'preparing') {
            updatePayload.preparing_at = now;
            updatePayload.preparing_by = userId;
          } else if (newStatus === 'ready' || newStatus === 'partially_ready') {
            updatePayload.ready_at = now;
            updatePayload.ready_by = userId;
          } else if (newStatus === 'served' || newStatus === 'partially_served') {
            updatePayload.served_at = now;
            updatePayload.served_by = userId;
          } else if (newStatus === 'cancelled') {
            updatePayload.cancelled_at = now;
            updatePayload.cancelled_by = userId;
            updatePayload.cancel_reason = cancelReason;
          }
          await rKot.update(updatePayload);

          if (newStatus === 'served') {
            const kotItems = await BillingKOTItem.findAll({ where: { kot_id: rKot.id } });
            for (const it of kotItems) {
              const totalQty = it.quantity || 1;
              await it.update({ status: 'served', served_quantity: totalQty });
            }
          } else {
            await BillingKOTItem.update(
              { status: newStatus },
              {
                where: {
                  kot_id: rKot.id,
                  status: { [Op.notIn]: ['served', 'cancelled'] }
                }
              }
            );
          }

          await this.recalculateKotAndBillingStatus(rKot.id, userId);
        }

        // Ensure bill kot_status reflects newStatus
        const billUpdates = { kot_status: newStatus };
        if (newStatus === 'served') {
          billUpdates.kot_served_at = now;
          if (userId) billUpdates.kot_served_by = userId;
        }
        await bill.update(billUpdates);

        const reloadedBill = await Billing.findOne({
          where: { id, branch_id: branchId },
          include: [{ model: BillingKOT, as: "kots" }]
        });

        return {
          statusCode: 200,
          success: true,
          message: `Entire table order marked as ${newStatus}`,
          data: reloadedBill
        };
      }

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
      'preparing': ['ready', 'partially_ready', 'cancelled'],
      'partially_ready': ['ready', 'served', 'partially_served', 'cancelled'],
      'ready': ['served', 'partially_served', 'cancelled'],
      'partially_served': ['served', 'ready']
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
    } else if (newStatus === 'ready' || newStatus === 'partially_ready') {
      updatePayload.ready_at = now;
      updatePayload.ready_by = userId;
    } else if (newStatus === 'served' || newStatus === 'partially_served') {
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
      // If marking entire KOT as served, mark all items as served
      if (newStatus === 'served') {
        const kotItems = await BillingKOTItem.findAll({ where: { kot_id: id } });
        for (const it of kotItems) {
          await it.update({ status: 'served', served_quantity: it.quantity });
        }
      } else {
        await BillingKOTItem.update(
          { status: newStatus },
          {
            where: {
              kot_id: id,
              status: { [Op.notIn]: ['served', 'cancelled'] }
            }
          }
        );
      }

      await this.recalculateKotAndBillingStatus(id, userId);

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

  // ── Kitchen Operations & Bottlenecks Insights (Live + Past Data) ───────────
  async getKitchenInsights(branch_ids, options = {}) {
    const {
      period = 'today',
      startDate,
      endDate,
      thresholdMinutes = 15
    } = options;

    const threshold = parseInt(thresholdMinutes, 10) || 15;

    // Date range resolution
    const now = new Date();
    let s, e;
    if (period === 'today') {
      s = new Date(now); s.setHours(0, 0, 0, 0);
      e = new Date(now); e.setHours(23, 59, 59, 999);
    } else if (period === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      s = new Date(y); s.setHours(0, 0, 0, 0);
      e = new Date(y); e.setHours(23, 59, 59, 999);
    } else if (period === 'this_week' || period === 'week') {
      const w = new Date(now); w.setDate(w.getDate() - 7);
      s = new Date(w); s.setHours(0, 0, 0, 0);
      e = new Date(now); e.setHours(23, 59, 59, 999);
    } else if (period === 'this_month' || period === 'month') {
      s = new Date(now.getFullYear(), now.getMonth(), 1);
      e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'custom' && startDate && endDate) {
      s = new Date(startDate);
      e = new Date(endDate);
    } else {
      s = new Date(now); s.setHours(0, 0, 0, 0);
      e = new Date(now); e.setHours(23, 59, 59, 999);
    }

    const branchFilter = branch_ids && branch_ids.length > 0
      ? { branch_id: { [Op.in]: branch_ids } }
      : {};

    // 1️⃣ LIVE KITCHEN QUEUE & OVERDUE ORDERS
    const activeKots = await BillingKOT.findAll({
      where: {
        ...branchFilter,
        status: { [Op.in]: ['pending', 'preparing', 'partially_ready', 'ready', 'partially_served'] }
      },
      include: [
        {
          model: Billing,
          as: "billing",
          attributes: ['id', 'billing_no', 'counter_no', 'customer_name', 'customer_phone', 'status'],
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
              attributes: ['id', 'product_name', 'product_code', 'image_url']
            }]
          }]
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    const currentTimeMs = Date.now();
    let liveOverdueCount = 0;
    let livePreparingCount = 0;
    let livePendingCount = 0;
    let maxWaitMinutes = 0;
    const stationLoadMap = {};

    const liveTickets = activeKots.map(kot => {
      const waitMinutes = Math.max(0, Math.round((currentTimeMs - new Date(kot.createdAt).getTime()) / 60000));
      const isOverdue = waitMinutes >= threshold;

      if (isOverdue) liveOverdueCount++;
      if (kot.status === 'preparing') livePreparingCount++;
      if (kot.status === 'pending') livePendingCount++;
      if (waitMinutes > maxWaitMinutes) maxWaitMinutes = waitMinutes;

      const station = kot.kitchen_name || 'Main Kitchen';
      if (!stationLoadMap[station]) {
        stationLoadMap[station] = { station, activeCount: 0, overdueCount: 0, itemsCount: 0 };
      }
      stationLoadMap[station].activeCount++;
      if (isOverdue) stationLoadMap[station].overdueCount++;

      const items = (kot.kotItems || []).map(kItem => {
        const pName = kItem.billingItem?.product?.product_name || 'Item';
        const qty = kItem.quantity || 1;
        stationLoadMap[station].itemsCount += qty;
        return {
          id: kItem.id,
          product_name: pName,
          quantity: qty,
          served_quantity: kItem.served_quantity || 0,
          status: kItem.status
        };
      });

      return {
        id: kot.id,
        kot_number: kot.kot_number,
        billing_no: kot.billing?.billing_no,
        counter_no: kot.billing?.counter_no,
        customer_name: kot.billing?.customer_name,
        kitchen_name: station,
        status: kot.status,
        createdAt: kot.createdAt,
        wait_minutes: waitMinutes,
        is_overdue: isOverdue,
        items
      };
    });

    // Determine Live Stress Level
    let liveStressLevel = 'smooth';
    if (liveOverdueCount > 0 || activeKots.length >= 8) {
      liveStressLevel = 'struggling';
    } else if (activeKots.length >= 4 || maxWaitMinutes >= 10) {
      liveStressLevel = 'busy';
    }

    // 2️⃣ HISTORICAL KITCHEN DATA FOR SELECTED PERIOD
    const historicalKots = await BillingKOT.findAll({
      where: {
        ...branchFilter,
        createdAt: { [Op.between]: [s, e] }
      },
      include: [
        {
          model: BillingKOTItem,
          as: "kotItems",
          include: [{
            model: BillingItem,
            as: "billingItem",
            include: [{
              model: Product,
              as: "product",
              attributes: ['id', 'product_name', 'product_code']
            }]
          }]
        }
      ]
    });

    const totalHistoricalTickets = historicalKots.length;
    let servedTicketsCount = 0;
    let cancelledTicketsCount = 0;
    let totalPrepMinutes = 0;
    let prepCount = 0;
    let totalTurnaroundMinutes = 0;
    let turnaroundCount = 0;
    let historicalDelayedCount = 0;

    const hourlyStats = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      tickets: 0,
      delayed: 0,
      totalWaitMinutes: 0,
      avgWait: 0
    }));

    const historicalStationMap = {};
    const dishStatsMap = {};

    historicalKots.forEach(kot => {
      const isServed = kot.status === 'served' || kot.served_at != null;
      const isCancelled = kot.status === 'cancelled' || kot.cancelled_at != null;

      if (isServed) servedTicketsCount++;
      if (isCancelled) cancelledTicketsCount++;

      const station = kot.kitchen_name || 'Main Kitchen';
      if (!historicalStationMap[station]) {
        historicalStationMap[station] = {
          station,
          total: 0,
          served: 0,
          delayed: 0,
          totalPrepMinutes: 0,
          prepCount: 0
        };
      }
      historicalStationMap[station].total++;
      if (isServed) historicalStationMap[station].served++;

      // Prep Time: from preparing_at (or createdAt) to ready_at (or served_at)
      const startTime = new Date(kot.preparing_at || kot.createdAt).getTime();
      const endTime = kot.ready_at ? new Date(kot.ready_at).getTime() : (kot.served_at ? new Date(kot.served_at).getTime() : null);

      let prepTime = 0;
      if (endTime && endTime > startTime) {
        prepTime = Math.round((endTime - startTime) / 60000);
        totalPrepMinutes += prepTime;
        prepCount++;
        historicalStationMap[station].totalPrepMinutes += prepTime;
        historicalStationMap[station].prepCount++;
      }

      // Total Turnaround Time (Order creation to served)
      let turnaroundTime = 0;
      if (kot.served_at) {
        const createTime = new Date(kot.createdAt).getTime();
        turnaroundTime = Math.max(1, Math.round((new Date(kot.served_at).getTime() - createTime) / 60000));
        totalTurnaroundMinutes += turnaroundTime;
        turnaroundCount++;
      } else if (!isCancelled) {
        turnaroundTime = Math.round((currentTimeMs - new Date(kot.createdAt).getTime()) / 60000);
      }

      // Delayed check
      const wasDelayed = turnaroundTime >= threshold || prepTime >= threshold;
      if (wasDelayed) {
        historicalDelayedCount++;
        historicalStationMap[station].delayed++;
      }

      // Hourly stats
      const kotHour = new Date(kot.createdAt).getHours();
      if (hourlyStats[kotHour]) {
        hourlyStats[kotHour].tickets++;
        if (wasDelayed) hourlyStats[kotHour].delayed++;
        const effectiveWait = turnaroundTime || prepTime || 0;
        hourlyStats[kotHour].totalWaitMinutes += effectiveWait;
      }

      // Dish analysis
      (kot.kotItems || []).forEach(kItem => {
        const prod = kItem.billingItem?.product;
        if (prod) {
          const pName = prod.product_name || 'Unknown Product';
          if (!dishStatsMap[pName]) {
            dishStatsMap[pName] = {
              product_name: pName,
              order_count: 0,
              delayed_count: 0,
              total_prep: 0,
              prep_samples: 0
            };
          }
          dishStatsMap[pName].order_count += (kItem.quantity || 1);
          if (wasDelayed) {
            dishStatsMap[pName].delayed_count += (kItem.quantity || 1);
          }
          if (prepTime > 0) {
            dishStatsMap[pName].total_prep += prepTime;
            dishStatsMap[pName].prep_samples++;
          }
        }
      });
    });

    // Finalize hourly stats
    hourlyStats.forEach(h => {
      h.avgWait = h.tickets > 0 ? Math.round(h.totalWaitMinutes / h.tickets) : 0;
    });

    // Finalize stations
    const stations = Object.values(historicalStationMap).map(st => ({
      station: st.station,
      total_tickets: st.total,
      served_tickets: st.served,
      delayed_tickets: st.delayed,
      delay_rate_pct: st.total > 0 ? parseFloat(((st.delayed / st.total) * 100).toFixed(1)) : 0,
      avg_prep_minutes: st.prepCount > 0 ? parseFloat((st.totalPrepMinutes / st.prepCount).toFixed(1)) : 0
    }));

    // Top Bottleneck Dishes (ranked by delayed count and avg prep)
    const slowestDishes = Object.values(dishStatsMap)
      .map(d => ({
        product_name: d.product_name,
        order_count: d.order_count,
        delayed_count: d.delayed_count,
        delay_rate_pct: d.order_count > 0 ? parseFloat(((d.delayed_count / d.order_count) * 100).toFixed(1)) : 0,
        avg_prep_minutes: d.prep_samples > 0 ? parseFloat((d.total_prep / d.prep_samples).toFixed(1)) : 0
      }))
      .sort((a, b) => b.delayed_count - a.delayed_count || b.avg_prep_minutes - a.avg_prep_minutes)
      .slice(0, 8);

    const avgHistoricalPrep = prepCount > 0 ? parseFloat((totalPrepMinutes / prepCount).toFixed(1)) : 0;
    const avgHistoricalTurnaround = turnaroundCount > 0 ? parseFloat((totalTurnaroundMinutes / turnaroundCount).toFixed(1)) : 0;
    const historicalDelayRate = totalHistoricalTickets > 0 ? parseFloat(((historicalDelayedCount / totalHistoricalTickets) * 100).toFixed(1)) : 0;

    return {
      period,
      threshold_minutes: threshold,
      date_range: { start: s, end: e },
      live: {
        stress_level: liveStressLevel,
        active_tickets_count: activeKots.length,
        pending_count: livePendingCount,
        preparing_count: livePreparingCount,
        overdue_count: liveOverdueCount,
        max_wait_minutes: maxWaitMinutes,
        station_loads: Object.values(stationLoadMap),
        overdue_tickets: liveTickets.filter(t => t.is_overdue).sort((a, b) => b.wait_minutes - a.wait_minutes),
        all_active_tickets: liveTickets
      },
      historical: {
        total_tickets: totalHistoricalTickets,
        served_tickets: servedTicketsCount,
        cancelled_tickets: cancelledTicketsCount,
        delayed_tickets: historicalDelayedCount,
        delay_rate_pct: historicalDelayRate,
        avg_prep_minutes: avgHistoricalPrep,
        avg_turnaround_minutes: avgHistoricalTurnaround,
        stations,
        slowest_dishes: slowestDishes,
        hourly_stats: hourlyStats.filter(h => h.tickets > 0 || (parseInt(h.hour) >= 10 && parseInt(h.hour) <= 22))
      }
    };
  }
};

export default billingService;
