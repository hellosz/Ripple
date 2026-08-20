import type { ReactElement } from 'react';
import { DetailView } from '@/components/skill/detail-view';

export default async function SkillPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<ReactElement> {
  const { slug } = await params;
  return <DetailView slug={decodeURIComponent(slug)} />;
}
