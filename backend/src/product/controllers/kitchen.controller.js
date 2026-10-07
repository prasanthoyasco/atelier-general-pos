import Kitchen from '../models/kitchen.model.js';

export const getKitchens = async (req, res) => {
  try {
    const kitchens = await Kitchen.findAll({
      where: { is_active: true }
    });
    return res.sendSuccess(kitchens, "Kitchens fetched successfully");
  } catch (error) {
    console.error("Error fetching kitchens:", error);
    return res.sendError("Failed to fetch kitchens", 500);
  }
};
