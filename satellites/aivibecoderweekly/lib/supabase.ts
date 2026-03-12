import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export interface Post {
  id: string;
  title: string;
  slug: string;
  content_markdown: string;
  excerpt: string;
  category: string;
  tags: string[];
  author: string;
  published_at: string;
  og_image_url?: string;
  meta_description?: string;
  updated_at?: string;
  satellite_blog_id: string;
}

export async function fetchPosts(options: {
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ posts: Post[]; total: number }> {
  if (!supabase) return { posts: [], total: 0 };

  const { BLOG_CONFIG } = await import('../config');

  let query = supabase
    .from('content_memory')
    .select('*', { count: 'exact' })
    .eq('satellite_blog_id', BLOG_CONFIG.satelliteBlogId)
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (options.category) {
    query = query.eq('category', options.category);
  }
  if (options.search) {
    query = query.or(`title.ilike.%${options.search}%,content_markdown.ilike.%${options.search}%`);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }
  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 12) - 1);
  }

  const { data, count, error } = await query;
  if (error) {
    console.error('Failed to fetch posts:', error);
    return { posts: [], total: 0 };
  }

  return { posts: (data || []) as Post[], total: count || 0 };
}

export async function fetchPost(slug: string): Promise<Post | null> {
  if (!supabase) return null;

  const { BLOG_CONFIG } = await import('../config');

  const { data, error } = await supabase
    .from('content_memory')
    .select('*')
    .eq('satellite_blog_id', BLOG_CONFIG.satelliteBlogId)
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error) return null;
  return data as Post;
}

export async function fetchCategories(): Promise<string[]> {
  if (!supabase) return [];

  const { BLOG_CONFIG } = await import('../config');

  const { data, error } = await supabase
    .from('content_memory')
    .select('category')
    .eq('satellite_blog_id', BLOG_CONFIG.satelliteBlogId)
    .eq('status', 'published');

  if (error) return [];
  const cats = [...new Set((data || []).map(d => d.category).filter(Boolean))];
  return cats.sort();
}
