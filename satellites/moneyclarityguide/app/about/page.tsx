import { BLOG_CONFIG } from '../../config';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: `About | ${BLOG_CONFIG.name}`,
  description: `Learn more about ${BLOG_CONFIG.name}`,
};

export default function AboutPage() {
  return (
    <div className="about">
      <h1>About {BLOG_CONFIG.name}</h1>
      <p>
        {BLOG_CONFIG.tagline}. We publish insightful, well-researched content on
        topics that matter to our readers.
      </p>
      <p>
        Our articles cover {BLOG_CONFIG.categories.join(', ')}, and more.
        New content is published regularly by our team of expert writers.
      </p>
      <p>
        Have a story idea or feedback? We&apos;d love to hear from you.
        Reach out at hello@{BLOG_CONFIG.domain}.
      </p>
    </div>
  );
}
