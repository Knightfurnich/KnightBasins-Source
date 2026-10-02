import {
  boolean,
  doublePrecision,
  foreignKey,
  integer,
  index,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const basinCategories = pgTable(
  "basin_categories",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    active: boolean("active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...auditColumns,
  },
  (table) => [uniqueIndex("basin_categories_name_unique").on(table.name)],
);

export const basinPrices = pgTable(
  "basin_prices",
  {
    id: serial("id").primaryKey(),
    sku: varchar("sku", { length: 32 }).notNull(),
    colorCode: varchar("color_code", { length: 64 }).notNull(),
    colorName: varchar("color_name", { length: 160 }).notNull(),
    priceTHB: integer("price_thb").notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    categoryId: integer("category_id"),
    dimensions: varchar("dimensions", { length: 160 }).notNull(),
    basinDimensions: varchar("basin_dimensions", { length: 160 }),
    bowlMm: varchar("bowl_mm", { length: 160 }),
    imageTone: varchar("image_tone", { length: 24 }).notNull(),
    imageUrl: text("image_url"),
    galleryImageUrls: text("gallery_image_urls").array().default(sql`ARRAY[]::text[]`).notNull(),
    quoteImageUrl: text("quote_image_url"),
    videoUrl: text("video_url"),
    topViewImageUrl: text("top_view_image_url"),
    active: boolean("active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("basin_prices_sku_unique").on(table.sku),
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [basinCategories.id],
      name: "basin_prices_category_id_fk",
    }).onDelete("set null"),
  ],
);

export const installedStoneCategories = pgTable(
  "installed_stone_categories",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    active: boolean("active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...auditColumns,
  },
  (table) => [uniqueIndex("installed_stone_categories_name_unique").on(table.name)],
);

export const installedStonePrices = pgTable(
  "installed_stone_prices",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    pricePerSqmTHB: integer("price_per_sqm_thb").notNull(),
    categoryId: integer("category_id"),
    tone: varchar("tone", { length: 24 }).notNull(),
    imageUrl: text("image_url"),
    galleryImageUrls: text("gallery_image_urls").array().default(sql`ARRAY[]::text[]`).notNull(),
    quoteImageUrl: text("quote_image_url"),
    slabImageUrl: text("slab_image_url"),
    aliases: text("aliases").array().notNull(),
    active: boolean("active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("installed_stone_prices_code_unique").on(table.code),
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [installedStoneCategories.id],
      name: "installed_stone_prices_category_id_fk",
    }).onDelete("set null"),
  ],
);

export const sheetStonePrices = pgTable(
  "sheet_stone_prices",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    basePriceTHB: integer("base_price_thb").notNull(),
    price10PlusTHB: integer("price_10_plus_thb").notNull(),
    price50PlusTHB: integer("price_50_plus_thb").notNull(),
    tone: varchar("tone", { length: 24 }).notNull(),
    imageUrl: text("image_url"),
    galleryImageUrls: text("gallery_image_urls").array().default(sql`ARRAY[]::text[]`).notNull(),
    quoteImageUrl: text("quote_image_url"),
    slabImageUrl: text("slab_image_url"),
    aliases: text("aliases").array().notNull(),
    active: boolean("active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...auditColumns,
  },
  (table) => [uniqueIndex("sheet_stone_prices_code_unique").on(table.code)],
);

