const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');

// Get user notifications
router.get('/', auth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, title, message, type, read as is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
            [req.user.id]
        );
        
        res.json({
            success: true,
            count: result.rows.length,
            notifications: result.rows
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Mark notification as read - FIXED to stay read
router.put('/:id/read', auth, async (req, res) => {
    try {
        const result = await pool.query(
            'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }
        
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification read:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Mark all notifications as read - FIXED
router.put('/read-all', auth, async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET read = true WHERE user_id = $1',
            [req.user.id]
        );
        
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications read:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;