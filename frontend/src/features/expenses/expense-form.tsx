"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import type { Expense } from "@/lib/api/contracts";
import { isPositiveAmountInput, normalizeAmountInput } from "@/lib/money/format";

function localIsoDate(date = new Date()): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ExpenseForm() {
  const { api } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setFields({});
    const form = new FormData(event.currentTarget);
    const amount = normalizeAmountInput(String(form.get("amount") ?? ""));
    const category = String(form.get("category") ?? "").trim();
    const note = String(form.get("note") ?? "");
    const date = String(form.get("date") ?? "");
    const clientFields: Record<string, string[]> = {};
    if (!isPositiveAmountInput(amount)) {
      clientFields.amount = ["Enter a positive amount with at most two decimal places."];
    }
    if (!category) {
      clientFields.category = ["Category is required."];
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      clientFields.date = ["Date is required."];
    }
    if (note.length > 500) {
      clientFields.note = ["Note cannot exceed 500 characters."];
    }
    if (Object.keys(clientFields).length) {
      setFields(clientFields);
      return;
    }

    setSubmitting(true);
    try {
      await api.request<Expense>("/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, category, note, date }),
      });
      router.push("/expenses?created=1");
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(error.message);
        setFields(error.fields);
      } else {
        setMessage("The expense could not be saved. Check your connection and retry.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="content-card">
      <div className="section-heading">
        <h1>Add expense</h1>
        <Link href="/expenses">Back to expenses</Link>
      </div>
      {message ? (
        <p className="form-error" role="alert">
          {message}
        </p>
      ) : null}
      <form className="expense-form" onSubmit={handleSubmit}>
        <label htmlFor="amount">Amount</label>
        <input
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          aria-describedby={fields.amount ? "amount-error" : undefined}
          required
        />
        {fields.amount ? <p id="amount-error">{fields.amount.join(" ")}</p> : null}

        <label htmlFor="category">Category</label>
        <input
          id="category"
          name="category"
          type="text"
          maxLength={100}
          aria-describedby={fields.category ? "category-error" : undefined}
          required
        />
        {fields.category ? <p id="category-error">{fields.category.join(" ")}</p> : null}

        <label htmlFor="note">Note (optional)</label>
        <textarea
          id="note"
          name="note"
          maxLength={500}
          aria-describedby={fields.note ? "note-error" : undefined}
        />
        {fields.note ? <p id="note-error">{fields.note.join(" ")}</p> : null}

        <label htmlFor="date">Date</label>
        <input
          id="date"
          name="date"
          type="date"
          defaultValue={localIsoDate()}
          aria-describedby={fields.date ? "date-error" : undefined}
          required
        />
        {fields.date ? <p id="date-error">{fields.date.join(" ")}</p> : null}

        <button disabled={submitting} type="submit">
          {submitting ? "Saving…" : "Save expense"}
        </button>
      </form>
    </section>
  );
}
