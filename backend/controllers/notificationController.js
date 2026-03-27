mkdir -p /home/the-hype/Desktop/kuku/backend/controllers
cat > /home/the-hype/Desktop/kuku/backend/controllers/notificationController.js << 'EOF'
const pool = require('../config/database');

// Get user notifications
const getUserNotifications = async (req, res) => {
  try {
    console.log('🔔 Fetching notifications for user:', req.user.id);
    
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    
    console.log(`✅ Found ${result.rows.length} notifications`);
    
    res.json({
      success: true,
      count: result.rows.length,
      notifications: result.rows
    });
  } catch (err) {
    console.error('❌ Get notifications error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Get unread notifications count
const getUnreadCount = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false',
      [req.user.id]
    );

    res.json({
      success: true,
      count: parseInt(result.rows[0].count)
    });
  } catch (err) {
    console.error('❌ Get unread count error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Notification not found' 
      });
    }

    console.log(`✅ Notification ${id} marked as read for user ${userId}`);

    res.json({
      success: true,
      message: 'Notification marked as read',
      notification: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Mark as read error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE notifications SET read = true WHERE user_id = $1 RETURNING *',
      [req.user.id]
    );

    console.log(`✅ All notifications marked as read for user ${req.user.id}`);

    res.json({
      success: true,
      message: 'All notifications marked as read',
      count: result.rows.length
    });
  } catch (err) {
    console.error('❌ Mark all as read error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Create notification (admin only)
const createNotification = async (req, res) => {
  try {
    // Check if user is admin
    const userCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    if (!userCheck.rows[0]?.is_admin) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    
    const { user_id, title, message, type } = req.body;

    if (!user_id || !title || !message) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide user_id, title, and message' 
      });
    }

    const result = await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id, title, message, type || 'info']
    );

    console.log(`✅ Notification created for user ${user_id}`);

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      notification: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Create notification error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + err.message 
    });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Notification not found' 
      });
    }

    console.log(`✅ Notification ${id} deleted for user ${userId}`);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (err) {
    console.error('❌ Delete notification error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Clear all notifications
const clearAllNotifications = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM notifications WHERE user_id = $1 RETURNING *',
      [req.user.id]
    );

    console.log(`✅ All notifications cleared for user ${req.user.id}`);

    res.json({
      success: true,
      message: 'All notifications cleared',
      count: result.rows.length
    });
  } catch (err) {
    console.error('❌ Clear all notifications error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Get notification settings
const getNotificationSettings = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notification_settings WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        settings: {
          order_updates: true,
          promotions: true,
          newsletters: true
        }
      });
    }

    res.json({
      success: true,
      settings: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Get notification settings error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Update notification settings
const updateNotificationSettings = async (req, res) => {
  try {
    const { order_updates, promotions, newsletters } = req.body;

    // Create notification_settings table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        order_updates BOOLEAN DEFAULT true,
        promotions BOOLEAN DEFAULT true,
        newsletters BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const result = await pool.query(
      `INSERT INTO notification_settings (user_id, order_updates, promotions, newsletters)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         order_updates = EXCLUDED.order_updates,
         promotions = EXCLUDED.promotions,
         newsletters = EXCLUDED.newsletters,
         updated_at = NOW()
       RETURNING *`,
      [req.user.id, order_updates, promotions, newsletters]
    );

    res.json({
      success: true,
      message: 'Notification settings updated',
      settings: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Update notification settings error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error: ' + err.message 
    });
  }
};

module.exports = {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification,
  deleteNotification,
  clearAllNotifications,
  getNotificationSettings,
  updateNotificationSettings
};
