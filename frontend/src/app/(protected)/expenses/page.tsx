import { ExpenseListView } from "@/features/expenses/expense-list-view";
import { serializeSearchParams, type PageSearchParams } from "@/lib/url/search-params";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const queryString = serializeSearchParams(await searchParams);
  return <ExpenseListView key={queryString} queryString={queryString} />;
}
