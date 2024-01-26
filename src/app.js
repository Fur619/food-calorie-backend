const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const authMiddleware = require("./middlewares/authentication");
const indexRouter = require("./router/index");
const userRouter = require("./router/user");
const foodEntryRouter = require("./router/foodEntry");

const app = express();

mongoose.connect(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("MongoDB is Successfully Connected");
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(authMiddleware);

app.use("/", indexRouter);
app.use("/api/users", userRouter);
app.use("/api/foodEntry", foodEntryRouter);

module.exports = app;
