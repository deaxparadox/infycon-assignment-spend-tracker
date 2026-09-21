import { SummaryView } from "@/features/expenses/summary-view";
import { serializeSearchParams, type PageSearchParams } from "@/lib/url/search-params";

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const queryString = serializeSearchParams(await searchParams);
  return <SummaryView key={queryString} queryString={queryString} />;
}
