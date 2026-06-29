export interface Task {
  id: string;
  title: string;
  deadline: string; // Date-time string "YYYY-MM-DDTHH:MM"
  importance: 'Critical' | 'High' | 'Medium' | 'Low';
  category: 'Work' | 'Study' | 'Personal' | 'Health';
  estimatedEffort: string; // e.g. "1h", "2h", "45m"
  completed: boolean;
  notes?: string;
  gcalEventId?: string;
  syncedToGCal?: boolean;
}

export interface TaskResponseItem {
  task: string;
  urgency: string;
  steps: string[];
}

export interface AnalysisParsed {
  priority_level: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  priority_order: string[];
  task_breakdowns: TaskResponseItem[];
  schedule: string[];
  risk_alerts: string[];
  productivity_tip: string;
  next_action: string;
  emergency_mode: boolean;
}

export interface SubtaskState {
  [stepKey: string]: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
