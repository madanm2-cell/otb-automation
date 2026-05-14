'use client';

import { useParams } from 'next/navigation';
import { CycleWorkspace } from '@/components/cycle-workspace/CycleWorkspace';

export default function V2CycleWorkspacePage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  return <CycleWorkspace cycleId={cycleId} />;
}
