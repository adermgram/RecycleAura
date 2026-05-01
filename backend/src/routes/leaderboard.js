const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Item = require('../models/Item');

// Get global leaderboard (all-time points)
router.get('/global', async (req, res) => {
  try {
    const topUsers = await User.find({})
      .sort({ points: -1 })
      .limit(10)
      .select('name username points -_id');

    res.json({ leaderboard: topUsers, period: 'all-time' });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leaderboard', error: error.message });
  }
});

// Get monthly leaderboard (points earned this calendar month)
router.get('/monthly', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const results = await Item.aggregate([
      { $match: { isUsed: true, usedAt: { $gte: startOfMonth } } },
      { $group: { _id: '$usedBy', points: { $sum: '$points' } } },
      { $sort: { points: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { $project: { _id: 0, name: '$user.name', username: '$user.username', points: 1 } }
    ]);

    res.json({ leaderboard: results, period: 'monthly' });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching monthly leaderboard', error: error.message });
  }
});

// Get weekly leaderboard (points earned since last Sunday)
router.get('/weekly', async (req, res) => {
  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const results = await Item.aggregate([
      { $match: { isUsed: true, usedAt: { $gte: startOfWeek } } },
      { $group: { _id: '$usedBy', points: { $sum: '$points' } } },
      { $sort: { points: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { $project: { _id: 0, name: '$user.name', username: '$user.username', points: 1 } }
    ]);

    res.json({ leaderboard: results, period: 'weekly' });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching weekly leaderboard', error: error.message });
  }
});

// Get user's rank
router.get('/my-rank', auth, async (req, res) => {
  try {
    const usersWithMorePoints = await User.countDocuments({
      points: { $gt: req.user.points }
    });

    res.json({
      rank: usersWithMorePoints + 1,
      points: req.user.points,
      name: req.user.name
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user rank', error: error.message });
  }
});

module.exports = router;
