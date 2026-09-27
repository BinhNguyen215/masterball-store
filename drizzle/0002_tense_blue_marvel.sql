ALTER TABLE "user" DROP CONSTRAINT "user_role_check";--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_check" CHECK ("user"."role" in ('OWNER', 'CATALOG_MANAGER', 'ORDER_STAFF', 'EVENT_EDITOR', 'CUSTOMER'));