export const customerAccounts = pgTable(
  "customer_accounts",
  {
    id: serial("id").primaryKey(),
    lineUserId: varchar("line_user_id", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    pictureUrl: text("picture_url"),
    fullName: varchar("full_name", { length: 160 }),
    phone: varchar("phone", { length: 64 }),
    lineContact: varchar("line_contact", { length: 120 }),
    email: varchar("email", { length: 240 }),
    company: varchar("company", { length: 200 }),
    project: varchar("project", { length: 240 }),
    address: text("address"),
    taxName: varchar("tax_name", { length: 240 }),
    taxId: varchar("tax_id", { length: 13 }),
    taxBranch: varchar("tax_branch", { length: 120 }),
    taxAddress: text("tax_address"),
    preferredContact: varchar("preferred_contact", { length: 24 }),
    customerRole: varchar("customer_role", { length: 64 }),
    propertyType: varchar("property_type", { length: 64 }),
    condoFloor: varchar("condo_floor", { length: 32 }),
    expectedInstallationDate: varchar("expected_installation_date", { length: 10 }),
    ...auditColumns,
  },
  (table) => [uniqueIndex("customer_accounts_line_user_id_unique").on(table.lineUserId)],
);

export const customerSessions = pgTable(
  "customer_sessions",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("customer_sessions_token_hash_unique").on(table.tokenHash),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [customerAccounts.id],
      name: "customer_sessions_account_id_customer_accounts_id_fk",
    }).onDelete("cascade"),
  ],
);

export const adminMembers = pgTable(
  "admin_members",
  {
    id: serial("id").primaryKey(),
    lineUserId: varchar("line_user_id", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    pictureUrl: text("picture_url"),
    role: varchar("role", { length: 16 }).default("staff").notNull(),
    permissions: text("permissions").array().default(sql`ARRAY[]::text[]`).notNull(),
    active: boolean("active").default(true).notNull(),
    ...auditColumns,
  },
  (table) => [uniqueIndex("admin_members_line_user_id_unique").on(table.lineUserId)],
);

export const adminInvites = pgTable(
  "admin_invites",
  {
    id: serial("id").primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    role: varchar("role", { length: 16 }).default("staff").notNull(),
    permissions: text("permissions").array().default(sql`ARRAY[]::text[]`).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("admin_invites_token_hash_unique").on(table.tokenHash),
    uniqueIndex("admin_invites_code_hash_unique").on(table.codeHash),
    index("admin_invites_expires_at_idx").on(table.expiresAt),
  ],
);

export const adminApiKeys = pgTable(
  "admin_api_keys",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    keyPrefix: varchar("key_prefix", { length: 24 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    scopes: text("scopes").array().default(sql`ARRAY[]::text[]`).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("admin_api_keys_token_hash_unique").on(table.tokenHash),
    index("admin_api_keys_revoked_at_idx").on(table.revokedAt),
  ],
);

export const customerProfileUpdateConfirmations = pgTable(
  "customer_profile_update_confirmations",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id").notNull(),
    fields: jsonb("fields").notNull(),
    comparison: jsonb("comparison").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("customer_profile_update_confirmations_account_id_unique").on(table.accountId),
    index("customer_profile_update_confirmations_expires_at_idx").on(table.expiresAt),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [customerAccounts.id],
      name: "customer_profile_update_confirmations_account_id_fk",
    }).onDelete("cascade"),
  ],
);

export const supportProfileUpdates = pgTable(
  "support_profile_updates",
  {
    id: serial("id").primaryKey(),
    customerAccountId: integer("customer_account_id").notNull(),
    fields: jsonb("fields").notNull(),
    comparison: jsonb("comparison").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("support_profile_updates_account_unique").on(table.customerAccountId),
    foreignKey({
      columns: [table.customerAccountId],
      foreignColumns: [customerAccounts.id],
      name: "support_profile_updates_account_id_customer_accounts_id_fk",
    }).onDelete("cascade"),
  ],
);

