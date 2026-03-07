const crypto = require('crypto');
const { getSupabase } = require('../db/supabase');

class ContentMemoryService {
  constructor(accountId) {
    this.accountId = accountId;
    this.similarityThreshold = 0.8;
    this.dedupWindowDays = 30;
  }

  generateContentHash(text) {
    return crypto.createHash('sha256').update(text.toLowerCase().trim()).digest('hex');
  }

  async checkDuplicate(contentText, product) {
    const supabase = getSupabase();
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - this.dedupWindowDays);

    const hash = this.generateContentHash(contentText);

    // Exact match check
    const { data: exactMatch } = await supabase
      .from('content_memory')
      .select('id, title')
      .eq('account_id', this.accountId)
      .eq('content_hash', hash)
      .limit(1);

    if (exactMatch && exactMatch.length > 0) {
      return { isDuplicate: true, matchType: 'exact', matchId: exactMatch[0].id };
    }

    // Keyword overlap check (lightweight semantic similarity)
    const keywords = this.extractKeywords(contentText);
    const { data: recentContent } = await supabase
      .from('content_memory')
      .select('id, title, keywords')
      .eq('account_id', this.accountId)
      .eq('product', product)
      .gte('created_at', windowStart.toISOString())
      .limit(100);

    if (recentContent) {
      for (const existing of recentContent) {
        const existingKeywords = existing.keywords || [];
        const overlap = keywords.filter(k => existingKeywords.includes(k));
        const similarity = overlap.length / Math.max(keywords.length, existingKeywords.length, 1);
        if (similarity > this.similarityThreshold) {
          return { isDuplicate: true, matchType: 'similar', matchId: existing.id, similarity };
        }
      }
    }

    return { isDuplicate: false };
  }

  extractKeywords(text) {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'and', 'but', 'or', 'nor', 'not',
      'so', 'yet', 'both', 'either', 'neither', 'each', 'every', 'all',
      'any', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'only',
      'own', 'same', 'than', 'too', 'very', 'just', 'because', 'if', 'that',
      'this', 'these', 'those', 'it', 'its', 'they', 'them', 'their', 'we',
      'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
      .filter((w, i, arr) => arr.indexOf(w) === i)
      .slice(0, 20);
  }

  async store(content) {
    const supabase = getSupabase();
    const hash = this.generateContentHash(content.contentText || content.title || '');
    const keywords = this.extractKeywords(content.contentText || content.title || '');

    const record = {
      account_id: this.accountId,
      product: content.product,
      platform: content.platform,
      content_type: content.contentType,
      title: content.title,
      content_hash: hash,
      content_text: content.contentText,
      keywords,
      status: content.status || 'draft',
      repurpose_chain_id: content.repurposeChainId || null,
      source_content_id: content.sourceContentId || null,
      metadata: content.metadata || {},
    };

    const { data, error } = await supabase
      .from('content_memory')
      .insert(record)
      .select('id')
      .single();

    if (error) throw new Error(`Failed to store content: ${error.message}`);
    return data.id;
  }

  async markPublished(contentId) {
    const supabase = getSupabase();
    await supabase
      .from('content_memory')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', contentId)
      .eq('account_id', this.accountId);
  }

  async getRepurposeChain(chainId) {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('content_memory')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('repurpose_chain_id', chainId)
      .order('created_at', { ascending: true });

    return data || [];
  }

  async getTopicCoverage(product, days = 30) {
    const supabase = getSupabase();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data } = await supabase
      .from('content_memory')
      .select('keywords')
      .eq('account_id', this.accountId)
      .eq('product', product)
      .gte('created_at', since.toISOString());

    const topicCounts = {};
    for (const item of data || []) {
      for (const keyword of item.keywords || []) {
        topicCounts[keyword] = (topicCounts[keyword] || 0) + 1;
      }
    }

    return Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([topic, count]) => ({ topic, count }));
  }
}

module.exports = ContentMemoryService;
