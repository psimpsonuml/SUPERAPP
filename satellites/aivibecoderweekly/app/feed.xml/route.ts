import RSS from 'rss';
import { BLOG_CONFIG } from '../../config';
import { fetchPosts } from '../../lib/supabase';

export const revalidate = 3600;

export async function GET() {
  const { posts } = await fetchPosts({ limit: 50 });

  const feed = new RSS({
    title: BLOG_CONFIG.name,
    description: BLOG_CONFIG.tagline,
    site_url: `https://${BLOG_CONFIG.domain}`,
    feed_url: `https://${BLOG_CONFIG.domain}/feed.xml`,
    language: 'en',
  });

  for (const post of posts) {
    feed.item({
      title: post.title,
      url: `https://${BLOG_CONFIG.domain}/posts/${post.slug}`,
      description: post.excerpt || '',
      date: post.published_at,
      categories: post.category ? [post.category] : [],
      author: post.author || BLOG_CONFIG.name,
    });
  }

  return new Response(feed.xml({ indent: true }), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
