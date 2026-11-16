import { getBrandName } from '../../lib/settings';
import { DashboardView } from './DashboardView';

export default async function DashboardPage() {
  const brandName = await getBrandName();
  return <DashboardView brandName={brandName} />;
}
