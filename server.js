const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const Product = require('./models/Product'); // Import Product model
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;
const DB_URL = 'mongodb://localhost:27017/mern_stack_db';

// Connect to MongoDB
mongoose.connect(DB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log('MongoDB connection error: ', err));

// Third-party API URL
const API_URL = 'https://s3.amazonaws.com/roxiler.com/product_transaction.json';

// Initialize the database with seed data from the third-party API
app.get('/api/initialize', async (req, res) => {
    try {
        const response = await axios.get(API_URL);
        const products = response.data;

        // Save products to the database
        await Product.deleteMany({});
        await Product.insertMany(products);

        res.status(200).json({ message: 'Database initialized with seed data' });
    } catch (error) {
        console.error('Error initializing database: ', error);
        res.status(500).json({ error: 'Failed to initialize database' });
    }
});

// List all transactions with search and pagination
app.get('/api/transactions', async (req, res) => {
    const { search = '', page = 1, perPage = 10, month } = req.query;
    const regex = new RegExp(search, 'i');
    const skip = (page - 1) * perPage;

    try {
        const query = {
            dateOfSale: { $regex: `${month}-` }, // Filter by month
            $or: [
                { title: regex },
                { description: regex },
                { price: regex }
            ]
        };

        const total = await Product.countDocuments(query);
        const transactions = await Product.find(query).skip(skip).limit(Number(perPage));

        res.status(200).json({ total, transactions });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Statistics API
app.get('/api/statistics', async (req, res) => {
    const { month } = req.query;
    try {
        const totalSales = await Product.aggregate([
            { $match: { dateOfSale: { $regex: `${month}-` } } },
            { $group: { _id: null, totalSaleAmount: { $sum: "$price" } } }
        ]);

        const totalSoldItems = await Product.countDocuments({
            dateOfSale: { $regex: `${month}-` },
            isSold: true
        });

        const totalNotSoldItems = await Product.countDocuments({
            dateOfSale: { $regex: `${month}-` },
            isSold: false
        });

        res.status(200).json({
            totalSaleAmount: totalSales[0]?.totalSaleAmount || 0,
            totalSoldItems,
            totalNotSoldItems
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Bar chart API (Price ranges)
app.get('/api/bar-chart', async (req, res) => {
    const { month } = req.query;
    const ranges = [
        { range: '0-100', min: 0, max: 100 },
        { range: '101-200', min: 101, max: 200 },
        { range: '201-300', min: 201, max: 300 },
        { range: '301-400', min: 301, max: 400 },
        { range: '401-500', min: 401, max: 500 },
        { range: '501-600', min: 501, max: 600 },
        { range: '601-700', min: 601, max: 700 },
        { range: '701-800', min: 701, max: 800 },
        { range: '801-900', min: 801, max: 900 },
        { range: '901-above', min: 901, max: Infinity },
    ];

    try {
        const data = await Promise.all(
            ranges.map(async (range) => {
                const count = await Product.countDocuments({
                    dateOfSale: { $regex: `${month}-` },
                    price: { $gte: range.min, $lte: range.max }
                });
                return { range: range.range, count };
            })
        );
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bar chart data' });
    }
});

// Pie chart API (Unique categories)
app.get('/api/pie-chart', async (req, res) => {
    const { month } = req.query;
    try {
        const categories = await Product.aggregate([
            { $match: { dateOfSale: { $regex: `${month}-` } } },
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);

        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pie chart data' });
    }
});

// Combined API for all data
app.get('/api/combined-data', async (req, res) => {
    const { month } = req.query;

    try {
        const [statistics, barChart, pieChart] = await Promise.all([
            axios.get(`/api/statistics?month=${month}`),
            axios.get(`/api/bar-chart?month=${month}`),
            axios.get(`/api/pie-chart?month=${month}`)
        ]);

        res.status(200).json({
            statistics: statistics.data,
            barChart: barChart.data,
            pieChart: pieChart.data
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch combined data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
