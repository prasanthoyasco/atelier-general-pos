// // controllers/user.controller.js
// import userService from "../service/user.service.js";
// import { registerSchema, userLoginSchema } from "../dto/user.dto.js";

// const userController = {
//   // 🔹 Register
//   async register(req, res) {
//     try {
//       // Validate request
//       const data = registerSchema.body.parse(req.body);

//       const user = await userService.register(data);
//       return res.status(201).json({ message: "User registered", user });
//     } catch (err) {
//       return res.status(400).json({ error: err.message || err.errors });
//     }
//   },

//   // 🔹 Login
//   async login(req, res) {
//     try {
//       const data = userLoginSchema.body.parse(req.body);

//       // Here, identifier can be email or phone
//       const identifier = data.identifier;
//       const password = data.password;

//       const result = await userService.login({ identifier, password });
//       return res.json({ message: "Login successful", ...result });
//     } catch (err) {
//       return res.status(400).json({ error: err.message || err.errors });
//     }
//   },

//   // 🔹 Get User Profile
//   async profile(req, res) {
//     try {
//       const user = await userService.getUserById(req.params.id);
//       return res.json({ user });
//     } catch (err) {
//       return res.status(404).json({ error: err.message });
//     }
//   },
// };

// export default userController;


import userService from "../service/user.service.js";
import {
  registerSchema,
  userLoginSchema,
  updateUserSchema,
} from "../dto/user.dto.js";
import { decodeRefreshToken, generateToken, generateRefreshToken } from "../../utils/token.js";

const userController = {
  async createUser(req, res) {
    try {
      console.log('=== CREATE USER ===');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      // Use role_id from body, or role if that's what's sent
      const payload = {
        ...req.body,
        role_id: req.body.role_id || req.body.role,
      };

      const data = registerSchema.body.parse(payload);
      const user = await userService.createUser(data);

      res.status(201).json({ message: "User created", user });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async getUsers(req, res) {
    try {
      const result = await userService.getUsers(req.query);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getUserById(req, res) {
    try {
      const user = await userService.getUserById(req.params.id);
      res.json(user);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  },

  async getMe(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await userService.getMe(req.user.id);
      res.json(user);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  },

  async loginUser(req, res) {
    try {
      const data = userLoginSchema.body.parse(req.body);

      if (!data.identifier || !data.password) {
        return res.status(400).json({ error: "Identifier and password are required" });
      }

      const result = await userService.loginUser(data);
      res.json({ message: "Login success", ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async updateUserById(req, res) {
    try {
      const data = updateUserSchema.body.parse(req.body);

      // Prevent non-admin users from escalating their own or other users' roles
      const userRole = (req.user?.role_name || '').toLowerCase().replace(/_/g, ' ');
      const isAdmin = userRole === 'super admin' || userRole === 'admin';
      if (data.role_id && !isAdmin) {
        delete data.role_id;
      }

      // Get updated_by from req.user if available, otherwise null
      const updatedBy = req.user?.id || null;

      const user = await userService.updateUserById(
        req.params.id,
        data,
        updatedBy
      );

      res.json({ message: "User updated", user });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async softDeleteUser(req, res) {
    try {
      await userService.softDeleteUser(req.params.id, req.user?.id || null);
      res.json({ message: "User soft deleted" });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async restoreUser(req, res) {
    try {
      await userService.restoreUser(req.params.id);
      res.json({ message: "User restored" });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },


async refreshAccessToken(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "Refresh token missing" });

    // Decode refresh token
    const decoded = decodeRefreshToken(refreshToken);
    if (!decoded?.id) return res.status(400).json({ error: "Invalid refresh token" });

    // Generate new access token
    const accessToken = await userService.refreshAccessToken(decoded.id);

    // Generate a new refresh token
    const newRefreshToken = generateRefreshToken({ id: decoded.id });

    res.json({ token: accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
},


  async logoutUser(req, res) {
    try {
      if (req.user?.id) {
        await userService.logoutUser(req.user.id);
      }
      res.json({ message: "Logged out" });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async sendOtpToken(req, res) {
    try {
      await userService.sendOtpToken(req.body.identifier);
      // Redact raw OTP from API response for production security
      res.json({ message: "OTP sent successfully" });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async userAlreadyExists(req, res) {
    const exists = await userService.userAlreadyExists(req.query.email);
    res.json({ exists });
  },

  async changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;
      await userService.changePassword(req.user.id, oldPassword, newPassword);
      res.json({ message: "Password changed" });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
};

export default userController;
