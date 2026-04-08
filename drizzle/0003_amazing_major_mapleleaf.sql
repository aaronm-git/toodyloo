CREATE TABLE "anonymous_ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" text NOT NULL,
	"date_key" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "anonymous_ai_usage_ip_hash_idx" ON "anonymous_ai_usage" USING btree ("ip_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "anonymous_ai_usage_ip_hash_date_key_unique" ON "anonymous_ai_usage" USING btree ("ip_hash","date_key");