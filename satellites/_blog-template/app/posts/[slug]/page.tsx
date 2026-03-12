import { fetchPost, fetchPosts } from '../../../lib/supabase';
import { BLOG_CONFIG } from '../../../config';
import { marked } from 'marked';
import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '../../components/JsonLd';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await fetchPost(params.slug);
  if (!post) return { title: 'Not Found' };

  const siteUrl = `https://${BLOG_CONFIG.domain}`;
  const postUrl = `${siteUrl}/posts/${post.slug}`;

  return {
    title: post.title,
    description: post.meta_description || post.excerpt || '',
    alternates: {
      canonical: postUrl,
    },
    openGraph: {
      type: 'article',
      url: postUrl,
      title: post.title,
      description: post.meta_description || post.excerpt || '',
      publishedTime: post.published_at,
      modifiedTime: post.updated_at || post.published_at,
      authors: post.author ? [post.author] : undefined,
      section: post.category || undefined,
      images: post.og_image_url
        ? [{ url: post.og_image_url, width: 1200, height: 630, alt: post.title }]
        : [{ url: BLOG_CONFIG.defaultOgImage, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.meta_description || post.excerpt || '',
      images: post.og_image_url ? [post.og_image_url] : undefined,
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
  const siteUrl = `https://${BLOG_CONFIG.domain}`;
  const postUrl = `${siteUrl}/posts/${post.slug}`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      ...(post.category ? [{
        '@type': 'ListItem',
        position: 2,
        name: post.category,
        item: `${siteUrl}/?category=${encodeURIComponent(post.category)}`,
      }] : []),
      { '@type': 'ListItem', position: post.category ? 3 : 2, name: post.title, item: postUrl },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.meta_description || post.excerpt || '',
    url: postUrl,
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
    image: post.og_image_url || `${siteUrl}${BLOG_CONFIG.defaultOgImage}`,
    author: {
      '@type': 'Person',
      name: post.author || BLOG_CONFIG.name,
    },
    publisher: {
      '@type': 'Organization',
      name: BLOG_CONFIG.publisher,
      url: BLOG_CONFIG.publisherUrl,
      logo: {
        '@type': 'ImageObject',
        url: BLOG_CONFIG.publisherLogo,
      },
    },
    isPartOf: {
      '@type': 'Blog',
      name: BLOG_CONFIG.name,
      url: siteUrl,
    },
    inLanguage: BLOG_CONFIG.language,
    ...(post.category ? { articleSection: post.category } : {}),
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['.article-title', '.article-content'],
    },
  };

  return (
    <article className="article" itemScope itemType="https://schema.org/BlogPosting">
      <JsonLd data={[breadcrumbSchema, articleSchema]} />
      <meta itemProp="datePublished" content={post.published_at} />
      <meta itemProp="dateModified" content={post.updated_at || post.published_at} />

      <div className="article-header">
        {post.category && (
          <div className="article-category">
            <Link href={`/?category=${encodeURIComponent(post.category)}`}>{post.category}</Link>
          </div>
        )}
        <h1 className="article-title" itemProp="headline">{post.title}</h1>
        <div className="article-meta">
          {post.author && <span itemProp="author" itemScope itemType="https://schema.org/Person"><span itemProp="name">{post.author}</span></span>}
          {post.published_at && (
            <time dateTime={post.published_at} itemProp="datePublished">
              {new Date(post.published_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </time>
          )}
        </div>
      </div>
      <div className="article-content" itemProp="articleBody" dangerouslySetInnerHTML={{ __html: htmlContent }} />
      <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
        <Link href="/" style={{ fontSize: 14 }}>&larr; Back to all articles</Link>
      </div>
    </article>
  );
}
