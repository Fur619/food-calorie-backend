const express = require("express");
const moment = require("moment");
const { ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const { ensureRole, ensureUserId } = require("../helpers/authRoles");
const User = require("../models/User");
const FoodEntry = require("../models/FoodEntry");
const router = express.Router();

/**
 * * Create New User and get user token
 * *  Only Admin can Create a User
 */
router.post("/create", async function (req, res) {
  try {
    ensureRole(req.user, "Admin");

    const { userName, email } = req.body;
    const regexUserName = new RegExp(userName, "i");
    const regexEmail = new RegExp(email, "i");

    const userExists = await User.findOne({
      $or: [({ email: regexEmail }, { userName: regexUserName })],
    });
    if (userExists) {
      return res.status(409).send({
        message: `${
          userExists.email === email ? "Email" : "User Name"
        } already exists`,
      });
    }
    const user = await User.create({
      email: email.toLowerCase(),
      userName,
      userRole: "User",
      calorieLimit: 2100,
      priceLimit: 1000,
    });
    const token = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        role: user.userRole,
      },
      process.env.JWT_SECRET
    );

    return res.status(200).send({
      message: "User Created Successfully",
      token,
    });
  } catch (error) {
    res.status(500).send({
      message: error.message || "Internal server error",
    });
  }
});

/**
 * * Delete Specific User
 * * Only Admin can use This
 */

router.delete("/:id", async function (req, res) {
  try {
    ensureRole(req.user, "Admin");

    const { id } = req.params;
    const user = await User.deleteOne({
      _id: id,
    });
    if (user.deletedCount === 0) {
      return res.status(404).send({
        message: "No user For Specific Id Exists",
      });
    }
    await FoodEntry.deleteMany({
      user: id,
    });
    return res.status(200).send({
      message: "User SuccessFully Deleted",
    });
  } catch (error) {
    res.status(500).send({
      message: error.message || "Internal server error",
    });
  }
});

/**
 * * Fetch User from token
 */

router.get("/getUserByToken", async function (req, res) {
  try {
    const user = await User.findOne({ _id: req.user._id });
    if (!user) {
      return res.status(401).send({
        message: `Invalid Token`,
      });
    }

    return res.status(200).send(user);
  } catch (error) {
    res.status(500).send({
      message: error.message || "Internal server error",
    });
  }
});

/**
 * * Fetch User Token from Email
 * * Only Admin can use this api
 */

router.get("/getUserToken", async function (req, res) {
  try {
    ensureRole(req.user, "Admin");

    const { email } = req.query;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).send({
        message: `Invalid Email`,
      });
    }

    const token = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        role: user.userRole,
      },
      process.env.JWT_SECRET
    );

    return res.status(200).send(token);
  } catch (error) {
    res.status(500).send({
      message: error.message || "Internal server error",
    });
  }
});

/**
 * * Fetch All users
 * * Only Admin can use this api
 */
router.get("/allUsers", async function (req, res) {
  try {
    ensureRole(req.user, "Admin");

    const { limit = 10, page = 1, userName } = req.query;
    const regex = new RegExp(userName, "i");

    const users = await User.paginate(
      {
        userRole: "User",
        ...(userName && { userName: regex }),
      },
      {
        limit,
        page,
        sort: {
          userName: 1,
        },
      }
    );

    return res.status(200).send(users);
  } catch (error) {
    res.status(500).send({
      message: error.message || "Internal server error",
    });
  }
});

/**
 * * Average User Entries Report
 * * Only Admin can use this api
 */
router.get("/report", async function (req, res) {
  try {
    ensureRole(req.user, "Admin");

    const currentDate = new Date();
    const prevWeek = moment(currentDate)
      .subtract(7, "days")
      .startOf("day")
      .toDate();
    const twoWeeksBefore = moment(prevWeek)
      .subtract(7, "days")
      .startOf("day")
      .toDate();

    const lastWeekEntries = await FoodEntry.aggregate([
      {
        $match: {
          dateTaken: { $gte: prevWeek, $lte: currentDate },
        },
      },
      { $group: { _id: "$user", amount: { $sum: "$Calorie" } } },
    ]);
    const twoWeeksBeforeEntries = await FoodEntry.aggregate([
      {
        $match: {
          dateTaken: { $gte: twoWeeksBefore, $lt: prevWeek },
        },
      },
      { $group: { _id: "$user", amount: { $sum: "$Calorie" } } },
    ]);

    const noOfLastWeekEntries = await FoodEntry.countDocuments({
      dateTaken: { $gte: prevWeek, $lte: currentDate },
    });
    const noOfTwoWeeksBeforeEntries = await FoodEntry.countDocuments({
      dateTaken: { $gte: twoWeeksBefore, $lt: prevWeek },
    });

    const lastWeekAvg =
      (lastWeekEntries.reduce((a, b) => a + b.amount, 0) || 0) /
        lastWeekEntries.length || 0;
    const twoWeekBeforeAvg =
      (twoWeeksBeforeEntries.reduce((a, b) => a + b.amount, 0) || 0) /
        twoWeeksBeforeEntries.length || 0;

    return res.status(200).send({
      lastWeekAvg,
      twoWeekBeforeAvg,
      lastWeekEntries: noOfLastWeekEntries || 0,
      twoWeeksBeforeEntries: noOfTwoWeeksBeforeEntries || 0,
    });
  } catch (error) {
    res.status(500).send({
      message: error.message || "Internal server error",
    });
  }
});

