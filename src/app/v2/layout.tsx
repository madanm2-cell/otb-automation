import './globals-v2.css';
import { V2LayoutClient } from './v2-layout-client';

export const dynamic = 'force-dynamic';

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <V2LayoutClient>{children}</V2LayoutClient>;
}
