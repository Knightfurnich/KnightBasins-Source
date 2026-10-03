-- Migration 023: Resolve duplicate legacy quote numbers and add partial unique index
-- Approved by Boss (คุณนพ) on 4 Oct 2026

-- 1. Convert empty string quote numbers to NULL
UPDATE customer_leads 
SET quote_number = NULL 
WHERE quote_number = '';

-- 2. Disambiguate legacy duplicate "Sep 26 OF 1204":
-- Keep latest row (ID 78, slip 4,601 THB) as "Sep 26 OF 1204"
-- Append suffix to earlier row (ID 77, slip 1,027 THB) as "Sep 26 OF 1204-1" to preserve financial records
UPDATE customer_leads 
SET quote_number = 'Sep 26 OF 1204-1' 
WHERE id = 77 AND quote_number = 'Sep 26 OF 1204';

-- 3. Create partial UNIQUE INDEX on quote_number for non-null, non-empty values
CREATE UNIQUE INDEX IF NOT EXISTS customer_leads_quote_number_unique_idx 
ON customer_leads (quote_number) 
WHERE quote_number IS NOT NULL AND quote_number != '';
