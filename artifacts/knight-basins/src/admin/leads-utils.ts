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

export interface SlipMatchCandidate {
  referenceValue?: string | null;
  senderName?: string | null;
}

const NAME_PREFIX_PATTERN = /^(บริษัท|บจก\.?|ห้างหุ้นส่วนจำกัด|หจก\.?|นางสาว|นาย|นาง|คุณ)\s*/;

function stripNamePrefix(value: string): string {
  let result = value.trim();
  let previous: string;
  do {
    previous = result;
    result = result.replace(NAME_PREFIX_PATTERN, "").trim();
  } while (result !== previous && result.length > 0);
  return result;
}

function normalizeCode(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeName(value: unknown): string {
  return stripNamePrefix(String(value ?? "")).toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function fuzzyMatches(a: string, b: string, minLength: number): boolean {
  if (a.length < minLength || b.length < minLength) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Matches an unassigned payment slip to a lead by, in priority order:
 * 1. slip.referenceValue against lead.quoteNumber or lead.leadKey (e.g. "26/1074" ~ "lead-line-26-1074")
 * 2. slip.senderName against lead.name or lead.company, ignoring Thai name/company prefixes
 */
export function findAutoMatchLead(slip: SlipMatchCandidate, candidateLeads: CustomerLead[]): CustomerLead | undefined {
  const ref = normalizeCode(slip.referenceValue);
  if (ref) {
    const byCode = candidateLeads.find((lead) =>
      fuzzyMatches(ref, normalizeCode(lead.quoteNumber), 3) || fuzzyMatches(ref, normalizeCode(lead.leadKey), 3),
    );
    if (byCode) return byCode;
  }

  const sender = normalizeName(slip.senderName);
  if (sender) {
    const byName = candidateLeads.find((lead) =>
      fuzzyMatches(sender, normalizeName(lead.name), 2) || fuzzyMatches(sender, normalizeName(lead.company), 2),
    );
    if (byName) return byName;
  }

  return undefined;
}

export function adminQuoteUrl(publicQuoteToken: string, origin = window.location.origin) {
  const url = new URL("/quote/view", origin);
  url.searchParams.set("token", publicQuoteToken);
  return url.toString();
}