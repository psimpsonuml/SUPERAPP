const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

function generateTrackingCode(companyName) {
  const prefix = companyName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase();
  const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${suffix}`;
}

// GET /api/partners — list partners with filters and referral/revenue totals
router.get('/', async (req, res) => {
  try {
    const { type, status, product } = req.query;
    const accountId = req.accountId;

    // Fetch partners
    const { data: partners, error } = await safeQuery(async (supabase) => {
      let query = supabase.from('partners').select('*').eq('account_id', accountId);
      if (type) query = query.eq('partner_type', type);
      if (status) query = query.eq('status', status);
      return query.order('created_at', { ascending: false });
    });
    if (error) return res.status(500).json({ error: error.message });

    // Fetch referral totals per partner
    const { data: referrals } = await safeQuery(async (supabase) => {
      let query = supabase.from('partner_referrals').select('partner_id, subscription_value, commission_amount, commission_status, signup_date, product').eq('account_id', accountId);
      if (product) query = query.eq('product', product);
      return query;
    });

    const referralMap = {};
    (referrals || []).forEach((r) => {
      if (!referralMap[r.partner_id]) {
        referralMap[r.partner_id] = {
          total_referrals: 0,
          total_revenue: 0,
          commission_owed: 0,
          commission_paid: 0,
          last_referral: null,
        };
      }
      const entry = referralMap[r.partner_id];
      entry.total_referrals += 1;
      entry.total_revenue += parseFloat(r.subscription_value) || 0;
      if (r.commission_status === 'owed') entry.commission_owed += parseFloat(r.commission_amount) || 0;
      if (r.commission_status === 'paid') entry.commission_paid += parseFloat(r.commission_amount) || 0;
      if (!entry.last_referral || (r.signup_date && r.signup_date > entry.last_referral)) {
        entry.last_referral = r.signup_date;
      }
    });

    const enriched = (partners || []).map((p) => ({
      ...p,
      ...(referralMap[p.id] || {
        total_referrals: 0,
        total_revenue: 0,
        commission_owed: 0,
        commission_paid: 0,
        last_referral: null,
      }),
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/partners/summary/commissions — commission summary
router.get('/summary/commissions', async (req, res) => {
  try {
    const accountId = req.accountId;
    const { data: referrals } = await safeQuery(async (supabase) =>
      supabase.from('partner_referrals').select('commission_amount, commission_status').eq('account_id', accountId)
    );

    const summary = { total_owed: 0, total_invoiced: 0, total_paid: 0 };
    (referrals || []).forEach((r) => {
      const amt = parseFloat(r.commission_amount) || 0;
      if (r.commission_status === 'owed') summary.total_owed += amt;
      else if (r.commission_status === 'invoiced') summary.total_invoiced += amt;
      else if (r.commission_status === 'paid') summary.total_paid += amt;
    });

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/partners/export — export commission report as CSV
router.get('/export', async (req, res) => {
  try {
    const accountId = req.accountId;

    const { data: partners } = await safeQuery(async (supabase) =>
      supabase.from('partners').select('*').eq('account_id', accountId).order('company_name')
    );

    const { data: referrals } = await safeQuery(async (supabase) =>
      supabase.from('partner_referrals').select('*').eq('account_id', accountId)
    );

    const referralMap = {};
    (referrals || []).forEach((r) => {
      if (!referralMap[r.partner_id]) {
        referralMap[r.partner_id] = { total_referrals: 0, total_revenue: 0, commission_owed: 0, commission_invoiced: 0, commission_paid: 0 };
      }
      const entry = referralMap[r.partner_id];
      entry.total_referrals += 1;
      entry.total_revenue += parseFloat(r.subscription_value) || 0;
      const amt = parseFloat(r.commission_amount) || 0;
      if (r.commission_status === 'owed') entry.commission_owed += amt;
      else if (r.commission_status === 'invoiced') entry.commission_invoiced += amt;
      else if (r.commission_status === 'paid') entry.commission_paid += amt;
    });

    const header = 'Company,Type,Status,Total Referrals,Total Revenue,Commission Owed,Commission Invoiced,Commission Paid\n';
    const rows = (partners || []).map((p) => {
      const stats = referralMap[p.id] || { total_referrals: 0, total_revenue: 0, commission_owed: 0, commission_invoiced: 0, commission_paid: 0 };
      return `"${p.company_name}","${p.partner_type}","${p.status}",${stats.total_referrals},${stats.total_revenue.toFixed(2)},${stats.commission_owed.toFixed(2)},${stats.commission_invoiced.toFixed(2)},${stats.commission_paid.toFixed(2)}`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="partner_commissions.csv"');
    res.send(header + rows.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/partners/:id — partner detail with referral history and payment log
router.get('/:id', async (req, res) => {
  try {
    const accountId = req.accountId;
    const { id } = req.params;

    const { data: partners, error } = await safeQuery(async (supabase) =>
      supabase.from('partners').select('*').eq('id', id).eq('account_id', accountId)
    );
    if (error) return res.status(500).json({ error: error.message });
    if (!partners || partners.length === 0) return res.status(404).json({ error: 'Partner not found' });

    const { data: referrals } = await safeQuery(async (supabase) =>
      supabase.from('partner_referrals').select('*').eq('partner_id', id).eq('account_id', accountId).order('created_at', { ascending: false })
    );

    const { data: payments } = await safeQuery(async (supabase) =>
      supabase.from('partner_payments').select('*').eq('partner_id', id).eq('account_id', accountId).order('created_at', { ascending: false })
    );

    res.json({
      ...partners[0],
      referrals: referrals || [],
      payments: payments || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/partners — create partner with auto-generated tracking code
router.post('/', async (req, res) => {
  try {
    const accountId = req.accountId;
    const { company_name, contact_name, contact_email, partner_type, products, commission_structure_json, payment_terms, agreement_date } = req.body;

    if (!company_name) return res.status(400).json({ error: 'company_name is required' });

    const tracking_code = generateTrackingCode(company_name);

    const { data, error } = await safeQuery(async (supabase) =>
      supabase.from('partners').insert({
        account_id: accountId,
        company_name,
        contact_name: contact_name || '',
        contact_email: contact_email || '',
        partner_type: partner_type || 'affiliate',
        products: products || [],
        commission_structure_json: commission_structure_json || {},
        payment_terms: payment_terms || '',
        agreement_date: agreement_date || null,
        tracking_code,
        status: 'active',
      }).select()
    );
    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/partners/:id — update partner
router.put('/:id', async (req, res) => {
  try {
    const accountId = req.accountId;
    const { id } = req.params;
    const updates = req.body;
    delete updates.id;
    delete updates.account_id;
    delete updates.created_at;

    const { data, error } = await safeQuery(async (supabase) =>
      supabase.from('partners').update(updates).eq('id', id).eq('account_id', accountId).select()
    );
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Partner not found' });

    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/partners/:id — deactivate partner (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const accountId = req.accountId;
    const { id } = req.params;

    const { data, error } = await safeQuery(async (supabase) =>
      supabase.from('partners').update({ status: 'ended' }).eq('id', id).eq('account_id', accountId).select()
    );
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Partner not found' });

    res.json({ message: 'Partner deactivated', partner: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/partners/:id/referrals — list referrals for a partner
router.get('/:id/referrals', async (req, res) => {
  try {
    const accountId = req.accountId;
    const { id } = req.params;

    const { data, error } = await safeQuery(async (supabase) =>
      supabase.from('partner_referrals').select('*').eq('partner_id', id).eq('account_id', accountId).order('created_at', { ascending: false })
    );
    if (error) return res.status(500).json({ error: error.message });

    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/partners/:id/referrals — add referral
router.post('/:id/referrals', async (req, res) => {
  try {
    const accountId = req.accountId;
    const { id } = req.params;
    const { referred_email, product, signup_date, subscription_value, commission_amount, stripe_customer_id } = req.body;

    if (!product) return res.status(400).json({ error: 'product is required' });

    const { data, error } = await safeQuery(async (supabase) =>
      supabase.from('partner_referrals').insert({
        account_id: accountId,
        partner_id: id,
        referred_email: referred_email || '',
        product,
        signup_date: signup_date || new Date().toISOString().split('T')[0],
        subscription_value: subscription_value || 0,
        commission_amount: commission_amount || 0,
        commission_status: 'owed',
        stripe_customer_id: stripe_customer_id || '',
      }).select()
    );
    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/partners/:id/payments — payment history
router.get('/:id/payments', async (req, res) => {
  try {
    const accountId = req.accountId;
    const { id } = req.params;

    const { data, error } = await safeQuery(async (supabase) =>
      supabase.from('partner_payments').select('*').eq('partner_id', id).eq('account_id', accountId).order('created_at', { ascending: false })
    );
    if (error) return res.status(500).json({ error: error.message });

    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/partners/:id/payments — record payment
router.post('/:id/payments', async (req, res) => {
  try {
    const accountId = req.accountId;
    const { id } = req.params;
    const { amount, period, status: payStatus } = req.body;

    if (!amount) return res.status(400).json({ error: 'amount is required' });

    const isPaid = payStatus === 'paid';
    const { data, error } = await safeQuery(async (supabase) =>
      supabase.from('partner_payments').insert({
        account_id: accountId,
        partner_id: id,
        amount,
        period: period || '',
        status: isPaid ? 'paid' : 'pending',
        paid_at: isPaid ? new Date().toISOString() : null,
      }).select()
    );
    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/partners/referrals/:refId/status — update commission status
router.put('/referrals/:refId/status', async (req, res) => {
  try {
    const accountId = req.accountId;
    const { refId } = req.params;
    const { commission_status } = req.body;

    if (!commission_status || !['owed', 'invoiced', 'paid'].includes(commission_status)) {
      return res.status(400).json({ error: 'Valid commission_status required: owed, invoiced, paid' });
    }

    const { data, error } = await safeQuery(async (supabase) =>
      supabase.from('partner_referrals').update({ commission_status }).eq('id', refId).eq('account_id', accountId).select()
    );
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Referral not found' });

    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/partners/:id/draft-update — draft monthly partner update email using Claude API (stub)
router.post('/:id/draft-update', async (req, res) => {
  try {
    const accountId = req.accountId;
    const { id } = req.params;

    // Fetch partner info
    const { data: partners } = await safeQuery(async (supabase) =>
      supabase.from('partners').select('*').eq('id', id).eq('account_id', accountId)
    );
    if (!partners || partners.length === 0) return res.status(404).json({ error: 'Partner not found' });

    const partner = partners[0];

    // Fetch recent referrals
    const { data: referrals } = await safeQuery(async (supabase) =>
      supabase.from('partner_referrals').select('*').eq('partner_id', id).eq('account_id', accountId).order('created_at', { ascending: false }).limit(20)
    );

    // Stub: In production, this would call the Claude API to generate the email
    const totalReferrals = (referrals || []).length;
    const totalCommission = (referrals || []).reduce((sum, r) => sum + (parseFloat(r.commission_amount) || 0), 0);

    const draftEmail = {
      subject: `Monthly Partner Update - ${partner.company_name}`,
      body: `Hi ${partner.contact_name || 'Partner'},\n\nHere is your monthly update:\n\n- Total Referrals: ${totalReferrals}\n- Total Commission: $${totalCommission.toFixed(2)}\n\nThank you for your continued partnership.\n\nBest regards,\nBeaconOps Team`,
      partner_id: id,
      generated_at: new Date().toISOString(),
    };

    res.json(draftEmail);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
