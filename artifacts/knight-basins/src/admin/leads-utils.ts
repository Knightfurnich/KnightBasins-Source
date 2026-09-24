import type { CustomerLead } from "@workspace/api-client-react";

export type LeadDateFilters = {
  fromDate?: string;
  toDate?: string;
};

function normalized(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

export function leadSearchText(lead: CustomerLead) {
  return [
    lead.quoteNumber,
    lead.leadKey,
    lead.name,
    lead.company,
    lead.phone,
    lead.email,
    lead.project,
    lead.source,
    ...lead.productSkus,
  ].map(normalized).join(" ");
}

export function leadMatchesSearch(lead: CustomerLead, query: string) {
  const value = normalized(query);
  return !value || leadSearchText(lead).includes(value);
}

function dayStart(value: string) {
  return new Date(`${value}T00:00:00+07:00`);
}

function dayEnd(value: string) {
  return new Date(`${value}T23:59:59.999+07:00`);
}

export function leadMatchesDateRange(lead: CustomerLead, filters: LeadDateFilters) {
  if (!filters.fromDate && !filters.toDate) return true;
  const createdAt = new Date(lead.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;
  if (filters.fromDate) {
    const from = dayStart(filters.fromDate);
    if (Number.isNaN(from.getTime()) || createdAt < from) return false;
  }
  if (filters.toDate) {
    const to = dayEnd(filters.toDate);
    if (Number.isNaN(to.getTime()) || createdAt > to) return false;
  }
  return true;
}

export function filterAdminLeads(
  leads: CustomerLead[],
  status: CustomerLead["status"] | "all" | (string & {}),
  query: string,
  filters: LeadDateFilters,
) {
  return leads.filter((lead) =>
    (status === "all" || lead.status === status) &&
    leadMatchesSearch(lead, query) &&
    leadMatchesDateRange(lead, filters),
  );
}

export function adminQuoteUrl(publicQuoteToken: string, origin = window.location.origin) {
  const url = new URL("/quote/view", origin);
  url.searchParams.set("token", publicQuoteToken);
  return url.toString();
}