const { describe, it } = require('node:test');
const assert = require('node:assert');

const { listAgents, registry } = require('../agents/registry');
const BaseAgent = require('../agents/base-agent');
const products = require('../config/products');
const config = require('../config');
const schedule = require('../config/schedule');

describe('Agent Registry', () => {
  it('should have 16 agents registered', () => {
    const agents = listAgents();
    assert.strictEqual(agents.length, 16);
  });

  it('should have unique agent IDs', () => {
    const agents = listAgents();
    const ids = agents.map(a => a.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(uniqueIds.size, ids.length);
  });

  it('should have all required fields for each agent', () => {
    const agents = listAgents();
    for (const agent of agents) {
      assert.ok(agent.id, `Agent missing id`);
      assert.ok(agent.name, `Agent ${agent.id} missing name`);
      assert.ok(agent.domain, `Agent ${agent.id} missing domain`);
      assert.ok(agent.cycle, `Agent ${agent.id} missing cycle`);
      assert.strictEqual(typeof agent.essential, 'boolean', `Agent ${agent.id} essential must be boolean`);
      assert.strictEqual(typeof agent.criticalOnFailure, 'boolean', `Agent ${agent.id} criticalOnFailure must be boolean`);
    }
  });

  it('should have essential agents marked correctly', () => {
    const essentialAgents = listAgents().filter(a => a.essential);
    const essentialIds = essentialAgents.map(a => a.id).sort();
    assert.deepStrictEqual(essentialIds, ['inbox-monitor', 'infrastructure-monitor', 'user-lifecycle']);
  });

  it('should have critical-on-failure agents marked correctly', () => {
    const criticalAgents = listAgents().filter(a => a.criticalOnFailure);
    const criticalIds = criticalAgents.map(a => a.id).sort();
    assert.deepStrictEqual(criticalIds, ['inbox-monitor', 'infrastructure-monitor', 'qa-playtest']);
  });
});

describe('Products Configuration', () => {
  it('should have 3 products defined', () => {
    const productIds = Object.keys(products);
    assert.strictEqual(productIds.length, 3);
    assert.ok(productIds.includes('chronostates'));
    assert.ok(productIds.includes('payroll_beacon'));
    assert.ok(productIds.includes('budgeting_beacon'));
  });

  it('should have brand voice config for each product', () => {
    for (const [id, product] of Object.entries(products)) {
      assert.ok(product.voice, `${id} missing voice config`);
      assert.ok(product.voice.tone, `${id} missing voice tone`);
      assert.ok(Array.isArray(product.voice.keywords), `${id} keywords must be array`);
      assert.ok(Array.isArray(product.voice.prohibited), `${id} prohibited must be array`);
      assert.ok(Array.isArray(product.voice.hashtagSets), `${id} hashtagSets must be array`);
    }
  });

  it('should only enable competitor tracking for Payroll Beacon', () => {
    assert.strictEqual(products.chronostates.competitorTracking, false);
    assert.strictEqual(products.payroll_beacon.competitorTracking, true);
    assert.strictEqual(products.budgeting_beacon.competitorTracking, false);
  });

  it('should only enable Substack for ChronoStates', () => {
    assert.strictEqual(products.chronostates.hasSubstack, true);
    assert.strictEqual(products.payroll_beacon.hasSubstack, false);
    assert.strictEqual(products.budgeting_beacon.hasSubstack, false);
  });
});

describe('Schedule Configuration', () => {
  it('should have continuous, daily, weekly, and event-driven schedules', () => {
    assert.ok(Array.isArray(schedule.continuous));
    assert.ok(Array.isArray(schedule.daily));
    assert.ok(Array.isArray(schedule.weekly));
    assert.ok(Array.isArray(schedule.eventDriven));
    assert.ok(schedule.dailyReport);
  });

  it('should have all scheduled agents in the registry', () => {
    const allScheduled = [
      ...schedule.continuous.map(s => s.agentId),
      ...schedule.daily.map(s => s.agentId),
      ...schedule.weekly.map(s => s.agentId),
      ...schedule.eventDriven.map(s => s.agentId),
    ];

    for (const agentId of allScheduled) {
      assert.ok(registry[agentId], `Scheduled agent ${agentId} not in registry`);
    }
  });

  it('daily report should be at 10 AM', () => {
    assert.strictEqual(schedule.dailyReport.cron, '0 10 * * *');
  });
});

describe('Config', () => {
  it('should have approval slider defaults', () => {
    assert.strictEqual(config.approvalSlider.default, 60);
    assert.ok(config.approvalSlider.tiers.maxOversight);
    assert.ok(config.approvalSlider.tiers.cautious);
    assert.ok(config.approvalSlider.tiers.balanced);
    assert.ok(config.approvalSlider.tiers.aggressive);
  });

  it('should have 3 products listed', () => {
    assert.strictEqual(config.products.length, 3);
  });

  it('should have agent retry config', () => {
    assert.strictEqual(config.agents.retryAttempts, 3);
    assert.strictEqual(config.agents.timezone, 'America/New_York');
  });
});
