CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."coupon_kind" AS ENUM('PERCENT', 'FIXED');--> statement-breakpoint
CREATE TYPE "public"."coupon_status" AS ENUM('ACTIVE', 'DISABLED');--> statement-breakpoint
CREATE TYPE "public"."restock_alert_status" AS ENUM('PENDING', 'NOTIFIED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('PENDING', 'PUBLISHED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."tournament_registration_payment_status" AS ENUM('UNPAID', 'PAID', 'WAIVED');--> statement-breakpoint
CREATE TYPE "public"."tournament_registration_status" AS ENUM('REGISTERED', 'WAITLISTED', 'CHECKED_IN', 'CANCELLED');--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'BANK_TRANSFER';--> statement-breakpoint
CREATE TABLE "coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"amount_vnd" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_redemptions_order_unique" UNIQUE("order_id"),
	CONSTRAINT "coupon_redemptions_amount_check" CHECK ("coupon_redemptions"."amount_vnd" > 0)
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"kind" "coupon_kind" NOT NULL,
	"value" integer NOT NULL,
	"min_order_vnd" integer DEFAULT 0 NOT NULL,
	"max_discount_vnd" integer,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"status" "coupon_status" DEFAULT 'ACTIVE' NOT NULL,
	"note" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code"),
	CONSTRAINT "coupons_code_check" CHECK ("coupons"."code" = upper("coupons"."code")),
	CONSTRAINT "coupons_code_format_check" CHECK ("coupons"."code" ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
	CONSTRAINT "coupons_value_check" CHECK ("coupons"."value" > 0),
	CONSTRAINT "coupons_percent_check" CHECK ("coupons"."kind" <> 'PERCENT' or "coupons"."value" <= 100),
	CONSTRAINT "coupons_min_order_check" CHECK ("coupons"."min_order_vnd" >= 0),
	CONSTRAINT "coupons_max_discount_check" CHECK ("coupons"."max_discount_vnd" is null or "coupons"."max_discount_vnd" > 0),
	CONSTRAINT "coupons_usage_limit_check" CHECK ("coupons"."usage_limit" is null or "coupons"."usage_limit" > 0),
	CONSTRAINT "coupons_used_count_check" CHECK ("coupons"."used_count" >= 0 and ("coupons"."usage_limit" is null or "coupons"."used_count" <= "coupons"."usage_limit")),
	CONSTRAINT "coupons_window_check" CHECK ("coupons"."ends_at" is null or "coupons"."starts_at" is null or "coupons"."ends_at" > "coupons"."starts_at"),
	CONSTRAINT "coupons_version_check" CHECK ("coupons"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "restock_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"status" "restock_alert_status" DEFAULT 'PENDING' NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restock_alerts_variant_email_unique" UNIQUE("variant_id","email"),
	CONSTRAINT "restock_alerts_email_check" CHECK ("restock_alerts"."email" = lower("restock_alerts"."email") and "restock_alerts"."email" ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
	CONSTRAINT "restock_alerts_notified_check" CHECK ("restock_alerts"."status" <> 'NOTIFIED' or "restock_alerts"."notified_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"order_id" uuid,
	"author_name" text NOT NULL,
	"rating" integer NOT NULL,
	"body" text NOT NULL,
	"status" "review_status" DEFAULT 'PENDING' NOT NULL,
	"moderated_by" text,
	"moderated_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_reviews_order_product_unique" UNIQUE("order_id","product_id"),
	CONSTRAINT "product_reviews_rating_check" CHECK ("product_reviews"."rating" between 1 and 5),
	CONSTRAINT "product_reviews_author_check" CHECK (length(btrim("product_reviews"."author_name")) between 2 and 120),
	CONSTRAINT "product_reviews_body_check" CHECK (length(btrim("product_reviews"."body")) between 10 and 2000),
	CONSTRAINT "product_reviews_published_check" CHECK ("product_reviews"."status" <> 'PUBLISHED' or "product_reviews"."published_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "tournament_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"note" text,
	"status" "tournament_registration_status" DEFAULT 'REGISTERED' NOT NULL,
	"payment_status" "tournament_registration_payment_status" DEFAULT 'UNPAID' NOT NULL,
	"paid_at" timestamp with time zone,
	"checked_in_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_registrations_tournament_phone_unique" UNIQUE("tournament_id","phone"),
	CONSTRAINT "tournament_registrations_name_check" CHECK (length(btrim("tournament_registrations"."full_name")) between 2 and 120),
	CONSTRAINT "tournament_registrations_phone_check" CHECK ("tournament_registrations"."phone" ~ '^[0-9+][0-9 .-]{7,19}$'),
	CONSTRAINT "tournament_registrations_checked_in_check" CHECK ("tournament_registrations"."status" <> 'CHECKED_IN' or "tournament_registrations"."checked_in_at" is not null),
	CONSTRAINT "tournament_registrations_cancelled_check" CHECK ("tournament_registrations"."status" <> 'CANCELLED' or "tournament_registrations"."cancelled_at" is not null),
	CONSTRAINT "tournament_registrations_paid_check" CHECK ("tournament_registrations"."payment_status" <> 'PAID' or "tournament_registrations"."paid_at" is not null),
	CONSTRAINT "tournament_registrations_version_check" CHECK ("tournament_registrations"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_total_check";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_vnd" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coupon_id" uuid;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restock_alerts" ADD CONSTRAINT "restock_alerts_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coupon_redemptions_coupon_created_idx" ON "coupon_redemptions" USING btree ("coupon_id","created_at");--> statement-breakpoint
CREATE INDEX "coupons_status_created_idx" ON "coupons" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "restock_alerts_status_created_idx" ON "restock_alerts" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "product_reviews_product_status_created_idx" ON "product_reviews" USING btree ("product_id","status","created_at");--> statement-breakpoint
CREATE INDEX "product_reviews_status_created_idx" ON "product_reviews" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "tournament_registrations_tournament_status_idx" ON "tournament_registrations" USING btree ("tournament_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_lower_unique" ON "user" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_trgm_idx" ON "audit_logs" USING gin ("action" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "audit_logs_subject_id_trgm_idx" ON "audit_logs" USING gin ("subject_id" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "product_variants_sku_trgm_idx" ON "product_variants" USING gin ("sku" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "products_admin_updated_idx" ON "products" USING btree ("updated_at","id");--> statement-breakpoint
CREATE INDEX "products_active_slug_idx" ON "products" USING btree ("slug") WHERE "products"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "products_active_featured_idx" ON "products" USING btree ("featured","published_at","id") WHERE "products"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "products_title_trgm_idx" ON "products" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "products_slug_trgm_idx" ON "products" USING gin ("slug" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "email_outbox_processing_idx" ON "email_outbox" USING btree ("updated_at") WHERE "email_outbox"."status" = 'PROCESSING';--> statement-breakpoint
CREATE INDEX "inventories_available_expr_idx" ON "inventories" USING btree (("on_hand" - "reserved"));--> statement-breakpoint
CREATE INDEX "inventories_updated_idx" ON "inventories" USING btree ("updated_at","variant_id");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "orders_reservation_expiry_idx" ON "orders" USING btree ("reservation_expires_at") WHERE "orders"."order_status" = 'PENDING_PAYMENT' and "orders"."payment_status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "payments_created_idx" ON "payments" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "payments_reference_trgm_idx" ON "payments" USING gin ("provider_reference" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "payments_transaction_trgm_idx" ON "payments" USING gin ("provider_transaction_id" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "tournaments_updated_idx" ON "tournaments" USING btree ("updated_at","id");--> statement-breakpoint
CREATE INDEX "tournaments_title_trgm_idx" ON "tournaments" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_id_unique" UNIQUE("product_id","id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_active_published_check" CHECK ("products"."status" <> 'ACTIVE' or "products"."published_at" is not null);--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_released_check" CHECK ("inventory_reservations"."status" <> 'RELEASED' or "inventory_reservations"."released_at" is not null);--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_committed_check" CHECK ("inventory_reservations"."status" <> 'COMMITTED' or "inventory_reservations"."committed_at" is not null);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_check" CHECK ("orders"."discount_vnd" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_limit_check" CHECK ("orders"."discount_vnd" <= "orders"."subtotal_vnd" + "orders"."shipping_vnd");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_check" CHECK ("orders"."coupon_id" is null or "orders"."discount_vnd" > 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_number_check" CHECK ("orders"."order_number" ~ '^MB-[0-9A-F]{20}$');--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_vnpay_reservation_check" CHECK ("orders"."payment_method" <> 'VNPAY' or "orders"."reservation_expires_at" is not null);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelled_at_check" CHECK ("orders"."order_status" <> 'CANCELLED' or "orders"."cancelled_at" is not null);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_completed_at_check" CHECK ("orders"."order_status" <> 'COMPLETED' or "orders"."completed_at" is not null);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_check" CHECK ("orders"."total_vnd" = "orders"."subtotal_vnd" + "orders"."shipping_vnd" - "orders"."discount_vnd");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_paid_at_check" CHECK ("payments"."status" <> 'PAID' or "payments"."paid_at" is not null);--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_cancelled_at_check" CHECK (not "tournaments"."cancelled" or "tournaments"."cancelled_at" is not null);