// backend/routes/locations.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// Get all provinces
router.get('/provinces', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, capital FROM provinces WHERE is_active = true ORDER BY name ASC'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching provinces:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch provinces',
      error: error.message
    });
  }
});

// Get all cities
router.get('/cities', async (req, res) => {
  try {
    const { province, search } = req.query;

    let whereClause = 'c.is_active = true';
    let params = [];
    let paramIndex = 1;

    if (province) {
      whereClause += ` AND c.province_id = $${paramIndex}`;
      params.push(province);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND c.name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await query(
      `SELECT c.name, c.province_id as province, p.name as province_name
       FROM cities c
       JOIN provinces p ON c.province_id = p.id
       WHERE ${whereClause}
       ORDER BY c.name ASC`,
      params
    );

    // Format response to match old structure {name, province}
    const cities = result.rows.map(row => ({
      name: row.name,
      province: row.province
    }));

    res.json({
      success: true,
      data: cities
    });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cities',
      error: error.message
    });
  }
});

// Get province for a city
router.get('/cities/:cityName/province', async (req, res) => {
  try {
    const { cityName } = req.params;
    
    const result = await query(
      `SELECT c.name as city_name, p.id, p.name, p.capital
       FROM cities c
       JOIN provinces p ON c.province_id = p.id
       WHERE LOWER(c.name) = LOWER($1) AND c.is_active = true
       LIMIT 1`,
      [cityName]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'City not found'
      });
    }

    const row = result.rows[0];

    res.json({
      success: true,
      data: {
        city: row.city_name,
        province: {
          id: row.id,
          name: row.name,
          capital: row.capital
        }
      }
    });
  } catch (error) {
    console.error('Error fetching province for city:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch province',
      error: error.message
    });
  }
});

module.exports = router;