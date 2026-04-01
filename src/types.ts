export interface Medication {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'as-needed';
  daysOfWeek?: number[]; // 0-6 for Sunday-Saturday
  times: string[]; // ISO time strings like "08:00"
  startDate: string;
  endDate?: string;
  notes?: string;
  color: string;
  instructions?: 'Before Food' | 'After Food' | 'With Food' | 'Empty Stomach';
  totalPills?: number;
  takenPills?: number;
}

export interface DoseLog {
  id: string;
  medicationId: string;
  timestamp: string;
  status: 'taken' | 'skipped';
}
