import Link from "next/link";

export default function ExpensesPage() {
  return (
    <section>
      <h1>Expenses</h1>
      <p>Your expense history will appear here.</p>
      <Link href="/expenses/new">Add an expense</Link>
    </section>
  );
}
