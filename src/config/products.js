const products = {
  chronostates: {
    id: 'chronostates',
    name: 'ChronoStates.io',
    domain: 'chronostates.io',
    description: 'Alternate history gaming/narrative platform',
    audience: 'Alternate history fans, strategy gamers, narrative enthusiasts, global audience',
    voice: {
      tone: 'Imaginative, epic, intellectually curious',
      keywords: ['Epic', 'speculative', 'immersive', 'provocative'],
      style: 'Narrative-driven, rich world-building language, speculative scenarios',
      prohibited: ['boring', 'simple game', 'just a game'],
      emojiPolicy: 'Minimal — thematic only (swords, maps, globes)',
      hashtagSets: [
        '#AlternateHistory', '#WhatIf', '#CounterfactualHistory',
        '#StrategyGaming', '#ChronoStates', '#HistoryRewritten',
        '#Worldbuilding', '#HistoricalFiction',
      ],
      localization: ['en', 'es', 'de', 'fr', 'ja', 'pt'],
    },
    platforms: ['reddit', 'facebook', 'discord', 'instagram', 'linkedin', 'tiktok', 'youtube', 'substack'],
    hasSubstack: true,
    competitorTracking: false,
  },

  payroll_beacon: {
    id: 'payroll_beacon',
    name: 'Payroll Beacon',
    domain: 'payrollbeacon.com',
    description: 'B2B payroll compliance SaaS',
    audience: 'Payroll pros, HR teams, CPAs, multi-state employers, payroll companies',
    voice: {
      tone: 'Authoritative, precise, practitioner-oriented',
      keywords: ['Compliance-first', 'data-driven', 'trustworthy', 'efficient'],
      style: 'Professional, data-backed, regulatory language, clear and concise',
      prohibited: ['confusing', 'complicated', 'guess', 'maybe'],
      emojiPolicy: 'None in professional content, minimal in social',
      hashtagSets: [
        '#PayrollCompliance', '#HRTech', '#MultiStatePayroll',
        '#PayrollBeacon', '#CPATools', '#PayrollSoftware',
        '#HRCompliance', '#PayrollManagement',
      ],
      localization: ['en'],
    },
    platforms: ['reddit', 'facebook', 'instagram', 'linkedin'],
    hasSubstack: false,
    competitorTracking: true,
  },

  budgeting_beacon: {
    id: 'budgeting_beacon',
    name: 'Budgeting Beacon',
    domain: 'budgetingbeacon.com',
    description: 'B2C personal finance platform',
    audience: 'Anyone managing personal finances globally',
    voice: {
      tone: 'Approachable, empowering, practical',
      keywords: ['Clear', 'actionable', 'supportive', 'no-jargon', 'empowerment-first'],
      style: 'Friendly, encouraging, practical tips, relatable examples',
      prohibited: ['complicated', 'impossible', 'you should have', 'obviously'],
      emojiPolicy: 'Light use — supportive emojis welcome',
      hashtagSets: [
        '#PersonalFinance', '#BudgetingTips', '#MoneyManagement',
        '#BudgetingBeacon', '#FinancialFreedom', '#DebtFree',
        '#SaveMoney', '#FinancialLiteracy',
      ],
      localization: ['en'],
    },
    platforms: ['reddit', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'],
    hasSubstack: false,
    competitorTracking: false,
  },
};

module.exports = products;
