const mongoose = require("mongoose");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const fetchOrCreateAdmin = async () => {
  try {
    let admin = await User.findOne({
      userRole: "Admin",
    });
    if (!admin) {
      admin = await User.create({
        email: "Admin@admin.com",
        userName: "Furqan",
        userRole: "Admin",
      });
    }
    const token = jwt.sign(
      {
        _id: admin._id,
        email: admin.email,
        role: admin.userRole,
      },
      process.env.JWT_SECRET
    );
    console.log("token::", token);
  } catch (error) {
    console.log("Error::", error);
  } finally {
    process.exit();
  }
};

const runScript = async () => {
  try {
    mongoose.connect(
      process.env.DATABASE_URL,
      { useNewUrlParser: true, useUnifiedTopology: true },
      async () => {
        console.log("Connected to MongoDB");
        await fetchOrCreateAdmin();
      }
    );
  } catch (err) {
    console.log("Error:::", err);
  }
};

runScript();
