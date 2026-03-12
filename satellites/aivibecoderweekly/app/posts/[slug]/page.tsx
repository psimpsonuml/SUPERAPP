import { fetchPost, fetchPosts } from '../../../lib/supabase';
import { BLOG_CONFIG } from '../../../config';
import { marked } from 'marked';
import type { Metadata } from 'next';
import Link from 'next/link';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await fetchPost(params.slug);
  if (!post) return { title: 'Not Found' };

  return {
    title: post.title,
    description: post.meta_description || post.excerpt || '',
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.meta_description || post.excerpt || '',
      publishedTime: post.published_at,
      authors: post.author ? [post.author] : undefined,
      images: post.og_image_url ? [post.og_image_url] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.meta_description || post.excerpt || '',
    },
  };
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await fetchPost(params.slug);

  if (!post) {
    return (
      <div className="empty-state">
        <h2>Article not found</h2>
        <p><Link href="/">Back to home</Link></p>
      </div>
    );
  }

  const htmlContent = marked(post.content_markdown || '');

  return (
    <article className="article">
      <div className="article-header">
        {post.category && (
          <div className="article-category">
            <Link href={`/?category=${encodeURIComponent(post.category)}`}>{post.category}</Link>
          </div>
        )}
        <h1 className="article-title">{post.title}</h1>
        <div className="article-meta">
          {post.author && <span>{post.author}</span>}
          {post.published_at && (
            <span>{new Date(post.published_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
          )}
        </div>
      </div>
      <div className="article-content" dangerouslySetInnerHTML={{ __html: htmlContent }} />
      <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
        <Link href="/" style={{ fontSize: 14 }}>&larr; Back to all articles</Link>
      </div>
    </article>
  );
}
