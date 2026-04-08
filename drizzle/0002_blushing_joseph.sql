DELETE FROM "activity_logs";--> statement-breakpoint
DELETE FROM "reminders";--> statement-breakpoint
DELETE FROM "subtasks";--> statement-breakpoint
DELETE FROM "todos";--> statement-breakpoint
DELETE FROM "lists";--> statement-breakpoint
ALTER TABLE "lists" DROP CONSTRAINT "lists_name_unique";--> statement-breakpoint
ALTER TABLE "activity_logs" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lists_user_id_idx" ON "lists" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lists_user_id_name_unique" ON "lists" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "todos_user_id_idx" ON "todos" USING btree ("user_id");
