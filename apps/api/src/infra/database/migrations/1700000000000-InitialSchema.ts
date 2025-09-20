import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
      CREATE TABLE "user" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "display_name" character varying NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "last_login_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_user_email" UNIQUE ("email"),
        CONSTRAINT "PK_user_id" PRIMARY KEY ("id")
      )
    `);

    // Create calendar_account table
    await queryRunner.query(`
      CREATE TABLE "calendar_account" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "provider" character varying NOT NULL CHECK ("provider" = 'google'),
        "google_sub" character varying NOT NULL,
        "access_token_enc" character varying NOT NULL,
        "refresh_token_enc" character varying NOT NULL,
        "token_expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "primary_calendar_id" character varying,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_calendar_account_provider_google_sub" UNIQUE ("provider", "google_sub"),
        CONSTRAINT "PK_calendar_account_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_calendar_account_user_id" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);

    // Create subject table
    await queryRunner.query(`
      CREATE TABLE "subject" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "code" character varying,
        "name" character varying NOT NULL,
        "color_hex" character varying NOT NULL,
        "meta" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_subject_user_code_name" UNIQUE ("user_id", "code", "name"),
        CONSTRAINT "PK_subject_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_subject_user_id" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);

    // Create section table
    await queryRunner.query(`
      CREATE TABLE "section" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "subject_id" uuid NOT NULL,
        "sec_code" character varying NOT NULL,
        "teacher" character varying,
        "room" character varying,
        "schedule_rules" jsonb NOT NULL,
        CONSTRAINT "UQ_section_subject_sec_code" UNIQUE ("subject_id", "sec_code"),
        CONSTRAINT "PK_section_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_section_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subject"("id") ON DELETE CASCADE
      )
    `);

    // Create local_event table
    await queryRunner.query(`
      CREATE TABLE "local_event" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "subject_id" uuid NOT NULL,
        "section_id" uuid NOT NULL,
        "event_date" date NOT NULL,
        "start_time" time NOT NULL,
        "end_time" time NOT NULL,
        "room" character varying,
        "title_override" character varying,
        "status" character varying NOT NULL DEFAULT 'planned' CHECK ("status" IN ('planned', 'synced', 'deleted')),
        "gcal_event_id" character varying,
        "gcal_etag" character varying,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_local_event_unique" UNIQUE ("user_id", "subject_id", "section_id", "event_date", "start_time", "end_time"),
        CONSTRAINT "PK_local_event_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_local_event_user_id" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_local_event_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subject"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_local_event_section_id" FOREIGN KEY ("section_id") REFERENCES "section"("id") ON DELETE CASCADE
      )
    `);

    // Create saved_filter table
    await queryRunner.query(`
      CREATE TABLE "saved_filter" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "query" jsonb NOT NULL,
        CONSTRAINT "UQ_saved_filter_user_name" UNIQUE ("user_id", "name"),
        CONSTRAINT "PK_saved_filter_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_saved_filter_user_id" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);

    // Create import_job table
    await queryRunner.query(`
      CREATE TABLE "import_job" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "source_type" character varying NOT NULL CHECK ("source_type" IN ('csv', 'xlsx')),
        "column_map" jsonb,
        "state" character varying NOT NULL CHECK ("state" IN ('pending', 'preview', 'applied', 'failed')),
        "error_message" character varying,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_import_job_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_import_job_user_id" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);

    // Create import_item table
    await queryRunner.query(`
      CREATE TABLE "import_item" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "import_job_id" uuid NOT NULL,
        "raw_row" jsonb NOT NULL,
        "subject_id" uuid,
        "section_id" uuid,
        "start_date" date,
        "end_date" date,
        "days_of_week" character varying,
        "start_time" time,
        "end_time" time,
        "room" character varying,
        "note" character varying,
        "status" character varying NOT NULL DEFAULT 'preview' CHECK ("status" IN ('preview', 'created', 'skipped', 'failed')),
        CONSTRAINT "PK_import_item_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_import_item_job_id" FOREIGN KEY ("import_job_id") REFERENCES "import_job"("id") ON DELETE CASCADE
      )
    `);

    // Create performance indexes
    await queryRunner.query(`CREATE INDEX "idx_event_user_date" ON "local_event" ("user_id", "event_date")`);
    await queryRunner.query(`CREATE INDEX "idx_subject_user_name" ON "subject" ("user_id", "name")`);
    await queryRunner.query(`CREATE INDEX "idx_section_subject_seccode" ON "section" ("subject_id", "sec_code")`);
    await queryRunner.query(`CREATE INDEX "idx_calendar_account_user" ON "calendar_account" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_import_job_user_state" ON "import_job" ("user_id", "state")`);

    // Create full-text search index for Spotlight
    await queryRunner.query(`
      CREATE INDEX "idx_subject_search" ON "subject" 
      USING GIN (to_tsvector('english', "name" || ' ' || COALESCE("code", '')))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_subject_search"`);
    await queryRunner.query(`DROP INDEX "idx_import_job_user_state"`);
    await queryRunner.query(`DROP INDEX "idx_calendar_account_user"`);
    await queryRunner.query(`DROP INDEX "idx_section_subject_seccode"`);
    await queryRunner.query(`DROP INDEX "idx_subject_user_name"`);
    await queryRunner.query(`DROP INDEX "idx_event_user_date"`);
    await queryRunner.query(`DROP TABLE "import_item"`);
    await queryRunner.query(`DROP TABLE "import_job"`);
    await queryRunner.query(`DROP TABLE "saved_filter"`);
    await queryRunner.query(`DROP TABLE "local_event"`);
    await queryRunner.query(`DROP TABLE "section"`);
    await queryRunner.query(`DROP TABLE "subject"`);
    await queryRunner.query(`DROP TABLE "calendar_account"`);
    await queryRunner.query(`DROP TABLE "user"`);
  }
}