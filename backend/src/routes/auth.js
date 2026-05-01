const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { sendWelcomeEmail } = require('../services/notificationService');
const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again after 15 minutes' }
});

// Register route
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, username, email, aadhaar, password, address } = req.body;

    const existingUser = await User.findOne({
      $or: [{ username }, { aadhaar }]
    });

    if (existingUser) {
      return res.status(400).json({
        message: existingUser.username === username
          ? 'Username already taken'
          : 'Ghana card number already registered'
      });
    }

    const user = new User({ name, username, email, aadhaar, password, address });
    await user.save();

    // Non-blocking welcome email
    sendWelcomeEmail(user).catch(() => {});

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        aadhaar: user.aadhaar,
        address: user.address,
        points: user.points,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

// Login route
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        aadhaar: user.aadhaar,
        points: user.points,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

module.exports = router;
