import {
  boolean,
  foreignKey,
  integer,
  index,
  jsonb,
  pgTable,
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
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("customer_leads_key_unique").on(table.leadKey),
    index("customer_leads_customer_account_id_idx").on(table.customerAccountId),
    foreignKey({
      columns: [table.customerAccountId],
      foreignColumns: [customerAccounts.id],
      name: "customer_leads_customer_account_id_customer_accounts_id_fk",
    }).onDelete("set null"),
  ],
);

export type BasinPrice = typeof basinPrices.$inferSelect;
export type BasinCategory = typeof basinCategories.$inferSelect;
export type InstalledStoneCategory = typeof installedStoneCategories.$inferSelect;
export type InstalledStonePrice = typeof installedStonePrices.$inferSelect;
export type SheetStonePrice = typeof sheetStonePrices.$inferSelect;
export type CustomerAccount = typeof customerAccounts.$inferSelect;
export type CustomerSession = typeof customerSessions.$inferSelect;

export type CustomerProfileUpdateConfirmation = typeof customerProfileUpdateConfirmations.$inferSelect;
export type SupportProfileUpdate = typeof supportProfileUpdates.$inferSelect;
export type CustomerLead = typeof customerLeads.$inferSelect;
