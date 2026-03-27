const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');

// Dashboard stats (admin only)
router.get('/', auth, async (req, res) => {
    try {
        const user = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
        
        if (!user.rows[0]?.is_admin) {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM orders) as total_orders,
                (SELECT COUNT(*) FROM orders WHERE status = 'pending') as pending_orders,
                (SELECT COUNT(*) FROM orders WHERE status = 'completed') as completed_orders,
                (SELECT COUNT(*) FROM products) as total_products,
                (SELECT COUNT(*) FROM users WHERE is_admin = false) as total_customers
        `);
        
        res.json({ success: true, stats: stats.rows[0] });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
