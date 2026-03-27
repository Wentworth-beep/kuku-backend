const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');

// Get user profile
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await pool.query(
            'SELECT id, full_name, email, phone, location, created_at FROM users WHERE id = $1',
            [req.user.id]
        );
        
        if (user.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        res.json({ success: true, user: user.rows[0] });
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get user notifications
router.get('/notifications', auth, async (req, res) => {
    try {
        const notifications = await pool.query(
            'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );
        
        res.json({ success: true, notifications: notifications.rows });
    } catch (err) {
        console.error('Get notifications error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Mark notification as read
router.put('/notifications/:id/read', auth, async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );
        
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (err) {
        console.error('Mark notification read error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get user favorites
router.get('/favorites', auth, async (req, res) => {
    try {
        const favorites = await pool.query(
            `SELECT p.* FROM products p 
             INNER JOIN favorites f ON p.id = f.product_id 
             WHERE f.user_id = $1 
             ORDER BY f.created_at DESC`,
            [req.user.id]
        );
        
        res.json({ success: true, favorites: favorites.rows });
    } catch (err) {
        console.error('Get favorites error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add to favorites
router.post('/favorites/:productId', auth, async (req, res) => {
    try {
        const existing = await pool.query(
            'SELECT * FROM favorites WHERE user_id = $1 AND product_id = $2',
            [req.user.id, req.params.productId]
        );
        
        if (existing.rows.length > 0) {
            await pool.query(
                'DELETE FROM favorites WHERE user_id = $1 AND product_id = $2',
                [req.user.id, req.params.productId]
            );
            res.json({ success: true, favorited: false });
        } else {
            await pool.query(
                'INSERT INTO favorites (user_id, product_id) VALUES ($1, $2)',
                [req.user.id, req.params.productId]
            );
            res.json({ success: true, favorited: true });
        }
    } catch (err) {
        console.error('Toggle favorite error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;