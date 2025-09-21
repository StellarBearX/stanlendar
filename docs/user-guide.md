# Class Schedule Sync - User Guide

Welcome to Class Schedule Sync! This guide will help you get started with managing your academic schedule and syncing it with Google Calendar.

## Getting Started

### 1. Sign In

1. Visit the application homepage
2. Click "Sign in with Google"
3. Authorize the application to access your Google Calendar
4. You'll be redirected to your dashboard

### 2. Dashboard Overview

Your dashboard displays your class schedule in a calendar format with:
- **Month View**: See your entire month at a glance
- **Week View**: Focus on your weekly schedule
- **Agenda View**: List view of upcoming classes

Each class is color-coded by subject for easy identification.

## Adding Classes

### Quick Add Class

The fastest way to add a single class:

1. Click "Quick Add Class" button
2. Fill in the required information:
   - **Subject Name**: e.g., "Software Project Management"
   - **Subject Code**: e.g., "960200" (optional)
   - **Section**: e.g., "001"
   - **Days**: Select which days the class occurs
   - **Time**: Start and end time
   - **Room**: Classroom location
   - **Date Range**: Semester start and end dates
   - **Skip Dates**: Any dates to exclude (holidays, etc.)
3. Click "Add Class"

The class will appear immediately in your calendar and generate recurring events for the entire semester.

### Import from File

For adding multiple classes at once:

1. Go to "Import" page
2. Upload a CSV or XLSX file with your schedule
3. Map the columns to the required fields:
   - Subject Name/Code
   - Section
   - Days of Week
   - Start/End Time
   - Room
   - Date Range
4. Preview the data and fix any errors
5. Click "Import" to add all classes

#### File Format Example (CSV)
```csv
Subject,Code,Section,Days,Start Time,End Time,Room,Start Date,End Date
Software Project Management,960200,001,"MO,WE",09:00,10:30,Room 301,2024-01-15,2024-05-15
Database Systems,960300,002,"TU,TH",13:00,14:30,Lab 201,2024-01-15,2024-05-15
```

## Using Spotlight Filter

The Spotlight filter helps you quickly find and focus on specific classes:

### Text Search
- Type in the search box to find classes by:
  - Subject name
  - Room number
  - Instructor name
  - Section code

### Filter by Subject/Section
- Click on subject chips to filter by specific subjects
- Select multiple subjects to see only those classes
- Use section filters to focus on specific sections

### View Modes
- **Hide Others**: Show only matching classes
- **Dim Others**: Keep all classes visible but highlight matches

### Saved Filters
- Save frequently used filter combinations
- Give them custom names for easy access
- Quickly apply saved filters from the dropdown

## Google Calendar Sync

### Initial Sync

1. Click "Sync to Google Calendar"
2. Choose your sync options:
   - **Date Range**: Which months to sync
   - **Dry Run**: Preview changes without applying
3. Review the sync summary
4. Confirm to apply changes

### How Sync Works

- **Recurring Events**: Weekly classes are created as recurring Google Calendar events
- **Color Coding**: Subject colors are mapped to Google Calendar colors
- **Reminders**: Default 15-minute reminders are added
- **Updates**: Changes to local classes update Google Calendar events
- **Conflict Resolution**: If conflicts occur, you'll be prompted to resolve them

### Managing Synced Events

- Synced events have a special marker in Google Calendar
- Changes made in Google Calendar won't sync back (one-way sync)
- Delete events from the app to remove them from Google Calendar

## Reminder Settings

### Default Reminders
- All classes get 15-minute reminders by default
- Reminders appear as Google Calendar notifications

### Custom Reminders
1. Go to Settings
2. Configure reminders per subject:
   - Different reminder times for different subjects
   - Multiple reminders per class
   - Disable reminders for specific subjects

### Reminder Types
- **Popup**: Desktop notification
- **Email**: Email reminder (if enabled in Google Calendar)

## Managing Your Schedule

### Editing Classes

1. Click on a class in the calendar
2. Select "Edit" from the popup
3. Modify any details
4. Save changes
5. Sync to update Google Calendar

