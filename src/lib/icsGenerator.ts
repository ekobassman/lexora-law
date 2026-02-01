/**
 * ICS Calendar File Generator
 * Generates .ics files compatible with Apple Calendar, Google Calendar, and Outlook
 */

export interface Reminder {
  type: 'days' | 'hours' | 'minutes';
  value: number;
}

interface CalendarEvent {
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  url?: string;
  reminders?: Reminder[];
}

/**
 * Format date to ICS format with timezone (YYYYMMDDTHHMMSS)
 */
function formatDateToICS(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

/**
 * Get IANA timezone identifier
 */
function getTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';
}

/**
 * Generate a unique ID for the calendar event
 */
function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@lexora.app`;
}

/**
 * Escape special characters in ICS text fields
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Convert reminder to minutes
 */
function reminderToMinutes(reminder: Reminder): number {
  switch (reminder.type) {
    case 'days':
      return reminder.value * 24 * 60;
    case 'hours':
      return reminder.value * 60;
    case 'minutes':
      return reminder.value;
    default:
      return reminder.value * 24 * 60;
  }
}

/**
 * Generate ICS file content with proper timezone support
 */
export function generateICSContent(event: CalendarEvent): string {
  const uid = generateUID();
  const timezone = getTimezone();
  const now = formatDateToICS(new Date());
  const startDate = formatDateToICS(event.startDate);
  const endDate = event.endDate 
    ? formatDateToICS(event.endDate) 
    : formatDateToICS(new Date(event.startDate.getTime() + 30 * 60 * 1000)); // 30 min default

  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lexora//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // Add timezone definition
    'BEGIN:VTIMEZONE',
    `TZID:${timezone}`,
    'BEGIN:STANDARD',
    'DTSTART:19710101T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19710101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=${timezone}:${startDate}`,
    `DTEND;TZID=${timezone}:${endDate}`,
    `SUMMARY:${escapeICSText(event.title)}`,
    `DESCRIPTION:${escapeICSText(event.description)}`,
  ];

  if (event.location) {
    icsContent.push(`LOCATION:${escapeICSText(event.location)}`);
  }

  if (event.url) {
    icsContent.push(`URL:${event.url}`);
  }

  // Add reminders (alarms)
  if (event.reminders && event.reminders.length > 0) {
    for (const reminder of event.reminders) {
      const minutesBefore = reminderToMinutes(reminder);
      icsContent.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeICSText(event.title)}`,
        `TRIGGER:-PT${minutesBefore}M`,
        'END:VALARM'
      );
    }
  }

  icsContent.push('END:VEVENT', 'END:VCALENDAR');

  return icsContent.join('\r\n');
}

/**
 * Download ICS file
 */
export function downloadICSFile(event: CalendarEvent, filename?: string): void {
  const content = generateICSContent(event);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${event.title.replace(/[^a-z0-9]/gi, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Create a deadline calendar event for a pratica
 */
export function createPraticaDeadlineEvent(
  praticaTitle: string,
  authority: string | null,
  aktenzeichen: string | null,
  deadline: Date,
  praticaUrl: string,
  reminders: Reminder[] = [{ type: 'days', value: 3 }, { type: 'days', value: 1 }],
  language: string = 'DE'
): CalendarEvent {
  const titlePrefix = language === 'IT' ? 'Scadenza' : language === 'EN' ? 'Deadline' : 'Frist';
  
  const description = [
    `Pratica: ${praticaTitle}`,
    authority ? `Behörde: ${authority}` : null,
    aktenzeichen ? `Az.: ${aktenzeichen}` : null,
    '',
    `Link: ${praticaUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    title: `${titlePrefix} – ${praticaTitle}`,
    description,
    startDate: deadline,
    location: authority || undefined,
    url: praticaUrl,
    reminders,
  };
}

/**
 * Default reminders configuration
 */
export const DEFAULT_REMINDERS: Reminder[] = [
  { type: 'days', value: 3 },
  { type: 'days', value: 1 },
];
