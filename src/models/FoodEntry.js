const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const foodEntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    foodName: String,
    Calorie: Number,
    price: Number,
    dateTaken: Date,
  },
  { versionKey: false, timestamps: true }
);

foodEntrySchema.plugin(mongoosePaginate);
const FoodEntry = mongoose.model("FoodEntry", foodEntrySchema);
module.exports = FoodEntry;
