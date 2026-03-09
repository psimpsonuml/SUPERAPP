const { getSupabase } = require('./supabase');
const products = require('../config/products');

async function seed() {
  const supabase = getSupabase();
  console.log('Seeding BeaconOps database...');

  // Create default account
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .upsert({
      id: '00000000-0000-0000-0000-000000000001',
      name: 'BeaconOps Personal',
      plan: 'personal',
      slider_position: 60,
      reduced_ops: false,
      escalation_window_minutes: 120,
    }, { onConflict: 'id' })
    .select()
    .single();

  if (accountError) {
    console.error('Failed to create account:', accountError.message);
    return;
  }

  const accountId = account.id;
  console.log(`Account created: ${accountId}`);

  // Seed brand profiles
  for (const [productId, product] of Object.entries(products)) {
    await supabase.from('brand_profiles').upsert({
      account_id: accountId,
      product: productId,
      voice_config: product.voice,
      language_settings: product.voice.localization,
      hashtag_sets: product.voice.hashtagSets,
      prohibited_phrases: product.voice.prohibited,
      emoji_policy: product.voice.emojiPolicy,
    }, { onConflict: 'account_id,product' });
    console.log(`Brand profile seeded: ${product.name}`);
  }

  // Seed seasonal events
  const events = [
    // Payroll Beacon events
    { event_name: 'Tax Season', start_date: '2026-01-15', end_date: '2026-04-15', products: ['payroll_beacon'], content_themes: ['tax filing', 'W-2 deadlines', 'compliance updates'], priority: 'high' },
    { event_name: 'Year-End Payroll', start_date: '2026-11-01', end_date: '2026-12-31', products: ['payroll_beacon'], content_themes: ['year-end close', 'bonus processing', 'W-2 prep'], priority: 'high' },
    { event_name: 'APA Congress', start_date: '2026-05-12', end_date: '2026-05-15', products: ['payroll_beacon'], content_themes: ['payroll industry', 'networking', 'compliance trends'], priority: 'normal' },

    // Budgeting Beacon events
    { event_name: 'New Year Resolutions', start_date: '2026-01-01', end_date: '2026-01-31', products: ['budgeting_beacon'], content_themes: ['financial goals', 'budget reset', 'money habits'], priority: 'high' },
    { event_name: 'Tax Refund Season', start_date: '2026-02-01', end_date: '2026-04-30', products: ['budgeting_beacon'], content_themes: ['tax refund planning', 'savings strategies', 'debt payoff'], priority: 'normal' },
    { event_name: 'Financial Literacy Month', start_date: '2026-04-01', end_date: '2026-04-30', products: ['budgeting_beacon'], content_themes: ['financial education', 'budgeting basics', 'money skills'], priority: 'high' },
    { event_name: 'Back to School', start_date: '2026-08-01', end_date: '2026-08-31', products: ['budgeting_beacon'], content_themes: ['school expenses', 'family budgeting', 'savings tips'], priority: 'normal' },
    { event_name: 'Holiday Spending', start_date: '2026-11-15', end_date: '2026-12-31', products: ['budgeting_beacon'], content_themes: ['holiday budgets', 'gift planning', 'avoid overspending'], priority: 'high' },

    // ChronoStates events
    { event_name: 'PAX East', start_date: '2026-03-19', end_date: '2026-03-22', products: ['chronostates'], content_themes: ['gaming culture', 'indie games', 'strategy gaming'], priority: 'normal' },
    { event_name: 'Gamescom', start_date: '2026-08-19', end_date: '2026-08-23', products: ['chronostates'], content_themes: ['gaming industry', 'alternate history gaming', 'new releases'], priority: 'normal' },
  ];

  for (const event of events) {
    await supabase.from('event_calendar').upsert({
      account_id: accountId,
      ...event,
    }, { ignoreDuplicates: true });
  }
  console.log(`Seasonal events seeded: ${events.length}`);

  // Seed sample keywords
  const keywords = [
    // ChronoStates
    { keyword: 'alternate history games', product_assigned: 'chronostates', search_volume_estimate: 2400, difficulty_estimate: 0.45 },
    { keyword: 'what if history simulator', product_assigned: 'chronostates', search_volume_estimate: 880, difficulty_estimate: 0.32 },
    { keyword: 'counterfactual history game', product_assigned: 'chronostates', search_volume_estimate: 590, difficulty_estimate: 0.28 },
    { keyword: 'historical strategy game online', product_assigned: 'chronostates', search_volume_estimate: 1900, difficulty_estimate: 0.55 },

    // Payroll Beacon
    { keyword: 'multi-state payroll compliance', product_assigned: 'payroll_beacon', search_volume_estimate: 1200, difficulty_estimate: 0.52 },
    { keyword: 'payroll tax calculator by state', product_assigned: 'payroll_beacon', search_volume_estimate: 6600, difficulty_estimate: 0.68 },
    { keyword: 'payroll compliance software', product_assigned: 'payroll_beacon', search_volume_estimate: 1800, difficulty_estimate: 0.61 },
    { keyword: 'state payroll tax rates 2026', product_assigned: 'payroll_beacon', search_volume_estimate: 4400, difficulty_estimate: 0.42 },

    // Budgeting Beacon
    { keyword: 'personal budget app', product_assigned: 'budgeting_beacon', search_volume_estimate: 8100, difficulty_estimate: 0.72 },
    { keyword: 'couples budgeting tool', product_assigned: 'budgeting_beacon', search_volume_estimate: 720, difficulty_estimate: 0.35 },
    { keyword: 'budget tracker free', product_assigned: 'budgeting_beacon', search_volume_estimate: 14800, difficulty_estimate: 0.78 },
    { keyword: 'how to start budgeting', product_assigned: 'budgeting_beacon', search_volume_estimate: 5400, difficulty_estimate: 0.48 },
  ];

  for (const kw of keywords) {
    await supabase.from('keyword_map').upsert({
      account_id: accountId,
      ...kw,
      status: 'available',
    }, { onConflict: 'account_id,keyword,product_assigned' });
  }
  console.log(`Keywords seeded: ${keywords.length}`);

  console.log('Seed completed successfully.');
}

if (require.main === module) {
  seed().catch(console.error);
}

module.exports = { seed };
