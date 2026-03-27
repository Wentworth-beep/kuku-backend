const pool = require('../config/database');

// Generate unique order ID
const generateOrderId = () => {
  return 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    console.log('🔵 Creating order for user:', req.user.id);
    console.log('📦 Received data:', JSON.stringify(req.body, null, 2));

    const {
      customer_name, phone, alternative_phone,
      location, specific_address, products, total_amount
    } = req.body;

    // Validation
    if (!customer_name || !phone || !location || !products || !total_amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Products must be a non-empty array' 
      });
    }

    // Generate unique order ID
    const order_id = generateOrderId();
    console.log('📋 Generated order_id:', order_id);

    // Clean and prepare products data
    const cleanProducts = products.map(p => ({
      id: parseInt(p.id),
      title: String(p.title).trim(),
      price: parseFloat(p.price),
      quantity: parseInt(p.quantity)
    }));
    
    const productsJson = JSON.stringify(cleanProducts);
    const cleanTotal = parseFloat(total_amount);

    // Insert order into database
    const query = `
      INSERT INTO orders 
      (order_id, user_id, customer_name, phone, alternative_phone, 
       location, specific_address, products, total_amount, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      order_id,
      req.user.id,
      customer_name,
      phone,
      alternative_phone || null,
      location,
      specific_address || null,
      productsJson,
      cleanTotal,
      'pending'
    ];

    const result = await pool.query(query, values);
    const newOrder = result.rows[0];
    
    console.log('✅ Order created successfully. ID:', newOrder.id, 'Order Number:', newOrder.order_id);

    // Create notification for user
    try {
      const notifQuery = `
        INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
        VALUES ($1, $2, $3, $4, false, NOW())
      `;
      
      await pool.query(notifQuery, [
        req.user.id,
        '🛒 Order Received',
        `Your order #${order_id} has been received and is pending confirmation.`,
        'order'
      ]);
      
      console.log('✅ Order confirmation notification sent to user', req.user.id);
    } catch (notifError) {
      console.log('⚠️ Notification not sent:', notifError.message);
      // Don't fail the order if notification fails
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: newOrder
    });

  } catch (err) {
    console.error('❌ Create order error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// @desc    Get all orders (admin only)
// @route   GET /api/orders
// @access  Private/Admin
const getAllOrders = async (req, res) => {
  try {
    console.log('🔵 Fetching all orders for admin');

    const result = await pool.query(`
      SELECT o.*, u.full_name as user_name, u.email as user_email
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      ORDER BY o.created_at DESC
    `);

    // Parse products for each order
    const orders = result.rows.map(order => {
      try {
        return {
          ...order,
          products: typeof order.products === 'string' 
            ? JSON.parse(order.products) 
            : (order.products || [])
        };
      } catch (e) {
        console.log('Error parsing products for order', order.id);
        return {
          ...order,
          products: []
        };
      }
    });

    console.log(`✅ Found ${orders.length} orders`);
    
    res.json({
      success: true,
      count: orders.length,
      orders
    });

  } catch (err) {
    console.error('❌ Get all orders error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// @desc    Get user orders
// @route   GET /api/orders/my-orders
// @access  Private
const getUserOrders = async (req, res) => {
  try {
    console.log('🔵 Fetching orders for user:', req.user.id);

    const result = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    // Parse products for each order
    const orders = result.rows.map(order => {
      try {
        return {
          ...order,
          products: typeof order.products === 'string' 
            ? JSON.parse(order.products) 
            : (order.products || [])
        };
      } catch (e) {
        return {
          ...order,
          products: []
        };
      }
    });

    console.log(`✅ Found ${orders.length} orders for user ${req.user.id}`);
    
    res.json({
      success: true,
      count: orders.length,
      orders
    });

  } catch (err) {
    console.error('❌ Get user orders error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// @desc    Get single order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // Validate ID
    if (isNaN(parseInt(orderId))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid order ID format' 
      });
    }

    console.log('🔵 Fetching order:', orderId, 'for user:', req.user.id);

    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    const order = result.rows[0];

    // Check if user owns the order or is admin
    if (order.user_id !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // Parse products
    let parsedProducts = [];
    try {
      parsedProducts = typeof order.products === 'string' 
        ? JSON.parse(order.products) 
        : (order.products || []);
    } catch (e) {
      parsedProducts = [];
    }

    const parsedOrder = {
      ...order,
      products: parsedProducts
    };

    res.json({
      success: true,
      order: parsedOrder
    });

  } catch (err) {
    console.error('❌ Get order error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    console.log(`🔵 Updating order ${orderId} to status: ${status}`);

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status' 
      });
    }

    // Get order details first
    const orderQuery = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderQuery.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    const order = orderQuery.rows[0];

    // Update status
    const updateQuery = 'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *';
    const result = await pool.query(updateQuery, [status, orderId]);
    const updatedOrder = result.rows[0];

    console.log(`✅ Order ${orderId} status updated to ${status}`);

    // Create notification for user
    try {
      let notificationTitle = '';
      let notificationMessage = '';
      
      switch (status) {
        case 'confirmed':
          notificationTitle = '✅ Order Confirmed';
          notificationMessage = `Your order #${order.order_id} has been confirmed and is being processed.`;
          break;
        case 'shipped':
          notificationTitle = '🚚 Order Shipped';
          notificationMessage = `Your order #${order.order_id} has been shipped and is on its way!`;
          break;
        case 'delivered':
          notificationTitle = '📦 Order Delivered';
          notificationMessage = `Your order #${order.order_id} has been delivered. Thank you for shopping with us!`;
          break;
        case 'completed':
          notificationTitle = '✨ Order Completed';
          notificationMessage = `Your order #${order.order_id} is now complete. We hope you enjoy your products!`;
          break;
        case 'cancelled':
          notificationTitle = '❌ Order Cancelled';
          notificationMessage = `Your order #${order.order_id} has been cancelled.`;
          break;
        default:
          notificationTitle = '📝 Order Update';
          notificationMessage = `Your order #${order.order_id} status has been updated to: ${status}`;
      }

      const notifQuery = `
        INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
        VALUES ($1, $2, $3, $4, false, NOW())
      `;
      
      await pool.query(notifQuery, [
        order.user_id,
        notificationTitle,
        notificationMessage,
        'order'
      ]);
      
      console.log(`✅ Notification sent to user ${order.user_id}`);
    } catch (notifError) {
      console.log('⚠️ Notification not sent:', notifError.message);
    }

    // Parse products for response
    let parsedProducts = [];
    try {
      parsedProducts = typeof updatedOrder.products === 'string' 
        ? JSON.parse(updatedOrder.products) 
        : (updatedOrder.products || []);
    } catch (e) {
      parsedProducts = [];
    }

    const parsedOrder = {
      ...updatedOrder,
      products: parsedProducts
    };

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order: parsedOrder
    });

  } catch (err) {
    console.error('❌ Update order status error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// @desc    Cancel order (user)
// @route   PUT /api/orders/:id/cancel
// @access  Private
const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    console.log('🔵 Cancelling order:', orderId, 'by user:', req.user.id);

    // Check if order exists
    const orderQuery = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    
    if (orderQuery.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    const order = orderQuery.rows[0];

    // Check if user owns the order
    if (order.user_id !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // Check if order can be cancelled (only pending or confirmed)
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order cannot be cancelled at this stage' 
      });
    }

    // Update status to cancelled
    const updateQuery = 'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *';
    const result = await pool.query(updateQuery, ['cancelled', orderId]);
    const updatedOrder = result.rows[0];

    console.log('✅ Order cancelled successfully');

    // Create notification
    try {
      const notifQuery = `
        INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
        VALUES ($1, $2, $3, $4, false, NOW())
      `;
      
      await pool.query(notifQuery, [
        order.user_id,
        '❌ Order Cancelled',
        `Your order #${order.order_id} has been cancelled.`,
        'order'
      ]);
    } catch (notifError) {
      console.log('⚠️ Notification not sent:', notifError.message);
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: updatedOrder
    });

  } catch (err) {
    console.error('❌ Cancel order error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// @desc    Delete order (admin only)
// @route   DELETE /api/orders/:id
// @access  Private/Admin
const deleteOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    console.log('🔵 Deleting order:', orderId, 'by admin:', req.user.id);

    // Check if order exists
    const orderQuery = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    
    if (orderQuery.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    // Delete the order
    const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING *', [orderId]);
    
    console.log('✅ Order deleted successfully. ID:', orderId);

    res.json({
      success: true,
      message: 'Order deleted successfully',
      deletedOrder: result.rows[0]
    });

  } catch (err) {
    console.error('❌ Delete order error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// @desc    Get order statistics (admin)
// @route   GET /api/orders/stats
// @access  Private/Admin
const getOrderStats = async (req, res) => {
  try {
    console.log('🔵 Fetching order statistics');

    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_orders,
        COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as average_order_value
      FROM orders
    `);

    // Get today's orders
    const todayResult = await pool.query(`
      SELECT COUNT(*) as today_orders, COALESCE(SUM(total_amount), 0) as today_revenue
      FROM orders 
      WHERE DATE(created_at) = CURRENT_DATE
    `);

    // Get weekly stats
    const weekResult = await pool.query(`
      SELECT COUNT(*) as week_orders, COALESCE(SUM(total_amount), 0) as week_revenue
      FROM orders 
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    console.log('✅ Statistics fetched successfully');

    res.json({
      success: true,
      stats: {
        ...result.rows[0],
        today: todayResult.rows[0],
        thisWeek: weekResult.rows[0]
      }
    });

  } catch (err) {
    console.error('❌ Get order stats error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// @desc    Get recent orders (admin)
// @route   GET /api/orders/recent/:limit
// @access  Private/Admin
const getRecentOrders = async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 10;
    console.log(`🔵 Fetching recent ${limit} orders`);

    const result = await pool.query(`
      SELECT o.*, u.full_name as user_name, u.email as user_email
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      ORDER BY o.created_at DESC 
      LIMIT $1
    `, [limit]);

    // Parse products for each order
    const orders = result.rows.map(order => {
      try {
        return {
          ...order,
          products: typeof order.products === 'string' 
            ? JSON.parse(order.products) 
            : (order.products || [])
        };
      } catch (e) {
        return {
          ...order,
          products: []
        };
      }
    });

    console.log(`✅ Found ${orders.length} recent orders`);

    res.json({
      success: true,
      count: orders.length,
      orders
    });

  } catch (err) {
    console.error('❌ Get recent orders error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

module.exports = {
  createOrder,
  getAllOrders,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
  getOrderStats,
  getRecentOrders
};