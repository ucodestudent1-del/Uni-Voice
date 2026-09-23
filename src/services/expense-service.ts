import { Decimal } from "decimal.js";
import { expenseRepository, type ExpenseRepository, type ExpenseInput, type ExpenseSearchOpts } from "../repositories/expense.repo.js";
import type { ExpenseUpdateInput as RepoExpenseUpdateInput } from "../repositories/expense.repo.js";
import { NotFoundError } from "../domain/errors.js";
import type { Expense, ExpenseSummary } from "../domain/models/expense.js";
import type { ExpenseCreateInput, ExpenseUpdateInput, ExpenseSearchInput } from "../domain/schemas/expense.js";
import type { PagedResult } from "../repositories/helpers.js";

export class ExpenseService {
  constructor(private readonly repo: ExpenseRepository = expenseRepository) {}

  async create(
    businessId: string,
    input: ExpenseCreateInput,
    userId?: string | null
  ): Promise<Expense> {
    const expenseInput: ExpenseInput = {
      ...input,
      amount: new Decimal(input.amount),
    };
    return this.repo.create(businessId, expenseInput, userId ?? null);
  }

  async getById(businessId: string, id: string): Promise<Expense> {
    const expense = await this.repo.findById(businessId, id);
    if (!expense) throw new NotFoundError(`Expense ${id} not found`);
    return expense;
  }

  async list(businessId: string, opts: ExpenseSearchInput): Promise<PagedResult<Expense>> {
    const searchOpts: ExpenseSearchOpts = {
      ...opts,
      dateFrom: opts.dateFrom,
      dateTo: opts.dateTo,
    };
    return this.repo.findMany(businessId, searchOpts);
  }

  async update(
    businessId: string,
    id: string,
    input: ExpenseUpdateInput
  ): Promise<Expense> {
    await this.repo.findById(businessId, id);

    const updateInput: RepoExpenseUpdateInput = { ...input };
    if (input.amount !== undefined) {
      updateInput.amount = new Decimal(input.amount);
    }

    return this.repo.update(businessId, id, updateInput);
  }

  async delete(businessId: string, id: string): Promise<void> {
    await this.repo.findById(businessId, id);
    await this.repo.delete(businessId, id);
  }

  async getSummary(businessId: string, opts: ExpenseSearchInput): Promise<ExpenseSummary> {
    return this.repo.getSummary(businessId, opts);
  }

  async listWithSummary(
    businessId: string,
    opts: ExpenseSearchInput
  ): Promise<{ expenses: Expense[]; total: number; limit: number; offset: number; summary: ExpenseSummary }> {
    const [result, summary] = await Promise.all([
      this.list(businessId, opts),
      this.getSummary(businessId, opts),
    ]);
    return {
      expenses: result.data,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      summary,
    };
  }
}

export const expenseService = new ExpenseService();
