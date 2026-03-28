const Product = require('../models/Product');
const pool = require('../config/database');
const fs = require('fs');
const path = require('path');
const { uploadToCloudinary } = require('../config/cloudinary');

// Generate unique product ID
const generateProductId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Helper function to parse images
const parseImages = (images) => {
  if (!images) return [];
  if (Array.isArray(images)) return images;
  try {
    return JSON.parse(images);
  } catch (e) {
    return [images];
  }
};

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
  try {
    console.log('📦 Getting all products');
    const products = await Product.findAll();
    
    const formattedProducts = products.map(product => {
      product.images = parseImages(product.images);
      return product;
    });
    
    res.json({
      success: true,
      count: formattedProducts.length,
      products: formattedProducts
    });
  } catch (err) {
    console.error('❌ Get products error:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + err.message
    });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    let cleanId = id;
    if (id.includes(':')) {
      cleanId = id.split(':')[0];
      console.log(`🔧 Cleaned product ID from ${id} to ${cleanId}`);
    }
    
    const productId = parseInt(cleanId);
    if (isNaN(productId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid product ID format' 
      });
    }
    
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found' 
      });
    }

    product.images = parseImages(product.images);

    res.json({
      success: true,
      product
    });
  } catch (err) {
    console.error('❌ Get product error:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + err.message
    });
  }
};

// @desc    Get product by product ID (unique code)
// @route   GET /api/products/code/:productId
// @access  Public
const getProductByCode = async (req, res) => {
  try {
    const product = await Product.findByProductId(req.params.productId);
    
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found' 
      });
    }

    product.images = parseImages(product.images);

    res.json({
      success: true,
      product
    });
  } catch (err) {
    console.error('❌ Get product by code error:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + err.message
    });
  }
};

// @desc    Get products by category
// @route   GET /api/products/category/:category
// @access  Public
const getProductsByCategory = async (req, res) => {
  try {
    const products = await Product.findByCategory(req.params.category);
    
    const formattedProducts = products.map(product => {
      product.images = parseImages(product.images);
      return product;
    });
    
    res.json({
      success: true,
      count: formattedProducts.length,
      products: formattedProducts
    });
  } catch (err) {
    console.error('❌ Get products by category error:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + err.message
    });
  }
};

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
const searchProducts = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.json({
        success: true,
        count: 0,
        products: []
      });
    }

    const products = await Product.search(q);
    
    const formattedProducts = products.map(product => {
      product.images = parseImages(product.images);
      return product;
    });
    
    res.json({
      success: true,
      count: formattedProducts.length,
      products: formattedProducts
    });
  } catch (err) {
    console.error('❌ Search products error:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + err.message
    });
  }
};

