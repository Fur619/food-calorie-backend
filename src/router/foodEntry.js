const express = require("express");
const moment = require("moment");
const { ObjectId } = require("mongodb");
const { ensureRole, ensureUserId } = require("../helpers/authRoles");
const FoodEntry = require("../models/FoodEntry");
const User = require("../models/User");
const router = express.Router();

/**
 * * Create Food Entry for a User
 */

router.post("/create", async function (req, res) {
  try {
    const { userId, foodName, Calorie, dateTaken, price, timezone } = req.body;

    if (!foodName || Calorie || price)
      throw new Error("Form Values are missing");

    ensureUserId(req.user, userId);
    const user = userId || req.user._id;

    const food = await FoodEntry.create({
      user,
      foodName,
      Calorie: Number(Calorie.toFixed(2)),
      dateTaken,
      price: Number(price.toFixed(2)),
    });
    const userRecord = await User.findById(user, {
      calorieLimit: 1,
      priceLimit: 1,
    });

    const startDate = moment(dateTaken).startOf("day").toDate();
    const endDate = moment(dateTaken).endOf("day").toDate();

    const startOfMonth = moment(dateTaken).startOf("month").toDate();
    const endOfMonth = moment(dateTaken).endOf("month").toDate();

    const calorieLimitExceeded = await FoodEntry.aggregate([
      {
        $match: {
          user: new ObjectId(user),
          dateTaken: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },

      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$dateTaken", timezone },
          },
          amount: { $sum: "$Calorie" },
        },
      },
      {
        $match: {
          amount: { $gte: userRecord.calorieLimit },
        },
      },
    ]);

    const priceLimitExceeded = await FoodEntry.aggregate([
      {
        $match: {
          user: new ObjectId(user),
          dateTaken: {
            $gte: startOfMonth,
            $lte: endOfMonth,
          },
        },
      },

      {
        $sort: { dateTaken: -1 },
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
    ]);

    return res.status(200).send({
      message: "Food Entry Successfully Created",
      calorieLimitExceeded: calorieLimitExceeded.length
        ? `You Have Reached your daily Calorie Threshold Limit for day ${moment(
            dateTaken
          ).format("MMM DD, YYYY")}. Calorie amount on this day is ${
            calorieLimitExceeded[0].amount
          }`
        : "",
      priceLimitExceeded: priceLimitExceeded.length
        ? `You Have Reached your monthly price limit for month ${moment(
            dateTaken
          ).format("MMM, YYYY")}. Price amount on this month is ${
            priceLimitExceeded[0].amount
          }`
        : "",
      food,
    });
  } catch (error) {
    res.status(500).send({
      message: error.message || "Internal server error",
    });
  }
});

/**
 * * Get All Food Entries of specific User
 */

router.get("/user", async function (req, res) {
  try {
    const {
      userId,
      limit = 10,
      page = 1,
      populateUser,
      startDate,
      endDate,
      role,
    } = req.query;
    ensureUserId(req.user, userId);

    const foodEntries = await FoodEntry.paginate(
      {
        ...(role !== "Admin" && { user: userId }),
        ...((startDate || endDate) && {
          dateTaken: {
            ...(startDate && { $gte: startDate }),
            ...(endDate && { $lte: endDate }),
          },
        }),
      },
      {
        ...(populateUser && {
          populate: [
            {
              model: "User",
              path: "user",
              select: {
                userName: 1,
                _id: 1,
              },
            },
          ],
        }),
        limit,
        page,
        sort: {
          dateTaken: 1,
        },
      }
    );

    return res.status(200).send({
      foodEntries,
    });
  } catch (error) {
    res.status(500).send({
      message: error.message || "Internal server error",
    });
  }
});

/**
 * * Get All Food Entries Days of specific User
 */

