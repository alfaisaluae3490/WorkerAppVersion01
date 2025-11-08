// backend/routes/jobs.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// ============================================
// GET ALL JOBS (PUBLIC + FILTERED)
// ============================================
router.get('/', async (req, res) => {
  try {
    const { category, search, city, province, min_budget, max_budget, status = 'open', worker_city, worker_id } = req.query;
    
    let whereClause = 'j.status = $1';
    let params = [status];
    let paramIndex = 2;

 // WORKER SERVICE FILTERING: Only show jobs matching worker's services
    if (worker_id) {
      const workerResult = await query(
        `SELECT services FROM worker_profiles WHERE user_id = $1`,
        [worker_id]
      );

      if (workerResult.rows.length > 0) {
        const workerServices = workerResult.rows[0].services || [];
        
        if (workerServices.length > 0) {
          // Check if services are UUIDs or names
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workerServices[0]);
          
          if (isUUID) {
            // Services are UUIDs
            const categoryPlaceholders = workerServices.map((_, idx) => `$${paramIndex + idx}`).join(',');
            whereClause += ` AND j.category_id IN (${categoryPlaceholders})`;
            params.push(...workerServices);
            paramIndex += workerServices.length;
          } else {
            // Services are names - convert to category name matching
            const categoryPlaceholders = workerServices.map((_, idx) => `$${paramIndex + idx}`).join(',');
            whereClause += ` AND c.name IN (${categoryPlaceholders})`;
            params.push(...workerServices);
            paramIndex += workerServices.length;
          }
        } else {
          // Worker has no services set, return empty result
          return res.json({
            success: true,
            data: {
              jobs: [],
              message: 'Please add your service categories in your profile to see relevant jobs'
            }
          });
        }
      }
    }

    // CITY-BASED FILTERING: If worker_city is provided, only show jobs from that city
    if (worker_city) {
      whereClause += ` AND LOWER(j.city) = LOWER($${paramIndex})`;
      params.push(worker_city);
      paramIndex++;
    }

   if (category) {
      // Check if category is UUID or name
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category);
      if (isUUID) {
        whereClause += ` AND j.category_id = $${paramIndex}`;
        params.push(category);
      } else {
        whereClause += ` AND c.name ILIKE $${paramIndex}`;
        params.push(`%${category}%`);
      }
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (j.title ILIKE $${paramIndex} OR j.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (city) {
      whereClause += ` AND j.city ILIKE $${paramIndex}`;
      params.push(`%${city}%`);
      paramIndex++;
    }

    if (province) {
      whereClause += ` AND j.province ILIKE $${paramIndex}`;
      params.push(`%${province}%`);
      paramIndex++;
    }

    if (min_budget) {
      whereClause += ` AND j.budget_max >= $${paramIndex}`;
      params.push(parseFloat(min_budget));
      paramIndex++;
    }

    if (max_budget) {
      whereClause += ` AND j.budget_min <= $${paramIndex}`;
      params.push(parseFloat(max_budget));
      paramIndex++;
    }

    const result = await query(
      `SELECT 
        j.*,
        c.name as category_name,
        u.full_name as customer_name,
        (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bids_count
      FROM jobs j
      LEFT JOIN categories c ON j.category_id = c.id
      LEFT JOIN users u ON j.customer_id = u.id
      WHERE ${whereClause}
      ORDER BY j.created_at DESC`,
      params
    );

    res.json({
      success: true,
      data: {
        jobs: result.rows
      }
    });

  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs',
      error: error.message
    });
  }
});

// ============================================
// IMPORTANT: SPECIFIC ROUTES MUST COME BEFORE /:id
// ============================================

// ============================================
// GET /api/jobs/my-jobs
// Get jobs posted by current user
// ============================================
router.get('/my-jobs', verifyToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'j.customer_id = $1';
    let params = [req.user.id];

    if (status) {
      whereClause += ' AND j.status = $2';
      params.push(status);
    }

    const result = await query(
      `SELECT 
        j.*,
        c.name as category_name,
        bk.id as booking_id,
        (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bids_count,
        (SELECT COUNT(*) FROM bids WHERE job_id = j.id AND status = 'pending') as pending_bids
      FROM jobs j
      LEFT JOIN categories c ON j.category_id = c.id
      LEFT JOIN bookings bk ON j.id = bk.job_id
      WHERE ${whereClause}
      ORDER BY j.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: { jobs: result.rows }
    });

  } catch (error) {
    console.error('Get my jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs',
      error: error.message
    });
  }
});

// ============================================
// GET SINGLE JOB BY ID
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { worker_city } = req.query;

    const result = await query(
      `SELECT 
        j.*,
        c.name as category_name,
        u.full_name as customer_name,
        u.email as customer_email,
        u.phone as customer_phone,
        u.profile_picture as customer_picture,
        (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bids_count,
        (SELECT COUNT(*) FROM bids WHERE job_id = j.id AND status = 'pending') as pending_bids,
        bk.id as booking_id
      FROM jobs j
      LEFT JOIN categories c ON j.category_id = c.id
      LEFT JOIN users u ON j.customer_id = u.id
      LEFT JOIN bookings bk ON j.id = bk.job_id
      WHERE j.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    const job = result.rows[0];

    // CITY ACCESS CONTROL: If worker_city is provided, validate access
    if (worker_city && job.city) {
      if (worker_city.toLowerCase() !== job.city.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `This job is only available for workers in ${job.city}. You are in ${worker_city}.`,
          city_mismatch: true
        });
      }
    }

    res.json({
      success: true,
      data: {
        job: job
      }
    });

  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job',
      error: error.message
    });
  }
});

