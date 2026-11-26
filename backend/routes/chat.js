const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/users', authMiddleware, async (req, res) => {
    try {
        const users = await User.find({
            _id: { $ne: req.userId }
        }).select('username email');

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

router.get('/messages/:userId', authMiddleware, async (req, res) => {
    try {
        const otherUserId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        const otherUser = await User.findById(otherUserId);

        if (!otherUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const messages = await Message.find({
            $or: [
                { sender: req.userId, receiver: otherUserId },
                { sender: otherUserId, receiver: req.userId }
            ],
            hiddenFor: { $ne: req.userId }
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch messages' });
    }
});

router.delete('/messages/:userId', authMiddleware, async (req, res) => {
    try {
        const otherUserId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        const otherUser = await User.findById(otherUserId);

        if (!otherUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        await Message.updateMany(
            {
                $or: [
                    { sender: req.userId, receiver: otherUserId },
                    { sender: otherUserId, receiver: req.userId }
                ]
            },
            {
                $addToSet: { hiddenFor: req.userId }
            }
        );

        res.json({ message: 'Chat deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete chat' });
    }
});

module.exports = router;