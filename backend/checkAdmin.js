// backend/checkAdmin.js
// Simple script to check if admin user exists and is configured correctly

const { query } = require('./config/database');

async function checkAdmin() {
  try {
    console.log('\n🔍 Checking Admin Users...\n');

    // Query all admin users
    const result = await query(
      `SELECT 
        id, 
        email, 
        phone, 
        full_name, 
        role, 
        is_verified, 
        is_active,
        created_at
      FROM users 
      WHERE role = 'admin'
      ORDER BY created_at DESC`
    );

    if (result.rows.length === 0) {
      console.log('❌ NO ADMIN USERS FOUND!');
      console.log('\n📝 To create an admin user, you can:');
      console.log('\n1. Update an existing user:');
      console.log('   UPDATE users SET role = \'admin\' WHERE email = \'your@email.com\';');
      console.log('\n2. Or run the createAdmin.js script');
      console.log('   node createAdmin.js\n');
    } else {
      console.log(`✅ Found ${result.rows.length} admin user(s):\n`);
      
      result.rows.forEach((admin, index) => {
        console.log(`Admin #${index + 1}:`);
        console.log(`  ID:         ${admin.id}`);
        console.log(`  Name:       ${admin.full_name}`);
        console.log(`  Email:      ${admin.email}`);
        console.log(`  Phone:      ${admin.phone}`);
        console.log(`  Role:       ${admin.role}`);
        console.log(`  Verified:   ${admin.is_verified ? '✅ Yes' : '❌ No'}`);
        console.log(`  Active:     ${admin.is_active ? '✅ Yes' : '❌ No'}`);
        console.log(`  Created:    ${admin.created_at}`);
        
        // Check for issues
        const issues = [];
        if (!admin.is_verified) issues.push('Not verified');
        if (!admin.is_active) issues.push('Not active');
        
        if (issues.length > 0) {
          console.log(`  ⚠️  Issues:  ${issues.join(', ')}`);
          console.log(`  💡 Fix:     UPDATE users SET is_verified = true, is_active = true WHERE id = '${admin.id}';`);
        } else {
          console.log(`  ✅ Status:  Ready to use!`);
        }
        
        console.log('');
      });

      console.log('🎉 Admin users are configured!\n');
      console.log('📌 Next steps:');
      console.log('1. Login at http://localhost:3000/login');
      console.log('2. Use the email/phone and password for the admin user');
      console.log('3. Navigate to http://localhost:3000/admin/dashboard\n');
    }

  } catch (error) {
    console.error('❌ Error checking admin users:', error.message);
    console.error('\n💡 Make sure:');
    console.error('   - Database is running');
    console.error('   - DATABASE_URL is correct in .env');
    console.error('   - Users table exists\n');
  } finally {
    process.exit(0);
  }
}

checkAdmin();