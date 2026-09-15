---
name: Thai timezone handling
description: All user-visible and business-calendar timestamps must be evaluated in Asia/Bangkok.
---

Use `Asia/Bangkok` explicitly for every user-visible date/time, Bangkok calendar filter boundary, notification timestamp, and month-based document number.

**Why:** The API runtime and user browsers can run in UTC or another local timezone; implicit formatting caused displayed draft times and month-based quote numbers to be seven hours or one month wrong.

**How to apply:** Keep expiry arithmetic as instant milliseconds, then format the instant with the explicit timezone. Convert admin date inputs to `00:00:00.000+07:00` and `23:59:59.999+07:00` before comparing.

Production verification confirmed that explicit formatting remains identical under UTC and America/New_York browser timezones across Studio, quotes, notifications, and Admin Leads.