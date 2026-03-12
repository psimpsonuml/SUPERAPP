import { BLOG_CONFIG } from '../../config';
import type { Metadata } from 'next';
import JsonLd from '../components/JsonLd';

const siteUrl = `https://${BLOG_CONFIG.domain}`;

export const metadata: Metadata = {
  title: `About | ${BLOG_CONFIG.name}`,
  description: `Learn more about ${BLOG_CONFIG.name} — ${BLOG_CONFIG.tagline}. Published by ${BLOG_CONFIG.publisher}.`,
  alternates: {
    canonical: `${siteUrl}/about`,
  },
};

export default function AboutPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'About', item: `${siteUrl}/about` },
    ],
  };

  const aboutSchema = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `About ${BLOG_CONFIG.name}`,
    description: `${BLOG_CONFIG.tagline}. Published by ${BLOG_CONFIG.publisher}.`,
    url: `${siteUrl}/about`,
    isPartOf: {
      '@type': 'WebSite',
      name: BLOG_CONFIG.name,
      url: siteUrl,
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What is ${BLOG_CONFIG.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${BLOG_CONFIG.name} is a publication covering ${BLOG_CONFIG.categories.slice(0, 3).join(', ')}, and more. ${BLOG_CONFIG.tagline}.`,
        },
      },
      {
        '@type': 'Question',
        name: `Who publishes ${BLOG_CONFIG.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${BLOG_CONFIG.name} is published by ${BLOG_CONFIG.publisher}. Our team of expert writers produces well-researched content for our readers.`,
        },
      },
      {
        '@type': 'Question',
        name: `What topics does ${BLOG_CONFIG.name} cover?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `We cover ${BLOG_CONFIG.categories.join(', ')}. New content is published regularly.`,
        },
      },
      {
        '@type': 'Question',
        name: `How can I contact ${BLOG_CONFIG.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `You can reach us at hello@${BLOG_CONFIG.domain}. We welcome story ideas, feedback, and reader contributions.`,
        },
      },
    ],
  };

  return (
    <div className="about">
      <JsonLd data={[breadcrumbSchema, aboutSchema, faqSchema]} />

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

      <section style={{ marginTop: 48 }}>
        <h2>Frequently Asked Questions</h2>
        <dl>
          <dt><strong>What is {BLOG_CONFIG.name}?</strong></dt>
          <dd>{BLOG_CONFIG.name} is a publication covering {BLOG_CONFIG.categories.slice(0, 3).join(', ')}, and more. {BLOG_CONFIG.tagline}.</dd>

          <dt style={{ marginTop: 16 }}><strong>Who publishes {BLOG_CONFIG.name}?</strong></dt>
          <dd>{BLOG_CONFIG.name} is published by {BLOG_CONFIG.publisher}. Our team of expert writers produces well-researched content for our readers.</dd>

          <dt style={{ marginTop: 16 }}><strong>What topics does {BLOG_CONFIG.name} cover?</strong></dt>
          <dd>We cover {BLOG_CONFIG.categories.join(', ')}. New content is published regularly.</dd>

          <dt style={{ marginTop: 16 }}><strong>How can I contact {BLOG_CONFIG.name}?</strong></dt>
          <dd>You can reach us at hello@{BLOG_CONFIG.domain}. We welcome story ideas, feedback, and reader contributions.</dd>
        </dl>
      </section>
    </div>
  );
}
