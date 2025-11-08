// backend/routes/categories.js
const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

// ============================================
// GET /api/categories
// Get all active categories
// ============================================
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, slug, icon, description, parent_id
       FROM categories
       WHERE is_active = true
       ORDER BY display_order ASC, name ASC`
    );

    res.json({
      success: true,
      data: { categories: result.rows }
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

// ============================================
// GET /api/categories/:slug
// Get category by slug
// ============================================
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await query(
      `SELECT * FROM categories WHERE slug = $1 AND is_active = true`,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      data: { category: result.rows[0] }
    });

  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: error.message
    });
  }
});

module.exports = router;