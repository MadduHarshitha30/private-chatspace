const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

const allowedAvatars = Array.from(
    { length: 15 },
    (_, index) => `/avatars/avatar-${String(index + 1).padStart(2, '0')}.png`
);

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return res.status(400).json({
                message: 'Username or email already exists'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            username,
            email,
            password: hashedPassword
        });

        res.status(201).json({
            message: 'Registration successful',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Registration failed' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar || '/avatars/avatar-01.png'
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Login failed' });
    }
});

router.put('/avatar', authMiddleware, async (req, res) => {
    try {
        const { avatar } = req.body;

        if (!allowedAvatars.includes(avatar)) {
            return res.status(400).json({ message: 'Invalid avatar selection' });
        }

        const user = await User.findByIdAndUpdate(
            req.userId,
            { avatar },
            { new: true }
        ).select('username email avatar');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            message: 'Avatar updated successfully',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update avatar' });
    }
});

module.exports = router;