### Deleting Classes

1. Click on a class in the calendar
2. Select "Delete" from the popup
3. Confirm deletion
4. Sync to remove from Google Calendar

### Color Coding

1. Go to subject management
2. Click on a subject's color
3. Choose a new color
4. Save changes
5. Sync to update Google Calendar colors

## Settings

### Account Settings
- View your connected Google account
- Disconnect and reconnect if needed
- Export your data

### Sync Settings
- Configure automatic sync frequency
- Set default reminder preferences
- Choose sync conflict resolution preferences

### Privacy Settings
- Control what data is synced
- Manage data retention preferences

## Troubleshooting

### Common Issues

**Classes not appearing in Google Calendar**
- Check if sync was successful
- Verify Google Calendar permissions
- Try manual sync

**Wrong time zone**
- All times are stored in Asia/Bangkok timezone
- Check your Google Calendar timezone settings

**Import errors**
- Verify file format matches requirements
- Check for missing required fields
- Ensure date formats are correct (YYYY-MM-DD)

**Sync conflicts**
- Occurs when Google Calendar events are modified externally
- Use conflict resolution dialog to choose which version to keep
- Consider re-syncing if issues persist

### Getting Help

**Error Messages**
- Most errors include helpful suggestions
- Check the notification area for detailed error information

**Performance Issues**
- Try refreshing the page
- Clear browser cache if problems persist
- Check internet connection for sync issues

**Data Issues**
- Use export feature to backup your data
- Contact support if data appears corrupted

## Tips and Best Practices

### Organizing Your Schedule

1. **Use Consistent Naming**: Keep subject names consistent for better filtering
2. **Color Code Wisely**: Use distinct colors for different types of classes
3. **Regular Sync**: Sync regularly to keep Google Calendar updated
4. **Backup Data**: Periodically export your schedule as backup

### Efficient Workflow

1. **Import First**: Use file import for bulk schedule setup
2. **Quick Add for Changes**: Use quick add for individual class additions
3. **Filter Often**: Use saved filters for common views
4. **Sync After Changes**: Always sync after making schedule changes

### Managing Semester Changes

1. **Archive Old Semesters**: Export old schedules before clearing
2. **Bulk Import New Schedule**: Use import feature for new semester
3. **Update Reminders**: Review and update reminder preferences
4. **Clean Up Google Calendar**: Remove old semester events if needed

## Keyboard Shortcuts

- **Ctrl/Cmd + K**: Open Spotlight filter
- **Ctrl/Cmd + N**: Quick add class
- **Ctrl/Cmd + S**: Sync to Google Calendar
- **Escape**: Close dialogs and popups
- **Arrow Keys**: Navigate calendar views

## Data Export and Backup

### Exporting Your Schedule

1. Go to Settings
2. Click "Export Data"
3. Choose format (CSV, JSON, or iCal)
4. Download the file

### What's Included
- All subjects and sections
- Class schedules and recurring patterns
- Color preferences
- Saved filters
- Sync history

### Importing to Other Systems
- **CSV**: Can be imported to Excel or other calendar apps
- **iCal**: Can be imported to most calendar applications
- **JSON**: Technical format for data migration

## Privacy and Security

### Data Protection
- Your data is encrypted and stored securely
- Google Calendar access is limited to calendar events only
- No personal information beyond email and name is collected

### Account Security
- Use strong Google account security (2FA recommended)
- Regularly review connected applications in Google Account settings
- Log out from shared computers

### Data Retention
- Your data is kept as long as your account is active
- Inactive accounts are cleaned up after 2 years
- You can delete your account and data at any time

## Support and Feedback

### Getting Support
- Check this user guide first
- Look for error messages and suggestions in the app
- Contact support through the app's help section

### Providing Feedback
- Use the feedback form in the app
- Report bugs with detailed steps to reproduce
- Suggest new features through the feedback system

### Community
- Join our user community for tips and tricks
- Share your workflow optimizations
- Help other users with common questions

---

*Last updated: [Current Date]*
*Version: 1.0.0*