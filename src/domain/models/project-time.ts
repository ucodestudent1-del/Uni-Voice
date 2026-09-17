import type { Decimal } from "decimal.js";
import type { CurrencyCode } from "../value-objects/currency.js";

export interface ProjectTimeEntry {
  id: string;
  projectId: string;
  businessId: string;
  userId: string | null;
  catalogServiceId: string | null;
  description: string;
  billable: boolean;
  startTime: Date | null;
  endTime: Date | null;
  durationMinutes: number | null;
  billableRate: string;
  billableAmount: string;
  isInvoiced: boolean;
  invoiceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectTimeEntrySummary {
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  unbilledBillableMinutes: number;
  invoicedBillableMinutes: number;
  totalBillableAmount: string;
  unbilledBillableAmount: string;
  currency: string;
}

export interface ProjectNote {
  id: string;
  projectId: string;
  businessId: string;
  userId: string | null;
  title: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeEntryConversion {
  entryId: string;
  description: string;
  hours: Decimal.Value;
  billableRate: string;
  billableAmount: string;
  catalogServiceId: string | null;
  taxCategory: string | null;
  currency: CurrencyCode;
}
