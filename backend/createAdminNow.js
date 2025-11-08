// backend/createAdminNow.js
// Run this script to create admin user with password "admin123"

const bcrypt = require('bcryptjs');
const { query } = require('./config/database');

async function createAdmin() {
  try {
    console.log('\n🔧 Creating Admin User...\n');

    // Generate fresh password hash
    const password = 'admin123';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    console.log('Password:', password);
    console.log('Hash generated:', passwordHash);
    console.log('Salt rounds:', 10);
    console.log('');

    // First, check if admin exists
    const checkAdmin = await query(
      'SELECT id, email, role FROM users WHERE email = $1',
      ['admin@gworkerapp.com']
    );

    if (checkAdmin.rows.length > 0) {
      console.log('⚠️  Admin user already exists, updating password...\n');
      
      // Update existing admin
      const updateResult = await query(
        `UPDATE users 
         SET password_hash = $1, 
             role = 'admin', 
             is_verified = true, 
             is_active = true,
             phone = '+971501234567',
             updated_at = NOW()
         WHERE email = 'admin@gworkerapp.com'
         RETURNING id, email, full_name, role, is_verified, is_active`,
        [passwordHash]
      );

      const user = updateResult.rows[0];
      
      console.log('✅ Admin User Updated Successfully!\n');
      console.log('User Details:');
      console.log('─────────────────────────────────');
      console.log('ID:        ', user.id);
      console.log('Email:     ', user.email);
      console.log('Name:      ', user.full_name);
      console.log('Role:      ', user.role);
      console.log('Verified:  ', user.is_verified ? '✅ Yes' : '❌ No');
      console.log('Active:    ', user.is_active ? '✅ Yes' : '❌ No');
      console.log('─────────────────────────────────\n');
      
    } else {
      console.log('📝 Creating new admin user...\n');
      
      // Create new admin user
      const result = await query(
        `INSERT INTO users (
          email, 
          phone, 
          password_hash, 
          full_name, 
          role, 
          is_verified, 
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, email, full_name, role, is_verified, is_active`,
        [
          'admin@gworkerapp.com',
          '+971501234567',
          passwordHash,
          'Platform Administrator',
          'admin',
          true,
          true
        ]
      );

      const user = result.rows[0];

      console.log('✅ Admin User Created Successfully!\n');
      console.log('User Details:');
      console.log('─────────────────────────────────');
      console.log('ID:        ', user.id);
      console.log('Email:     ', user.email);
      console.log('Name:      ', user.full_name);
      console.log('Role:      ', user.role);
      console.log('Verified:  ', user.is_verified ? '✅ Yes' : '❌ No');
      console.log('Active:    ', user.is_active ? '✅ Yes' : '❌ No');
      console.log('─────────────────────────────────\n');
    }

    // Test password verification
    console.log('🧪 Testing password verification...');
    const testUser = await query(
      'SELECT id, password_hash FROM users WHERE email = $1',
      ['admin@gworkerapp.com']
    );
    
    if (testUser.rows.length > 0) {
      const isMatch = await bcrypt.compare(password, testUser.rows[0].password_hash);
      if (isMatch) {
        console.log('✅ Password verification test: PASSED\n');
      } else {
        console.log('❌ Password verification test: FAILED\n');
        console.log('⚠️  There may be an issue with bcrypt. Try deleting node_modules and reinstalling.\n');
      }
    }

    console.log('🎉 LOGIN CREDENTIALS:\n');
    console.log('Email:    admin@gworkerapp.com');
    console.log('Password: admin123\n');

    console.log('📍 Next Steps:');
    console.log('1. Go to: http://localhost:3000/login');
    console.log('2. Clear browser storage: localStorage.clear() in console');
    console.log('3. Login with the credentials above');
    console.log('4. Navigate to: http://localhost:3000/admin/dashboard\n');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    console.error('\nFull error:', error);
    
    if (error.code === '23505') {
      console.log('\n💡 User email already exists. The update should have worked.');
    } else if (error.code === '42P01') {
      console.log('\n💡 Table does not exist. Please run the database schema first.');
    } else {
      console.error('\n💡 Make sure:');
      console.error('   - Database is running');
      console.error('   - DATABASE_URL is correct in .env');
      console.error('   - Users table exists');
      console.error('   - You have run: npm install bcryptjs\n');
    }
  } finally {
    process.exit(0);
  }
}

createAdmin();