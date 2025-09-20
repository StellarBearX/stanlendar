import { 
  Controller, 
  Get, 
  Put, 
  Post,
  Body, 
  Param, 
  UseGuards,
  BadRequestException,
  NotFoundException
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReminderService, ReminderSettings, UserReminderPreferences } from './reminder.service';

interface UpdateReminderSettingsDto {
  enabled: boolean;
  minutes: number;
  method: 'email' | 'popup';
}

interface UpdateUserReminderPreferencesDto {
  globalDefault?: ReminderSettings;
  subjectSettings?: Record<string, ReminderSettings>;
}

interface BulkUpdateSubjectRemindersDto {
  reminderSettings: ReminderSettings;
}

@Controller('api/reminders')
@UseGuards(AuthGuard)
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  /**
   * Get user's reminder preferences
   */
  @Get()
  async getUserReminderPreferences(
    @CurrentUser('id') userId: string
  ): Promise<UserReminderPreferences> {
    return this.reminderService.getUserReminderPreferences(userId);
  }

  /**
   * Update user's reminder preferences
   */
  @Put()
  async updateUserReminderPreferences(
    @CurrentUser('id') userId: string,
    @Body() updateDto: UpdateUserReminderPreferencesDto
  ): Promise<UserReminderPreferences> {
    // Validate all reminder settings
    const allSettings = [
      ...(updateDto.globalDefault ? [updateDto.globalDefault] : []),
      ...(updateDto.subjectSettings ? Object.values(updateDto.subjectSettings) : [])
    ];

    for (const settings of allSettings) {
      const validation = this.reminderService.validateReminderSettings(settings);
      if (!validation.valid) {
        throw new BadRequestException(`Invalid reminder settings: ${validation.errors.join(', ')}`);
      }
    }

    return this.reminderService.updateUserReminderPreferences(userId, updateDto);
  }

  /**
   * Get reminder settings for a specific subject
   */
  @Get('subjects/:subjectId')
  async getSubjectReminderSettings(
    @CurrentUser('id') userId: string,
    @Param('subjectId') subjectId: string
  ): Promise<ReminderSettings> {
    try {
      return await this.reminderService.getSubjectDefaultReminder(subjectId);
    } catch (error) {
      throw new NotFoundException(`Subject ${subjectId} not found`);
    }
  }

  /**
   * Update reminder settings for a specific subject
   */
  @Put('subjects/:subjectId')
  async updateSubjectReminderSettings(
    @CurrentUser('id') userId: string,
    @Param('subjectId') subjectId: string,
    @Body() updateDto: UpdateReminderSettingsDto
  ): Promise<{ success: boolean; message: string }> {
    // Validate reminder settings
    const validation = this.reminderService.validateReminderSettings(updateDto);
    if (!validation.valid) {
      throw new BadRequestException(`Invalid reminder settings: ${validation.errors.join(', ')}`);
    }

    try {
      await this.reminderService.updateSubjectReminderSettings(userId, subjectId, updateDto);
      return {
        success: true,
        message: 'Subject reminder settings updated successfully'
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException(`Subject ${subjectId} not found`);
      }
      throw error;
    }
  }

  /**
   * Bulk update reminder settings for all events of a subject
   */
  @Post('subjects/:subjectId/bulk-update')
  async bulkUpdateSubjectReminders(
    @CurrentUser('id') userId: string,
    @Param('subjectId') subjectId: string,
    @Body() updateDto: BulkUpdateSubjectRemindersDto
  ): Promise<{ updated: number; failed: number; message: string }> {
    // Validate reminder settings
    const validation = this.reminderService.validateReminderSettings(updateDto.reminderSettings);
    if (!validation.valid) {
      throw new BadRequestException(`Invalid reminder settings: ${validation.errors.join(', ')}`);
    }

    try {
      const result = await this.reminderService.updateSubjectEventsReminders(
        userId, 
        subjectId, 
        updateDto.reminderSettings
      );

      return {
        ...result,
        message: `Updated reminder settings for ${result.updated} events. ${result.failed} failed.`
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException(`Subject ${subjectId} not found`);
      }
      throw error;
    }
  }

  /**
   * Get reminder settings for a specific event
   */
  @Get('events/:eventId')
  async getEventReminderSettings(
    @Param('eventId') eventId: string
  ): Promise<ReminderSettings[]> {
    return this.reminderService.getEventReminderSettings(eventId);
  }

  /**
   * Get reminder presets for UI
   */
  @Get('presets')
  getReminderPresets(): Array<{ label: string; minutes: number; method: 'email' | 'popup' }> {
    return this.reminderService.getReminderPresets();
  }
}