import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { CliDoc, DesktopDoc, OverviewDoc, SpecDoc } from '@/components/docs/doc-content';

const TOPICS = [
  { key: 'overview', name: '概览' },
  { key: 'cli', name: 'CLI 工具' },
  { key: 'desktop', name: '桌面客户端' },
  { key: 'spec', name: 'Skill 规范' },
] as const;

type TopicKey = (typeof TOPICS)[number]['key'];

export function generateStaticParams(): { topic: TopicKey }[] {
  return TOPICS.map((t) => ({ topic: t.key }));
}

export default async function DocsPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<ReactElement> {
  const { topic } = await params;
  if (!TOPICS.some((t) => t.key === topic)) notFound();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gap: 44,
        maxWidth: 1200,
        margin: '0 auto',
        padding: '40px 32px 72px',
        animation: 'rp-fade-in .25s ease-out',
      }}
    >
      <nav style={{ position: 'sticky', top: 88, alignSelf: 'start' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.3em',
            color: 'rgba(75,80,64,.45)',
            marginBottom: 12,
            paddingLeft: 12,
          }}
        >
          文档
        </div>
        {TOPICS.map((t) => {
          const active = t.key === topic;
          return (
            <Link
              key={t.key}
              href={`/docs/${t.key}`}
              style={{
                display: 'block',
                fontSize: 13.5,
                padding: '9px 12px',
                borderRadius: 9,
                marginBottom: 2,
                color: active ? 'var(--rp-primary)' : 'rgba(75,80,64,.6)',
                background: active ? 'rgba(147,168,107,.09)' : undefined,
                fontWeight: active ? 700 : 400,
              }}
            >
              {t.name}
            </Link>
          );
        })}
      </nav>
      <div style={{ minWidth: 0, maxWidth: 760 }}>
        {topic === 'overview' ? <OverviewDoc /> : null}
        {topic === 'cli' ? <CliDoc /> : null}
        {topic === 'desktop' ? <DesktopDoc /> : null}
        {topic === 'spec' ? <SpecDoc /> : null}
      </div>
    </div>
  );
}
