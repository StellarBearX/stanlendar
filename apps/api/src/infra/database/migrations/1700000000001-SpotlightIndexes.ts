import { MigrationInterface, QueryRunner } from 'typeorm';

export class SpotlightIndexes1700000000001 implements MigrationInterface {
  name = 'SpotlightIndexes1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Additional indexes for Spotlight search performance
    
    // Index for section teacher and room full-text search
    await queryRunner.query(`
      CREATE INDEX "idx_section_teacher_room_search" ON "section" 
      USING GIN (to_tsvector('english', COALESCE("teacher", '') || ' ' || COALESCE("room", '')))
    `);

    // Index for local_event room and title search
    await queryRunner.query(`
      CREATE INDEX "idx_event_room_title_search" ON "local_event" 
      USING GIN (to_tsvector('english', COALESCE("room", '') || ' ' || COALESCE("title_override", '')))
    `);

    // Composite index for event filtering by user, status, and date range
    await queryRunner.query(`
      CREATE INDEX "idx_event_user_status_date" ON "local_event" 
      ("user_id", "status", "event_date")
    `);

    // Index for section code search (case-insensitive)
    await queryRunner.query(`
      CREATE INDEX "idx_section_seccode_lower" ON "section" 
      (LOWER("sec_code"))
    `);

    // Index for subject code search (case-insensitive)
    await queryRunner.query(`
      CREATE INDEX "idx_subject_code_lower" ON "subject" 
      (LOWER("code"))
    `);

    // Index for teacher name search (case-insensitive)
    await queryRunner.query(`
      CREATE INDEX "idx_section_teacher_lower" ON "section" 
      (LOWER("teacher"))
    `);

    // Index for room search (case-insensitive)
    await queryRunner.query(`
      CREATE INDEX "idx_section_room_lower" ON "section" 
      (LOWER("room"))
    `);

    // Partial index for non-deleted events (most common query)
    await queryRunner.query(`
      CREATE INDEX "idx_event_active" ON "local_event" 
      ("user_id", "event_date", "start_time") 
      WHERE "status" != 'deleted'
    `);

    // Index for event time range queries
    await queryRunner.query(`
      CREATE INDEX "idx_event_time_range" ON "local_event" 
      ("event_date", "start_time", "end_time")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_event_time_range"`);
    await queryRunner.query(`DROP INDEX "idx_event_active"`);
    await queryRunner.query(`DROP INDEX "idx_section_room_lower"`);
    await queryRunner.query(`DROP INDEX "idx_section_teacher_lower"`);
    await queryRunner.query(`DROP INDEX "idx_subject_code_lower"`);
    await queryRunner.query(`DROP INDEX "idx_section_seccode_lower"`);
    await queryRunner.query(`DROP INDEX "idx_event_user_status_date"`);
    await queryRunner.query(`DROP INDEX "idx_event_room_title_search"`);
    await queryRunner.query(`DROP INDEX "idx_section_teacher_room_search"`);
  }
}