router.get("/user/days", async function (req, res) {
  try {
    const {
      userId,
      limit = 10,
      page = 1,
      populateUser,
      timezone,
      startDate,
      endDate,
      role,
    } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    ensureUserId(req.user, userId);

    const foodEntriesDays = await FoodEntry.aggregate([
      {
        $match: {
          ...(role !== "Admin" && { user: new ObjectId(userId) }),
          ...((startDate || endDate) && {
            dateTaken: {
              ...(startDate && { $gte: new Date(startDate) }),
              ...(endDate && { $lte: new Date(endDate) }),
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
        $sort: {
          _id: -1,
        },
      },

      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: Number(limit) }],
        },
      },
    ]);

    return res.status(200).send({
      foodEntriesDays,
    });
  } catch (error) {
    res.status(500).send({
      message: error.message || "Internal server error",
    });
  }
});

/**
 * * Get All Users Food Entries
 * * Only Admin Can Access this Api
 */

router.get("/allUsers", async function (req, res) {
  try {
    ensureRole(req.user, "Admin");

    const { limit = 10, page = 1 } = req.body;

    const foodEntries = await FoodEntry.paginate(
      {},
      {
        populate: [
          {
            model: "User",
            path: "user",
            select: {
              userName: 1,
              _id: 1,
            },
          },
        ],
        limit,
        page,
        sort: {
          createdAt: -1,
        },
      }
    );

    return res.status(200).send({
      foodEntries,
    });
  } catch (error) {
    res.status(500).send({
      message: error.message || "Internal server error",
    });
  }
});

/**
 * * Update Specifi Food Entry
 */

router.put("/:id", async function (req, res) {
  try {
    const { id } = req.params;
    const { userId, foodName, Calorie, dateTaken, price, timezone } = req.body;
    ensureUserId(req.user, userId);

    const foodEntries = await FoodEntry.findByIdAndUpdate(id, {
      user: userId,
      foodName,
      Calorie: Number(Calorie.toFixed(2)),
      dateTaken,
      price: Number(price.toFixed(2)),
    });

    const userRecord = await User.findById(userId, {
      calorieLimit: 1,
      priceLimit: 1,
    });

    const startDate = moment(dateTaken).startOf("day").toDate();
    const endDate = moment(dateTaken).endOf("day").toDate();

    const startOfMonth = moment(dateTaken).startOf("month").toDate();
    const endOfMonth = moment(dateTaken).endOf("month").toDate();

    const calorieLimitExceeded = await FoodEntry.aggregate([
      {
        $match: {
          user: new ObjectId(userId),
          dateTaken: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },

      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$dateTaken", timezone },
          },
          amount: { $sum: "$Calorie" },
        },
      },
      {
        $match: {
          amount: { $gte: userRecord.calorieLimit },
        },
      },
    ]);

    const priceLimitExceeded = await FoodEntry.aggregate([
      {
        $match: {
          user: new ObjectId(userId),
          dateTaken: {
            $gte: startOfMonth,
            $lte: endOfMonth,
          },
        },
      },

      {
        $sort: { dateTaken: -1 },
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
    ]);

    return res.status(200).send({
      message: "SuccessFully Updated",
      calorieLimitExceeded: calorieLimitExceeded.length
        ? `You Have Reached your daily Calorie Threshold Limit for day ${moment(
            dateTaken
          ).format("MMM DD, YYYY")}. Calorie amount on this day is ${
            calorieLimitExceeded[0].amount
          }`
        : "",
      priceLimitExceeded: priceLimitExceeded.length
        ? `You Have Reached your monthly price limit for month ${moment(
            dateTaken
          ).format("MMM, YYYY")}. Price amount on this month is ${
            priceLimitExceeded?.[0].amount
          }`
        : "",
      foodEntries,
    });
  } catch (error) {
    res.status(500).send({
      message: error.message || "Internal server error",
    });
  }
});

/**
 * * Delete Specifi Food Entry
 */

router.delete("/:id", async function (req, res) {
  try {
    const { id } = req.params;
    const food = await FoodEntry.deleteOne({
      _id: id,
    });
    if (food.deletedCount === 0) {
      return res.status(404).send({
        message: "No Food Entry For Specific Id Exists",
      });
    }
    return res.status(200).send({
      message: "SuccessFully Deleted",
    });
  } catch (error) {
    res.status(500).send({
      message: error.message || "Internal server error",
    });
  }
});

module.exports = router;
