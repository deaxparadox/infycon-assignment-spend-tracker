export type Expense = {
  id: number;
  amount: string;
  category: string;
  note: string;
  date: string;
  created_at: string;
  updated_at: string;
};

export type ExpenseListResponse = {
  count: number;
  limit: number;
  offset: number;
  results: Expense[];
};

export type CategorySpend = {
  category: string;
  amount: string;
};

export type SpendingInsight = {
  type: "category_increase" | "new_category_spend";
  category: string;
  current_amount: string;
  previous_amount: string;
  percentage: string | null;
  message: string;
};

export type MonthlySummary = {
  month: string;
  total: string;
  previous_month_total: string;
  month_over_month_percentage: string | null;
  spend_by_category: CategorySpend[];
  insights: SpendingInsight[];
};
