const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    category: { type: String },
    dateOfSale: { type: String, required: true }, // Keep it as a string for simplicity (use regex for month filtering)
    isSold: { type: Boolean, default: false },
});

module.exports = mongoose.model('Product', ProductSchema);