/**
 * * User Specific Report
 * * Only Admin can use this api
 */
router.get("/report/:id", async function (req, res) {
  try {
    ensureRole(req.user, "Admin");

    const { id } = req.params;

    const currentDate = new Date();
    const prevWeek = moment(currentDate)
      .subtract(7, "days")
      .startOf("day")
      .toDate();
    const twoWeeksBefore = moment(prevWeek)
      .subtract(7, "days")
      .startOf("day")
      .toDate();

    const lastWeekEntries = await FoodEntry.aggregate([
      {
        $match: {
          dateTaken: { $gte: prevWeek, $lte: currentDate },
          user: new ObjectId(id),
        },
      },
      { $group: { _id: "$user", amount: { $sum: "$Calorie" } } },
    ]);
    const twoWeeksBeforeEntries = await FoodEntry.aggregate([
      {
        $match: {
          dateTaken: { $gte: twoWeeksBefore, $lt: prevWeek },
          user: new ObjectId(id),
        },
      },
      { $group: { _id: "$user", amount: { $sum: "$Calorie" } } },
    ]);

    const noOfLastWeekEntries = await FoodEntry.countDocuments({
      dateTaken: { $gte: prevWeek, $lte: currentDate },
      user: new ObjectId(id),
    });
    const noOfTwoWeeksBeforeEntries = await FoodEntry.countDocuments({
      dateTaken: { $gte: twoWeeksBefore, $lt: prevWeek },
      user: new ObjectId(id),
    });

    const lastWeekCalories =
      lastWeekEntries.reduce((a, b) => a + b.amount, 0) || 0;
    const twoWeekBeforeCalories =
      twoWeeksBeforeEntries.reduce((a, b) => a + b.amount, 0) || 0;

    return res.status(200).send({
      lastWeekCalories,
      twoWeekBeforeCalories,
      lastWeekEntries: noOfLastWeekEntries || 0,
      twoWeeksBeforeEntries: noOfTwoWeeksBeforeEntries || 0,
    });
  } catch (error) {
    res.status(500).send({
      message: error.message || "Internal server error",
    });
  }
});

/**
 * * User Daily Calories Warnings
 * *
 */
router.get("/warning/calorie", async function (req, res) {
  try {
    const { id, timezone, date } = req.query;
    ensureUserId(req.user, id);
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const user = await User.findById(id, {
      calorieLimit: 1,
    });
    const startDate = moment(date || new Date())
      .startOf("day")
      .toDate();
    const endDate = moment(date || new Date())
      .endOf("day")
      .toDate();

    const entries = await FoodEntry.aggregate([
      {
        $match: {
          user: new ObjectId(id),
          ...(date && {
            dateTaken: {
              $gte: startDate,
              $lte: endDate,
            },
          }),
        },
      },

      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$dateTaken",
              timezone,
            },
          },
          amount: { $sum: "$Calorie" },
        },
      },
      {
        $match: {
          amount: { $gte: user.calorieLimit },
        },
      },
      {
        $sort: { _id: -1 },
      },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: Number(limit) }],
        },
      },
    ]);

    return res.status(200).send({ warnings: entries[0], user });
  } catch (error) {
    res.status(500).send({
      message: error.message || "Internal server error",
    });
  }
});

/**
 * * User Monthly Price Warnings
 * *
 */
router.get("/warning/price", async function (req, res) {
  try {
    const { id, timezone, date } = req.query;
    ensureUserId(req.user, id);
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const userRecord = await User.findById(id, {
      priceLimit: 1,
    });

    const startOfMonth = moment(date || new Date())
      .startOf("month")
      .toDate();
    const endOfMonth = moment(date || new Date())
      .endOf("month")
      .toDate();

    const entries = await FoodEntry.aggregate([
      {
        $match: {
          user: new ObjectId(id),
          ...(date && {
            dateTaken: {
              $gte: startOfMonth,
              $lte: endOfMonth,
            },
          }),
        },
      },

      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$dateTaken",
              timezone,
            },
          },
          amount: { $sum: "$price" },
        },
      },
      {
        $match: {
          amount: { $gte: userRecord.priceLimit },
        },
      },
      {
        $sort: { _id: -1 },
      },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: Number(limit) }],
        },
      },
    ]);

    return res.status(200).send({ warnings: entries[0] });
  } catch (error) {
    res.status(500).send({
      message: error.message || "Internal server error",
    });
  }
});

module.exports = router;
