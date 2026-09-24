export type SlipMatchCandidate = {
  referenceValue?: string | null;
  senderName?: string | null;
};

export type SlipMatchLead = {
  id: number;
  leadKey: string;
  quoteNumber?: string | null;
  name?: string | null;
  company?: string | null;
};

export type SlipAutoMatch = {
  matchedLeadId: number;
  matchedReason: string;
};

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
 * 1. slip.referenceValue against lead.quoteNumber or lead.leadKey (e.g. "26/1074" ~ leadKey "lead-line-26-1074")
 * 2. slip.senderName against lead.name or lead.company, ignoring Thai name/company prefixes
 * Returns the matched lead id plus a human-readable reason, or null when nothing matches.
 */
export function findAutoMatchLead(slip: SlipMatchCandidate, candidateLeads: SlipMatchLead[]): SlipAutoMatch | null {
  const ref = normalizeCode(slip.referenceValue);
  if (ref) {
    const byCode = candidateLeads.find((lead) =>
      fuzzyMatches(ref, normalizeCode(lead.quoteNumber), 3) || fuzzyMatches(ref, normalizeCode(lead.leadKey), 3),
    );
    if (byCode) {
      const matchedByQuote = fuzzyMatches(ref, normalizeCode(byCode.quoteNumber), 3);
      return {
        matchedLeadId: byCode.id,
        matchedReason: matchedByQuote
          ? `เลขใบเสนอราคาตรงกับ ${byCode.quoteNumber}`
          : `รหัสงานตรงกับ ${(slip.referenceValue ?? "").trim()}`,
      };
    }
  }

  const sender = normalizeName(slip.senderName);
  if (sender) {
    const byName = candidateLeads.find((lead) =>
      fuzzyMatches(sender, normalizeName(lead.name), 2) || fuzzyMatches(sender, normalizeName(lead.company), 2),
    );
    if (byName) {
      const matchedByName = fuzzyMatches(sender, normalizeName(byName.name), 2);
      return {
        matchedLeadId: byName.id,
        matchedReason: matchedByName
          ? `ชื่อผู้โอนตรงกับ ${byName.name}`
          : `ชื่อผู้โอนตรงกับ ${byName.company}`,
      };
    }
  }

  return null;
}