export const customerLeads = pgTable(
  "customer_leads",
  {
    id: serial("id").primaryKey(),
    leadKey: varchar("lead_key", { length: 120 }).notNull(),
    status: varchar("status", { length: 32 }).default("new_lead").notNull(),
    source: varchar("source", { length: 64 }).default("storefront").notNull(),
    orderMode: varchar("order_mode", { length: 32 }).default("quick-purchase").notNull(),
    name: varchar("name", { length: 160 }),
    company: varchar("company", { length: 200 }),
    phone: varchar("phone", { length: 64 }),
    lineContact: varchar("line_contact", { length: 120 }),
    email: varchar("email", { length: 240 }),
    project: varchar("project", { length: 240 }),
    address: text("address"),
    site: varchar("site", { length: 240 }),
    purchasingDepartment: varchar("purchasing_department", { length: 160 }),
    notes: text("notes"),
    productSkus: text("product_skus").array().default(sql`ARRAY[]::text[]`).notNull(),
    quoteNumber: varchar("quote_number", { length: 64 }),
    quoteAccessSecret: varchar("quote_access_secret", { length: 64 }),
    studioData: jsonb("studio_data"),
    sketchUrl: text("sketch_url"),
    customerAccountId: integer("customer_account_id"),
    taxName: varchar("tax_name", { length: 240 }),
    taxId: varchar("tax_id", { length: 13 }),
    taxBranch: varchar("tax_branch", { length: 120 }),
    taxAddress: text("tax_address"),
    preferredContact: varchar("preferred_contact", { length: 24 }),
    customerRole: varchar("customer_role", { length: 64 }),
    propertyType: varchar("property_type", { length: 64 }),
    condoFloor: varchar("condo_floor", { length: 32 }),
    expectedInstallationDate: varchar("expected_installation_date", { length: 10 }),
    nextFollowUpDate: varchar("next_follow_up_date", { length: 10 }),
    assignedTo: varchar("assigned_to", { length: 160 }),
    technicianTeamCode: varchar("technician_team_code", { length: 8 }),
    siteLat: doublePrecision("site_lat"),
    siteLng: doublePrecision("site_lng"),
    siteMapsUrl: varchar("site_maps_url", { length: 512 }),
    trackingViewCount: integer("tracking_view_count").default(0),
    trackingViewedAt: timestamp("tracking_viewed_at", { withTimezone: true }),
    handoverDate: varchar("handover_date", { length: 10 }),
    warrantyNo: varchar("warranty_no", { length: 64 }),
    warrantyPeriodMonths: integer("warranty_period_months").default(12).notNull(),
    handoverNotes: text("handover_notes"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("customer_leads_key_unique").on(table.leadKey),
    index("customer_leads_customer_account_id_idx").on(table.customerAccountId),
    index("customer_leads_technician_team_code_idx").on(table.technicianTeamCode),
    index("customer_leads_expected_installation_date_idx").on(table.expectedInstallationDate),
    foreignKey({
      columns: [table.customerAccountId],
      foreignColumns: [customerAccounts.id],
      name: "customer_leads_customer_account_id_customer_accounts_id_fk",
    }).onDelete("set null"),
  ],
);

export const leadExternalReferences = pgTable(
  "lead_external_references",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").notNull(),
    referenceType: varchar("reference_type", { length: 32 }).notNull(),
    referenceValue: varchar("reference_value", { length: 64 }).notNull(),
    normalizedValue: varchar("normalized_value", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("lead_external_references_type_value_unique").on(table.referenceType, table.normalizedValue),
    index("lead_external_references_lead_id_idx").on(table.leadId),
    foreignKey({
      columns: [table.leadId],
      foreignColumns: [customerLeads.id],
      name: "lead_external_references_lead_id_customer_leads_id_fk",
    }).onDelete("cascade"),
  ],
);

export const paymentSlips = pgTable(
  "payment_slips",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id"),
    kind: varchar("kind", { length: 16 }).default("deposit").notNull(),
    status: varchar("status", { length: 24 }).default("pending").notNull(),
    sourceType: varchar("source_type", { length: 32 }).default("direct_upload").notNull(),
    referenceValue: varchar("reference_value", { length: 64 }),
    archiveMessageId: varchar("archive_message_id", { length: 128 }),
    archiveAttachmentId: varchar("archive_attachment_id", { length: 128 }),
    sourceHash: varchar("source_hash", { length: 64 }),
    slipImageUrl: text("slip_image_url").notNull(),
    claimedAmountThb: integer("claimed_amount_thb"),
    verifiedAmountThb: integer("verified_amount_thb"),
    senderName: varchar("sender_name", { length: 200 }),
    transRef: varchar("trans_ref", { length: 64 }),
    slipokErrorCode: varchar("slipok_error_code", { length: 16 }),
    slipokRawResponse: jsonb("slipok_raw_response"),
    reviewedByAdmin: boolean("reviewed_by_admin").default(false).notNull(),
    ...auditColumns,
  },
  (table) => [
    index("payment_slips_lead_id_idx").on(table.leadId),
    uniqueIndex("payment_slips_source_attachment_unique").on(table.sourceType, table.archiveAttachmentId),
    foreignKey({
      columns: [table.leadId],
      foreignColumns: [customerLeads.id],
      name: "payment_slips_lead_id_customer_leads_id_fk",
    }).onDelete("set null"),
  ],
);

