const fs = require('fs');
const path = require('path');
const { getSupabase } = require('./supabase');

async function migrate() {
  const supabase = getSupabase();
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  console.log('Running BeaconOps database migration...');

  const { error } = await supabase.rpc('exec_sql', { sql_text: sql });

  if (error) {
    console.error('Migration failed:', error.message);
    console.log('Note: You may need to run schema.sql directly in Supabase SQL Editor');
    process.exit(1);
  }

  console.log('Migration completed successfully.');
}

if (require.main === module) {
  migrate().catch(console.error);
}

module.exports = { migrate };