// @desc    Create product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
  try {
    const {
      title, price, old_price, description,
      category, stock_status, rating
    } = req.body;

    if (!title || !price || !description || !category || !rating) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide all required fields' 
      });
    }

    const product_id = generateProductId();

    // ✅ UPLOAD IMAGES TO CLOUDINARY
    let cloudinaryUrls = [];
    if (req.files && req.files.length > 0) {
      console.log(`📤 Uploading ${req.files.length} images to Cloudinary...`);
      
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.buffer, {
            public_id: `${product_id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
          });
          cloudinaryUrls.push(result.secure_url);
          console.log(`☁️ Uploaded: ${result.secure_url}`);
        } catch (uploadError) {
          console.error('❌ Cloudinary upload error:', uploadError.message);
          // Continue with other images
        }
      }
    }

    const product = await Product.create({
      product_id,
      title,
      price: parseFloat(price),
      old_price: old_price ? parseFloat(old_price) : null,
      description,
      category,
      stock_status: stock_status || 'available',
      rating: parseFloat(rating),
      images: JSON.stringify(cloudinaryUrls)  // Store Cloudinary URLs
    });

    product.images = cloudinaryUrls;

    console.log(`✅ Product created with ${cloudinaryUrls.length} Cloudinary images`);

    res.status(201).json({
      success: true,
      message: 'Product added! Images stored in Cloudinary ☁️',
      product
    });
  } catch (err) {
    console.error('❌ Create product error:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + err.message
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const {
      title, price, old_price, description,
      category, stock_status, rating,
      images_to_remove
    } = req.body;

    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found' 
      });
    }

    let currentImages = parseImages(existingProduct.images);
    
    // Handle image removal
    if (images_to_remove) {
      let toRemove = [];
      try {
        toRemove = JSON.parse(images_to_remove);
      } catch (e) {
        toRemove = [images_to_remove];
      }
      
      currentImages = currentImages.filter(img => !toRemove.includes(img));
      console.log(`🗑️ Removed ${toRemove.length} images`);
    }

    // ✅ UPLOAD NEW IMAGES TO CLOUDINARY
    if (req.files && req.files.length > 0) {
      console.log(`📤 Uploading ${req.files.length} new images to Cloudinary...`);
      
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.buffer, {
            public_id: `${existingProduct.product_id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
          });
          currentImages.push(result.secure_url);
          console.log(`☁️ Uploaded: ${result.secure_url}`);
        } catch (uploadError) {
          console.error('❌ Cloudinary upload error:', uploadError.message);
        }
      }
    }

    // Build update query
    let updateQuery = 'UPDATE products SET ';
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title) {
      updates.push(`title = $${paramCount}`);
      values.push(title);
      paramCount++;
    }
    if (price !== undefined) {
      updates.push(`price = $${paramCount}`);
      values.push(parseFloat(price));
      paramCount++;
    }
    if (old_price !== undefined) {
      updates.push(`old_price = $${paramCount}`);
      values.push(old_price ? parseFloat(old_price) : null);
      paramCount++;
    }
    if (description) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }
    if (category) {
      updates.push(`category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }
    if (stock_status) {
      updates.push(`stock_status = $${paramCount}`);
      values.push(stock_status);
      paramCount++;
    }
    if (rating) {
      updates.push(`rating = $${paramCount}`);
      values.push(parseFloat(rating));
      paramCount++;
    }

    // Update images if changed
    updates.push(`images = $${paramCount}`);
    values.push(JSON.stringify(currentImages));
    paramCount++;

    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No fields to update' 
      });
    }

    updateQuery += updates.join(', ');
    updateQuery += ` WHERE id = $${paramCount} RETURNING *`;
    values.push(parseInt(productId));

    const result = await pool.query(updateQuery, values);

    const updatedProduct = result.rows[0];
    updatedProduct.images = parseImages(updatedProduct.images);

    console.log(`✅ Product updated with ${updatedProduct.images.length} Cloudinary images`);

    res.json({
      success: true,
      message: 'Product updated! Images on Cloudinary ☁️',
      product: updatedProduct
    });
  } catch (err) {
    console.error('❌ Update product error:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + err.message
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found' 
      });
    }

    // Delete favorites reference
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'favorites'
        );
      `);
      
      if (tableCheck.rows[0].exists) {
        await pool.query('DELETE FROM favorites WHERE product_id = $1', [productId]);
        console.log(`✅ Deleted favorites for product ${productId}`);
      }
    } catch (favError) {
      console.log('⚠️ Favorites table error:', favError.message);
    }

    // ✅ Note: Cloudinary images are NOT automatically deleted
    // They remain in Cloudinary. To delete them, you'd need to call cloudinary.uploader.destroy()
    // This is optional - images will just be orphaned in Cloudinary

    await pool.query('DELETE FROM products WHERE id = $1', [productId]);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (err) {
    console.error('Delete product error:', err.message);
    
    if (err.code === '23503') {
      return res.status(400).json({ 
        success: false,
        message: 'Cannot delete product because it is referenced in orders or favorites.' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + err.message
    });
  }
};

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
const getFeaturedProducts = async (req, res) => {
  try {
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='products' AND column_name='created_at'
    `);
    
    let query;
    if (columnCheck.rows.length > 0) {
      query = 'SELECT * FROM products WHERE rating >= 4.5 ORDER BY created_at DESC LIMIT 10';
    } else {
      query = 'SELECT * FROM products WHERE rating >= 4.5 ORDER BY id DESC LIMIT 10';
    }
    
    const result = await pool.query(query);
    
    const products = result.rows.map(product => {
      product.images = parseImages(product.images);
      return product;
    });

    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (err) {
    console.error('❌ Get featured products error:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + err.message
    });
  }
};

// @desc    Get products by price range
// @route   GET /api/products/price-range
// @access  Public
const getProductsByPriceRange = async (req, res) => {
  try {
    const { min, max } = req.query;
    
    const result = await pool.query(
      'SELECT * FROM products WHERE price BETWEEN $1 AND $2 ORDER BY price',
      [min || 0, max || 999999]
    );

    const products = result.rows.map(product => {
      product.images = parseImages(product.images);
      return product;
    });

    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (err) {
    console.error('Get products by price range error:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + err.message
    });
  }
};

// @desc    Update product stock
// @route   PATCH /api/products/:id/stock
// @access  Private/Admin
const updateProductStock = async (req, res) => {
  try {
    const { stock_status } = req.body;
    const productId = req.params.id;

    const result = await pool.query(
      'UPDATE products SET stock_status = $1 WHERE id = $2 RETURNING *',
      [stock_status, productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found' 
      });
    }

    const product = result.rows[0];
    product.images = parseImages(product.images);

    res.json({
      success: true,
      message: 'Stock status updated successfully',
      product
    });
  } catch (err) {
    console.error('Update product stock error:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + err.message
    });
  }
};

module.exports = {
  getProducts,
  getProductById,
  getProductByCode,
  getProductsByCategory,
  searchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getProductsByPriceRange,
  updateProductStock
};
