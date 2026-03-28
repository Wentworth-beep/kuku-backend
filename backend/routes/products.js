

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');
const { upload, uploadToCloudinary } = require('../config/cloudinary');

// Generate unique product ID
const generateProductId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};
// ============== CREATE PRODUCT (WITH CLOUDINARY UPLOAD) ==============
router.post('/', auth, upload.array('images', 10), async (req, res) => {
    try {
        console.log('=' .repeat(60));
        console.log('🔥🔥🔥 PRODUCT CREATE ENDPOINT HIT! 🔥🔥🔥');
        console.log('=' .repeat(60));
        
        // Log files
        console.log('📸 req.files exists?', !!req.files);
        console.log('📸 req.files length:', req.files ? req.files.length : 0);
        
        if (req.files && req.files.length > 0) {
            console.log('📸 File details:');
            req.files.forEach((file, i) => {
                console.log(`  File ${i + 1}:`, {
                    originalname: file.originalname,
                    size: file.size,
                    mimetype: file.mimetype,
                    hasBuffer: !!file.buffer
                });
            });
        } else {
            console.log('❌ NO FILES RECEIVED! Check your form enctype and input name.');
            console.log('📝 req.body keys:', Object.keys(req.body));
        }
        
        // Log Cloudinary env vars
        console.log('☁️ Cloudinary configured:', {
            cloud_name: !!process.env.CLOUDINARY_CLOUD_NAME,
            api_key: !!process.env.CLOUDINARY_API_KEY,
            api_secret: !!process.env.CLOUDINARY_API_SECRET
        });
        
        const { title, price, old_price, description, category, stock_status, rating } = req.body;
        
        if (!title || !price || !description || !category) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        
        const product_id = generateProductId();
        
        // UPLOAD TO CLOUDINARY
        const imageUrls = [];
        
        if (req.files && req.files.length > 0) {
            console.log(`📸 Uploading ${req.files.length} image(s) to Cloudinary...`);
            
            for (const file of req.files) {
                try {
                    console.log(`  ⬆️ Uploading: ${file.originalname}`);
                    const result = await uploadToCloudinary(file.buffer);
                    console.log(`  ✅ Uploaded: ${result.secure_url}`);
                    imageUrls.push(result.secure_url);
                } catch (uploadErr) {
                    console.error(`  ❌ Cloudinary upload error:`, uploadErr.message);
                }
            }
        } else {
            console.log('⚠️ No images uploaded - using placeholder');
        }
        
        if (imageUrls.length === 0) {
            imageUrls.push('https://placehold.co/400x300/FF6B00/white?text=KUKU+YETU');
            console.log('📷 Using placeholder image');
        }
        
        console.log(`💾 Saving product with ${imageUrls.length} image(s)`);
        console.log('💾 Image URLs:', imageUrls);
        
        const result = await pool.query(
            `INSERT INTO products (product_id, title, price, old_price, description, category, stock_status, rating, images) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [product_id, title, price, old_price || null, description, category, stock_status || 'available', rating || 4, imageUrls]
        );
        
        console.log('✅ Product created! ID:', result.rows[0].id);
        console.log('✅ Stored images:', result.rows[0].images);
        console.log('=' .repeat(60));
        
        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            product: result.rows[0]
        });
    } catch (err) {
        console.error('❌ Create product error:', err);
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
});

// ============== GET ALL PRODUCTS ==============
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

// ============== GET SINGLE PRODUCT ==============
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

// ============== CREATE PRODUCT (WITH CLOUDINARY UPLOAD) ==============
router.post('/', auth, upload.array('images', 10), async (req, res) => {
    try {
        console.log('📦 Creating product...');
        const { title, price, old_price, description, category, stock_status, rating } = req.body;
        
        // Validate required fields
        if (!title || !price || !description || !category) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        
        const product_id = generateProductId();
        
        // UPLOAD TO CLOUDINARY - PERMANENT STORAGE
        const imageUrls = [];
        
        if (req.files && req.files.length > 0) {
            console.log(`📸 Uploading ${req.files.length} image(s) to Cloudinary...`);
            
            for (const file of req.files) {
                try {
                    const result = await uploadToCloudinary(file.buffer);
                    imageUrls.push(result.secure_url);
                    console.log('✅ Uploaded to Cloudinary:', result.secure_url);
                } catch (uploadErr) {
                    console.error('❌ Cloudinary upload error:', uploadErr.message);
                }
            }
        } else {
            console.log('⚠️ No images uploaded');
        }
        
        // If no images uploaded, use placeholder
        if (imageUrls.length === 0) {
            imageUrls.push('https://placehold.co/400x300/FF6B00/white?text=KUKU+YETU');
            console.log('📷 Using placeholder image');
        }
        
        console.log(`💾 Saving product with ${imageUrls.length} image(s)`);
        
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

// ============== UPDATE PRODUCT ==============
router.put('/:id', auth, upload.array('new_images', 10), async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const { title, price, old_price, description, category, stock_status, rating, images_to_remove } = req.body;
        
        // Check if product exists
        const existing = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        let currentImages = existing.rows[0].images || [];
        if (typeof currentImages === 'string') currentImages = [currentImages];
        
        // Handle image removal if requested
        if (images_to_remove) {
            try {
                const toRemove = JSON.parse(images_to_remove);
                currentImages = currentImages.filter(img => !toRemove.includes(img));
                console.log(`🗑️ Removed ${toRemove.length} image(s)`);
            } catch (e) {}
        }
        
        // Upload new images to Cloudinary
        if (req.files && req.files.length > 0) {
            console.log(`📸 Uploading ${req.files.length} new image(s) to Cloudinary...`);
            for (const file of req.files) {
                try {
                    const result = await uploadToCloudinary(file.buffer);
                    currentImages.push(result.secure_url);
                    console.log('✅ Uploaded to Cloudinary:', result.secure_url);
                } catch (uploadErr) {
                    console.error('Cloudinary upload error:', uploadErr.message);
                }
            }
        }
        
        // Build update query
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
        updates.push(`images = $${paramCount}`); values.push(currentImages); paramCount++;
        
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

// ============== DELETE PRODUCT ==============
router.delete('/:id', auth, async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        
        // Get product images for potential cleanup
        const product = await pool.query('SELECT images FROM products WHERE id = $1', [productId]);
        
        // Note: Cloudinary cleanup could be added here if needed
        
        await pool.query('DELETE FROM products WHERE id = $1', [productId]);
        
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (err) {
        console.error('Delete product error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
router.post('/', auth, upload.array('images', 10), async (req, res) => {
    try {
        console.log('📦 Creating product...');
        console.log('🔍 Has files?', req.files ? 'YES' : 'NO');
        console.log('🔍 Files count:', req.files ? req.files.length : 0);
        
        if (req.files && req.files.length > 0) {
            console.log('🔍 First file:', {
                name: req.files[0].originalname,
                size: req.files[0].size,
                mimetype: req.files[0].mimetype
            });
        }
        
        const { title, price, old_price, description, category, stock_status, rating } = req.body;
        console.log('🔍 Form data:', { title, price, category });
        
        // Validate required fields
        if (!title || !price || !description || !category) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        
        const product_id = generateProductId();
        
        // UPLOAD TO CLOUDINARY
        const imageUrls = [];
        
        if (req.files && req.files.length > 0) {
            console.log(`📸 Uploading ${req.files.length} image(s) to Cloudinary...`);
            
            for (const file of req.files) {
                try {
                    const result = await uploadToCloudinary(file.buffer);
                    imageUrls.push(result.secure_url);
                    console.log('✅ Uploaded to Cloudinary:', result.secure_url);
                } catch (uploadErr) {
                    console.error('❌ Cloudinary upload error:', uploadErr.message);
                }
            }
        } else {
            console.log('⚠️ No images uploaded - req.files is empty!');
            console.log('🔍 req.body keys:', Object.keys(req.body));
        }
        
        if (imageUrls.length === 0) {
            imageUrls.push('https://placehold.co/400x300/FF6B00/white?text=KUKU+YETU');
            console.log('📷 Using placeholder image');
        }
        
        console.log('💾 Final imageUrls to store:', imageUrls);
        
        const result = await pool.query(
            `INSERT INTO products (product_id, title, price, old_price, description, category, stock_status, rating, images) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [product_id, title, price, old_price || null, description, category, stock_status || 'available', rating || 4, imageUrls]
        );
        
        console.log('✅ Product created! ID:', result.rows[0].id);
        console.log('✅ Stored images:', result.rows[0].images);
        
        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            product: result.rows[0]
        });
    } catch (err) {
        console.error('❌ Create product error:', err);
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
});
module.exports = router;