export const technicianTeams = pgTable(
  "technician_teams",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 8 }).notNull().unique(),
    name: varchar("name", { length: 80 }).notNull(),
    shortName: varchar("short_name", { length: 40 }).notNull(),
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...auditColumns,
  },
  (table) => [
    index("technician_teams_active_sort_idx").on(table.active, table.sortOrder, table.code),
  ],
);

// Single-row settings table: the admin picks one of a curated list of Google
// Cloud TTS th-TH voices for น้องไนท์ (see google-tts.ts). A missing/empty
// table is expected before this feature is first used, so callers must
// always fall back to the hardcoded default voice rather than assume a row
// exists.
export const supportVoiceSettings = pgTable("support_voice_settings", {
  id: serial("id").primaryKey(),
  voiceName: varchar("voice_name", { length: 64 }).notNull(),
  languageCode: varchar("language_code", { length: 16 }).notNull().default("th-TH"),
  speakingRate: real("speaking_rate").notNull().default(1.0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Photos taken at a job site (survey/installation/service/completed) and
// optionally linked back to a lead once staff identify which job they
// belong to -- leadId and jobCode both stay nullable since a photo is often
// received (e.g. via LINE) before it has been matched to a lead.
export const sitePhotos = pgTable(
  "site_photos",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id"),
    jobCode: varchar("job_code", { length: 32 }),
    imageUrl: text("image_url").notNull(),
    description: text("description"),
    stage: varchar("stage", { length: 32 }).notNull().default("installation"),
    senderName: varchar("sender_name", { length: 64 }),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("site_photos_job_code_idx").on(table.jobCode),
    index("site_photos_lead_id_idx").on(table.leadId),
  ],
);

export type BasinPrice = typeof basinPrices.$inferSelect;
export type BasinCategory = typeof basinCategories.$inferSelect;
export type InstalledStoneCategory = typeof installedStoneCategories.$inferSelect;
export type InstalledStonePrice = typeof installedStonePrices.$inferSelect;
export type SheetStonePrice = typeof sheetStonePrices.$inferSelect;
export type CustomerAccount = typeof customerAccounts.$inferSelect;
export type CustomerSession = typeof customerSessions.$inferSelect;
export type AdminMember = typeof adminMembers.$inferSelect;
export type AdminInvite = typeof adminInvites.$inferSelect;
export type AdminApiKey = typeof adminApiKeys.$inferSelect;

export type CustomerProfileUpdateConfirmation = typeof customerProfileUpdateConfirmations.$inferSelect;
export type SupportProfileUpdate = typeof supportProfileUpdates.$inferSelect;
export type CustomerLead = typeof customerLeads.$inferSelect;
export type LeadExternalReference = typeof leadExternalReferences.$inferSelect;
export type PaymentSlip = typeof paymentSlips.$inferSelect;
export type TechnicianTeamRow = typeof technicianTeams.$inferSelect;
export type SupportVoiceSettingsRow = typeof supportVoiceSettings.$inferSelect;
export type SitePhoto = typeof sitePhotos.$inferSelect;
