const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const userSchema = new mongoose.Schema(
  {
    email: String,
    userName: String,
    userRole: String,
    calorieLimit: Number,
    priceLimit: Number,
  },
  { versionKey: false, timestamps: true }
);

userSchema.plugin(mongoosePaginate);
const User = mongoose.model("User", userSchema);
module.exports = User;
