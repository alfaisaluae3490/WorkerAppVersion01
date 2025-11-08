// backend/scripts/seedCategories.js
const { query } = require('../config/database');

const categories = [
  { name: 'Plumbing', slug: 'plumbing', icon: '🔧', description: 'Pipe repairs, installations, and maintenance' },
  { name: 'Electrical', slug: 'electrical', icon: '⚡', description: 'Wiring, fixtures, and electrical repairs' },
  { name: 'Cleaning', slug: 'cleaning', icon: '🧹', description: 'Home and office cleaning services' },
  { name: 'Carpentry', slug: 'carpentry', icon: '🔨', description: 'Furniture making and wood repairs' },
  { name: 'Painting', slug: 'painting', icon: '🎨', description: 'Interior and exterior painting' },
  { name: 'Gardening', slug: 'gardening', icon: '🌱', description: 'Lawn care and landscaping' },
  { name: 'Moving', slug: 'moving', icon: '📦', description: 'Packing and moving services' },
  { name: 'AC Repair', slug: 'ac-repair', icon: '❄️', description: 'Air conditioning installation and repair' },
  { name: 'Appliance Repair', slug: 'appliance-repair', icon: '🔌', description: 'Fixing household appliances' },
  { name: 'Handyman', slug: 'handyman', icon: '🛠️', description: 'General maintenance and repairs' },
  { name: 'Locksmith', slug: 'locksmith', icon: '🔐', description: 'Lock installation and key services' },
  { name: 'Pest Control', slug: 'pest-control', icon: '🐛', description: 'Insect and rodent elimination' },
  { name: 'Roofing', slug: 'roofing', icon: '🏠', description: 'Roof repairs and installation' },
  { name: 'Flooring', slug: 'flooring', icon: '📏', description: 'Floor installation and refinishing' },
  { name: 'Masonry', slug: 'masonry', icon: '🧱', description: 'Brick and concrete work' },
];

async function seedCategories() {
  try {
    console.log('🌱 Starting to seed categories...');

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      
      // Check if category already exists
      const existing = await query(
        'SELECT id FROM categories WHERE slug = $1',
        [cat.slug]
      );

      if (existing.rows.length === 0) {
        await query(
          `INSERT INTO categories (name, slug, icon, description, display_order, is_active)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [cat.name, cat.slug, cat.icon, cat.description, i + 1]
        );
        console.log(`✅ Added category: ${cat.name}`);
      } else {
        console.log(`⏭️  Category already exists: ${cat.name}`);
      }
    }

    console.log('🎉 Categories seeded successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    process.exit(1);
  }
}

seedCategories();