-- BeaconBot AI Chatbot Schema
-- Conversations and actions for the BeaconOps AI assistant

CREATE TABLE IF NOT EXISTS beaconbot_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  context TEXT DEFAULT 'dashboard' CHECK (context IN ('dashboard','chronostates','payroll_beacon','budgeting_beacon')),
  title TEXT DEFAULT 'New Conversation',
  messages_json JSONB DEFAULT '[]',
  model_used TEXT DEFAULT 'auto',
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS beaconbot_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  conversation_id UUID REFERENCES beaconbot_conversations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_details_json JSONB DEFAULT '{}',
  result_json JSONB DEFAULT '{}',
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beaconbot_convos_account ON beaconbot_conversations(account_id);
CREATE INDEX IF NOT EXISTS idx_beaconbot_convos_context ON beaconbot_conversations(account_id, context);
CREATE INDEX IF NOT EXISTS idx_beaconbot_actions_convo ON beaconbot_actions(conversation_id);
