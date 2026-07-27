require("dotenv").config();
const User = require("../models/userModel");
const Message = require("../models/messageModal");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const checkUserByEmail = async (email) => {
  return await User.findOne({ email });
};
exports.sendMessageToUser = async (req, res) => {
  try {
    const recipient = await User.findById(req.params.id);
    if (!recipient) return res.status(404).json({ message: 'User not found' });

    const { message } = req.body;

    const newMessage = new Message({
      username: recipient.username,
      email: recipient.email,
      message: message
    });

    await newMessage.save();

    res.status(200).json({ message: 'Message sent successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error sending message' });
  }
};

// Query to create a new user
const createUser = async (email, username, password, role) => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const newUser = new User({
    email,
    username,
    password: hashedPassword,
    role,
    isConfirmed: false,
  });
  return await newUser.save();
};

// Query to find a user by ID
const findUserById = async (id) => {
  return await User.findById(id);
};

// Query to update user profile
const updateUserProfileQuery = async (userId, username, email) => {
  const user = await User.findById(userId);
  if (user) {
    user.username = username || user.username;
    user.email = email || user.email;
    await user.save();
    return user;
  }
  return null;
};

// Query to delete a user by ID
const deleteUserQuery = async (userId) => {
  return await User.findByIdAndDelete(userId);
};
// Query to find all users
const getAllUsersQuery = async () => {
  return await User.find({});
};
// Query to get monthly signups using aggregation
const getMonthlySignupsQuery = async () => {
  return await User.aggregate([
    {
      $group: {
        _id: { $month: "$createdAt" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};
exports.signup = async (req, res) => {
  try {
    const { email, username, password, role = "guest" } = req.body;

    // Validate required fields
    if (!email || !username || !password) {
      return res.status(400).json({
        message: "Email, Username and Password are required.",
      });
    }

    // Check if the user already exists
    const existingUser = await checkUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with that email or Username.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await createUser(email, username, hashedPassword, role);

    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const baseUrl =
      process.env.NODE_ENV === "production"
        ? process.env.BASE_URL || 'https://greatconnectionltd.onrender.com'
        : process.env.LOCAL_URL || 'http://localhost:3000';

    const confirmationUrl = `${baseUrl}/api/confirm-email/${token}`;

    const mailOptions = {
      from: `"Great Connection LTD" <${process.env.SMTP_USER}>`,
      to: newUser.email,
      subject: "Email Confirmation",
      html: `
        <p>Dear ${username},</p>
        <p>Thank you for registering to our website.</p>
        <p>Please click <a href='${confirmationUrl}'>Here</a> to confirm your account.</p>
      `,
    };

    // Await the email send operation so it catches any timeout errors
    const info = await transporter.sendMail(mailOptions);
    console.log("Confirmation email sent:", info.response);

    return res.status(201).json({
      message: "Signup successful! Please check your email to confirm your account.",
      user: newUser,
      token: token
    });

  } catch (error) {
    console.error("Signup error / Email failure:", error);
    return res.status(500).json({
      message: "Error sending confirmation email or registering user. Please try again later.",
      error: error.message
    });
  }
};

exports.confirmEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const user = await findUserById(userId);
    if (!user) {
      return res.status(400).render("confirmationFailure");
    }

    user.isConfirmed = true;
    await user.save();

    res.status(200).render("confirmationSuccess");
  } catch (error) {
    console.error("Error confirming email:", error);
    res.status(500).render("confirmationFailure");
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const user = await findUserById(req.user.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error.message);
    res.status(500).json({ message: "Error fetching user profile", error: error.message });
  }
};

exports.updateUserProfile = async (req, res) => {
  try {
    const { username, email } = req.body;
    const user = await updateUserProfileQuery(req.user.userId, username, email);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User profile updated successfully", user });
  } catch (error) {
    console.error("Error updating user profile:", error.message);
    res.status(500).json({ message: "Error updating user profile", error: error.message });
  }
};
exports.updateUserInformation = async (req, res) => {
  try {
    const updateUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updateUser) {
      return res.status(404).json({ message: "User not found" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashpassword = await bcrypt.hash(req.body.password, salt);
    updateUser.password = hashpassword;

    await updateUser.save();
    res.json({ message: "User profile updated successfully", updateUser });
  } catch (error) {
    console.error("Error updating user profile:", error.message);
    res.status(500).json({ message: "Error updating user profile", error: error.message });
  }
};

exports.updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  try {
    const user = await User.findById(id);
    user.role = role;
    await user.save();
    res.status(200).json({ message: 'Role updated', role: user.role });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update role' });
  }
};
exports.toggleUserStatus = async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await User.findById(userId);
    user.status = user.status === 'Active' ? 'Blocked' : 'Active';
    await user.save();
    res.status(200).json({ message: 'Status updated', status: user.status });
  } catch (error) {
    res.status(500).json({ message: 'Error updating status' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await deleteUserQuery(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error.message);
    res.status(500).json({ message: "Error deleting user", error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (!user.isConfirmed) {
      return res.status(403).json({ message: "Please confirm your email before logging in." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role, name: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    if (req.session) {
      req.session.user = {
        userId: user._id,
        role: user.role,
        username: user.username,
        token
      };
    }
    res.cookie("userPreferences", JSON.stringify({
      theme: "dark",
      language: "en"
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });

    res.status(200).json({
      message: "User logged in successfully",
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
      }
    });

  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await getAllUsersQuery();
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await findUserById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.logout = (req, res) => {
  try {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ message: "Failed to log out. Please try again." });
        }
        res.clearCookie("connect.sid");
        res.status(200).json({ message: "Logged out successfully." });
      });
    } else {
      res.status(200).json({ message: "No active session found." });
    }
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ message: "Server error occurred during logout." });
  }
};

// Request password reset - sends reset link to email
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await checkUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "No user found with that email." });
    }

    const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    const baseUrl =
      process.env.NODE_ENV === "production"
        ? process.env.BASE_URL || "https://greatconnectionltd.onrender.com"
        : process.env.LOCAL_URL || "http://localhost:3000";

    const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

    const mailOptions = {
      from: `"Great Connection Services" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Password Reset Request",
      html: `
        <p>Hi ${user.username},</p>
        <p>You requested a password reset. Click <a href="${resetUrl}">here</a> to reset your password.</p>
        <p>This link will expire in 15 minutes.</p>
        <p>If it is not you please leave it or ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Reset link sent to email successfully." });
  } catch (error) {
    console.error("Error sending password reset email:", error);
    res.status(500).json({ message: "Failed to send reset link. Try again later." });
  }
};

// Reset password with token
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: "New password is required." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "Invalid or expired token." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
    user.password = hashed;

    await user.save();

    res.status(200).json({ message: "Password has been reset successfully." });
  } catch (error) {
    console.error("Reset password error:", error.message);
    res.status(500).json({ message: "Invalid or expired reset token." });
  }
};


exports.getSessionData = (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "No active session" });
    }

    res.status(200).json({ user: req.session.user });
  } catch (error) {
    console.error("Error fetching session data:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getMonthlySignups = async (req, res) => {
  try {
    const signups = await getMonthlySignupsQuery();

    const months = [
      "January", "February", "March", "April", "May", "June", "July",
      "August", "September", "October", "November", "December",
    ];

    const formattedData = signups.map((s) => ({
      month: months[s._id - 1],
      count: s.count,
    }));
    res.status(200).json(formattedData);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.restricted = (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }
};
