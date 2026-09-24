/**
 * slip-matching.ts — เครื่องมือสกัดรหัสงานและเลขที่ใบเสนอราคาจากข้อความแชท
 */

const JOB_PATTERN = /(?:รัน|run|pay\s*in|po|งาน|บิล)?\s*([0-9]{2}\/[0-9]{3,4})/gi;
const QUOTE_PATTERN = /(?:Sep|Oct|Aug|Jul|Jun|May|Apr|Mar|Feb|Jan)\s*[0-9]{2}\s*(?:\/|\s+)?(?:OF|US)\s*(?:\/|\s+)?([0-9]{4,6})/gi;
const INTERNAL_KEYWORDS = ["easypass", "easy pass", "ค่าทางด่วน", "ค่าไฟ", "ค่าน้ำ", "เติมเงิน"];

export interface ExtractedSlipRef {
  jobCodes: string[];
  quoteNumbers: string[];
  isInternal: boolean;
}

export function extractJobCodesAndQuotes(text: string | null | undefined): ExtractedSlipRef {
  if (!text || typeof text !== "string") {
    return { jobCodes: [], quoteNumbers: [], isInternal: false };
  }

  const raw = text.trim();
  const lower = raw.toLowerCase();
  const isInternal = INTERNAL_KEYWORDS.some((kw) => lower.includes(kw));

  const jobCodes: string[] = [];
  JOB_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = JOB_PATTERN.exec(raw)) !== null) {
    const code = match[1];
    if (code && !jobCodes.includes(code)) {
      jobCodes.push(code);
    }
  }

  const quoteNumbers: string[] = [];
  QUOTE_PATTERN.lastIndex = 0;
  while ((match = QUOTE_PATTERN.exec(raw)) !== null) {
    const quote = match[0].trim();
    if (quote && !quoteNumbers.includes(quote)) {
      quoteNumbers.push(quote);
    }
  }

  return {
    jobCodes,
    quoteNumbers,
    isInternal,
  };
}
