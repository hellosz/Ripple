import { Suspense } from 'react';
import type { ReactElement } from 'react';
import { HomeView } from '@/components/home/home-view';

export default function HomePage(): ReactElement {
  return (
    <Suspense>
      <HomeView />
    </Suspense>
  );
}
