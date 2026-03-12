import { BLOG_CONFIG } from '../config';
import { fetchPosts, fetchCategories } from '../lib/supabase';
import Link from 'next/link';
import JsonLd from './components/JsonLd';

export const revalidate = 300; // ISR: revalidate every 5 minutes

export default async function HomePage({
  searchParams,
}: {
  searchParams: { category?: string; search?: string; page?: string };
}) {
  const page = parseInt(searchParams.page || '1');
  const limit = BLOG_CONFIG.postsPerPage;
  const offset = (page - 1) * limit;

  const [{ posts, total }, categories] = await Promise.all([
    fetchPosts({
      category: searchParams.category,
      search: searchParams.search,
      limit,
      offset,
    }),
    fetchCategories(),
  ]);

  const totalPages = Math.ceil(total / limit);
  const siteUrl = `https://${BLOG_CONFIG.domain}`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: siteUrl,
      },
      ...(searchParams.category ? [{
        '@type': 'ListItem',
        position: 2,
        name: searchParams.category,
        item: `${siteUrl}/?category=${encodeURIComponent(searchParams.category)}`,
      }] : []),
    ],
  };

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: searchParams.category ? `${searchParams.category} — ${BLOG_CONFIG.name}` : BLOG_CONFIG.name,
    description: BLOG_CONFIG.tagline,
    url: siteUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: BLOG_CONFIG.name,
      url: siteUrl,
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: total,
      itemListElement: posts.map((post, i) => ({
        '@type': 'ListItem',
        position: offset + i + 1,
        url: `${siteUrl}/posts/${post.slug}`,
        name: post.title,
      })),
    },
  };

  return (
    <>
      <JsonLd data={[breadcrumbSchema, collectionSchema]} />

      <div className="hero">
        <h1>{BLOG_CONFIG.name}</h1>
        <p>{BLOG_CONFIG.tagline}</p>
      </div>

      <div className="search-bar">
        <span className="search-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
        </span>
        <form action="/" method="get">
          <input
            type="text"
            name="search"
            placeholder="Search articles..."
            defaultValue={searchParams.search || ''}
          />
        </form>
      </div>

      <div className="category-pills">
        <Link href="/" className={`pill${!searchParams.category ? ' pill-active' : ''}`}>
          All
        </Link>
        {(categories.length > 0 ? categories : BLOG_CONFIG.categories).map((cat) => (
          <Link
            key={cat}
            href={`/?category=${encodeURIComponent(cat)}`}
            className={`pill${searchParams.category === cat ? ' pill-active' : ''}`}
          >
            {cat}
          </Link>
        ))}
      </div>

      {posts.length > 0 ? (
        <div className="post-grid">
          {posts.map((post) => (
            <article key={post.id} className="post-card">
              <div className="post-card-body">
                {post.category && (
                  <div className="post-card-category">{post.category}</div>
                )}
                <h2 className="post-card-title">
                  <Link href={`/posts/${post.slug}`}>{post.title}</Link>
                </h2>
                {post.excerpt && (
                  <p className="post-card-excerpt">{post.excerpt}</p>
                )}
                <div className="post-card-meta">
                  {post.author && <span>{post.author}</span>}
                  {post.published_at && (
                    <span>{new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No articles yet</h2>
          <p>New content is published regularly. Check back soon!</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          {page > 1 && <Link href={`/?page=${page - 1}${searchParams.category ? `&category=${searchParams.category}` : ''}`}>Previous</Link>}
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((p) => (
            <Link
              key={p}
              href={`/?page=${p}${searchParams.category ? `&category=${searchParams.category}` : ''}`}
              className={p === page ? 'active' : ''}
            >
              {p}
            </Link>
          ))}
          {page < totalPages && <Link href={`/?page=${page + 1}${searchParams.category ? `&category=${searchParams.category}` : ''}`}>Next</Link>}
        </div>
      )}
    </>
  );
}
