import { BLOG_CONFIG } from '../config';
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: `https://${BLOG_CONFIG.domain}/sitemap.xml`,
  };
}