// ============================================
// CREATE NEW JOB
// ============================================
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      title,
      description,
      category_id,
      budget_min,
      budget_max,
      city,
      province,
      location_address,
      images,
      preferred_date,
      preferred_time
    } = req.body;

    // Validation
    if (!title || !description || !category_id || !city || !province) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, category, city and province are required'
      });
    }

    // Handle images - ensure proper format for JSONB column
    let imagesArray = null;
    if (images) {
      try {
        // If images is already an array, use it directly
        // If it's a string, parse it first
        let parsedImages;
        if (Array.isArray(images)) {
          parsedImages = images;
        } else if (typeof images === 'string') {
          parsedImages = JSON.parse(images);
        } else {
          parsedImages = [];
        }

        // Only store if array has items
        if (Array.isArray(parsedImages) && parsedImages.length > 0) {
          imagesArray = parsedImages;
        }
      } catch (parseError) {
        console.error('Image parsing error:', parseError);
        console.error('Received images data:', images);
        // If parsing fails, set to null to avoid database error
        imagesArray = null;
      }
    }

    const result = await query(
      `INSERT INTO jobs 
       (customer_id, title, description, category_id, budget_min, budget_max, city, province, location_address, images, preferred_date, preferred_time, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
       RETURNING *`,
      [
        req.user.id,
        title,
        description,
        category_id,
        budget_min || null,
        budget_max || null,
        city,
        province,
        location_address || null,
       imagesArray ? JSON.stringify(imagesArray) : null,
        preferred_date || null,
        preferred_time || null,
        'open'
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Job posted successfully',
      data: {
        job: result.rows[0]
      }
    });

  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create job',
      error: error.message
    });
  }
});

// ============================================
// UPDATE JOB
// ============================================
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      category_id,
      budget_min,
      budget_max,
      city,
      province,
      location_address,
      images,
      preferred_date,
      preferred_time
    } = req.body;

    // Check if job belongs to user
    const jobCheck = await query(
      'SELECT customer_id FROM jobs WHERE id = $1',
      [id]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (jobCheck.rows[0].customer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this job'
      });
    }

    // Handle images - same logic as create for JSONB column
    let imagesArray = null;
    if (images) {
      try {
        let parsedImages;
        if (Array.isArray(images)) {
          parsedImages = images;
        } else if (typeof images === 'string') {
          parsedImages = JSON.parse(images);
        } else {
          parsedImages = [];
        }

        if (Array.isArray(parsedImages) && parsedImages.length > 0) {
          imagesArray = parsedImages;
        }
      } catch (parseError) {
        console.error('Image parsing error on update:', parseError);
        imagesArray = null;
      }
    }

    const result = await query(
      `UPDATE jobs 
       SET title = $1, description = $2, category_id = $3, budget_min = $4, 
           budget_max = $5, city = $6, province = $7, location_address = $8, images = $9, 
           preferred_date = $10, preferred_time = $11, updated_at = NOW()
       WHERE id = $12 
       RETURNING *`,
      [
        title,
        description,
        category_id,
        budget_min,
        budget_max,
        city,
        province,
        location_address,
        imagesArray,
        preferred_date || null,
        preferred_time || null,
        id
      ]
    );

    res.json({
      success: true,
      message: 'Job updated successfully',
      data: {
        job: result.rows[0]
      }
    });

  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job',
      error: error.message
    });
  }
});

// ============================================
// DELETE JOB
// ============================================
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if job belongs to user
    const jobCheck = await query(
      'SELECT customer_id, status FROM jobs WHERE id = $1',
      [id]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (jobCheck.rows[0].customer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this job'
      });
    }

    // Don't allow deletion of assigned/completed jobs
    if (['assigned', 'completed'].includes(jobCheck.rows[0].status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete jobs that are assigned or completed'
      });
    }

    await query('DELETE FROM jobs WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });

  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete job',
      error: error.message
    });
  }
});

// ============================================
// UPDATE JOB STATUS
// ============================================
router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['open', 'assigned', 'in_progress', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Check if job belongs to user
    const jobCheck = await query(
      'SELECT customer_id FROM jobs WHERE id = $1',
      [id]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (jobCheck.rows[0].customer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this job'
      });
    }

    const result = await query(
      `UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    res.json({
      success: true,
      message: 'Job status updated successfully',
      data: {
        job: result.rows[0]
      }
    });

  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job status',
      error: error.message
    });
  }
});

module.exports = router;