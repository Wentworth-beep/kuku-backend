const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

// Make sure upload is defined
if (!upload) {
    console.error('❌ Upload middleware is undefined!');
}

// Generate unique product ID
const generateProductId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// POST create product - FIXED: remove the second auth parameter
router.post('/', auth, upload.array('images', 10), async (req, res) => {
    try {
        console.log('📦 Creating product...');
        const { title, price, old_price, description, category, stock_status, rating } = req.body;
        
        if (!title || !price || !description || !category) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        
        const product_id = generateProductId();
        
        // For now, use placeholder images (skip Cloudinary upload)
        const imageUrls = ['https://placehold.co/400x300/FF6B00/white?text=KUKU+YETU'];
        
        const result = await pool.query(
            `INSERT INTO products (product_id, title, price, old_price, description, category, stock_status, rating, images) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [product_id, title, price, old_price || null, description, category, stock_status || 'available', rating || 4, imageUrls]
        );
        
        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            product: result.rows[0]
        });
    } catch (err) {
        console.error('Create product error:', err);
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
});

// GET all products
router.get('/', async (req, res) => {
    try {
        const { category, search } = req.query;
        let query = 'SELECT * FROM products';
        let params = [];

        if (category || search) {
            query += ' WHERE';
            if (category) {
                query += ' category = $1';
                params.push(category);
            }
            if (search) {
                if (params.length > 0) query += ' AND';
                query += ` (product_id ILIKE $${params.length + 1} OR title ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`;
                params.push(`%${search}%`);
            }
        }

        query += ' ORDER BY created_at DESC';
        
        const products = await pool.query(query, params);
        
        const formattedProducts = products.rows.map(product => {
            if (product.images && !Array.isArray(product.images)) {
                product.images = [product.images];
            }
            return product;
        });
        
        res.json({
            success: true,
            count: formattedProducts.length,
            products: formattedProducts
        });
    } catch (err) {
        console.error('Get products error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET single product
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const productId = parseInt(id);
        
        if (isNaN(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }
        
        const result = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        const product = result.rows[0];
        if (product.images && !Array.isArray(product.images)) {
            product.images = [product.images];
        }
        
        res.json({ success: true, product });
    } catch (err) {
        console.error('Get product error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// PUT update product
router.put('/:id', auth, upload.array('new_images', 10), async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const { title, price, old_price, description, category, stock_status, rating } = req.body;
        
        const existing = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        if (title) { updates.push(`title = $${paramCount}`); values.push(title); paramCount++; }
        if (price) { updates.push(`price = $${paramCount}`); values.push(price); paramCount++; }
        if (old_price !== undefined) { updates.push(`old_price = $${paramCount}`); values.push(old_price || null); paramCount++; }
        if (description) { updates.push(`description = $${paramCount}`); values.push(description); paramCount++; }
        if (category) { updates.push(`category = $${paramCount}`); values.push(category); paramCount++; }
        if (stock_status) { updates.push(`stock_status = $${paramCount}`); values.push(stock_status); paramCount++; }
        if (rating) { updates.push(`rating = $${paramCount}`); values.push(rating); paramCount++; }
        
        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }
        
        values.push(productId);
        const query = `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        const result = await pool.query(query, values);
        
        res.json({
            success: true,
            message: 'Product updated successfully',
            product: result.rows[0]
        });
    } catch (err) {
        console.error('Update product error:', err);
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
});

// DELETE product
router.delete('/:id', auth, async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        
        await pool.query('DELETE FROM products WHERE id = $1', [productId]);
        
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (err) {
        console.error('Delete product error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;