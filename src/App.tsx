/**
 * OnTime AI - Your Intelligent Productivity Companion
 * Crafted with Blue, White, and Light Gray material aesthetic.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Plus, 
  Play, 
  Pause, 
  RotateCcw, 
  Sparkles, 
  Brain, 
  Timer, 
  Calendar, 
  TrendingUp, 
  Copy, 
  Check, 
  Clock, 
  Heart, 
  Info, 
  Grid, 
  ExternalLink, 
  ChevronRight, 
  ListTodo,
  Edit2,
  Trash,
  User,
  MessageSquare,
  Send,
  Activity,
  Settings,
  Sun,
  Moon,
  Zap,
  BookOpen,
  PieChart,
  Bell,
  RefreshCw,
  Award,
  Sliders,
  Headphones
} from 'lucide-react';
import { Task, TaskResponseItem, AnalysisParsed, SubtaskState, ChatMessage } from './types';
import { 
  auth, 
  googleProvider, 
  GoogleAuthProvider,
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  db,
  doc,
  setDoc,
  collection,
  getDocs,
  deleteDoc
} from './firebase';
import type { User as FirebaseUser } from './firebase';
import { Soundscapes } from './components/Soundscapes';

const formatToLocalDatetimeString = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function App() {
  // Sync time according to the device
  const [systemTime, setSystemTime] = useState<Date>(() => new Date());
  
  // Real-time ticking relative to the device's clock
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Theme support
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('ontime_theme') === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('ontime_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // User Authentication States
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authIsSignUp, setAuthIsSignUp] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [syncingWithCloud, setSyncingWithCloud] = useState<boolean>(false);

  // Track cloud load status to avoid overwriting cloud with local state too early
  const isCloudDataLoaded = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setSyncingWithCloud(true);
        try {
          // Fetch from Firestore
          const q = collection(db, 'users', user.uid, 'tasks');
          const querySnapshot = await getDocs(q);
          const cloudTasks: Task[] = [];
          querySnapshot.forEach((docSnap) => {
            cloudTasks.push({ id: docSnap.id, ...docSnap.data() } as Task);
          });

          if (cloudTasks.length > 0) {
            setTasks(cloudTasks);
          } else {
            // Upload local tasks to cloud if user is signing up or has local tasks
            const cached = localStorage.getItem('ontime_tasks');
            if (cached) {
              try {
                const localTasks = JSON.parse(cached) as Task[];
                if (localTasks.length > 0) {
                  for (const t of localTasks) {
                    await setDoc(doc(db, 'users', user.uid, 'tasks', t.id), {
                      title: t.title,
                      deadline: t.deadline,
                      importance: t.importance,
                      category: t.category,
                      estimatedEffort: t.estimatedEffort,
                      completed: t.completed,
                      notes: t.notes || ''
                    });
                  }
                  setTasks(localTasks);
                }
              } catch (e) {}
            }
          }
          isCloudDataLoaded.current = true;
        } catch (err) {
          console.error('Error loading tasks from Firestore:', err);
        } finally {
          setSyncingWithCloud(false);
        }
      } else {
        isCloudDataLoaded.current = false;
        // Optionally reload default/local storage tasks
        const cached = localStorage.getItem('ontime_tasks');
        if (cached) {
          try {
            setTasks(JSON.parse(cached));
          } catch (e) {}
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Sidebar Layout Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'chat' | 'emergency' | 'analytics' | 'calendar' | 'soundscape'>('dashboard');

  // Google Calendar Integration States
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarSyncing, setCalendarSyncing] = useState<boolean>(false);
  const [calendarSyncMessage, setCalendarSyncMessage] = useState<string | null>(null);

  // Form State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDeadline, setTaskDeadline] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59`;
  });
  const [taskImportance, setTaskImportance] = useState<'Critical' | 'High' | 'Medium' | 'Low'>('High');
  const [taskCategory, setTaskCategory] = useState<'Work' | 'Study' | 'Personal' | 'Health'>('Work');
  const [taskEffort, setTaskEffort] = useState('2h');
  const [taskNotes, setTaskNotes] = useState('');
  const [errorText, setErrorText] = useState('');

  // Editing Task State
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Work' | 'Study' | 'Personal' | 'Health'>('All');
  const [matrixFilter, setMatrixFilter] = useState<'All' | 'UI' | 'INU' | 'UNI' | 'NEITHER'>('All');

  // Scheduling Configurations
  const [availableHours, setAvailableHours] = useState<number>(8);
  const [preferredWorkHours, setPreferredWorkHours] = useState<string>('09:00 - 17:00');

  // Load Tasks from localStorage or Fallback Defaults
  const [tasks, setTasks] = useState<Task[]>(() => {
    const cached = localStorage.getItem('ontime_tasks');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // Fallback
      }
    }
    return [
      {
        id: 'task-1',
        title: 'Complete Final Security Audit Report',
        deadline: (() => {
          const d = new Date();
          d.setHours(d.getHours() + 4);
          return formatToLocalDatetimeString(d);
        })(), // ~4 hours away !
        importance: 'Critical',
        category: 'Work',
        estimatedEffort: '2h',
        completed: false,
        notes: 'Compile security logs, review package signatures, draft compliance resolution.'
      },
      {
        id: 'task-2',
        title: 'Prepare Slide Deck for Client Demo',
        deadline: (() => {
          const d = new Date();
          d.setDate(d.getDate() + 1); // tomorrow
          d.setHours(10, 0, 0, 0); // 10:00 AM
          return formatToLocalDatetimeString(d);
        })(), // ~22 hours away !
        importance: 'High',
        category: 'Work',
        estimatedEffort: '3h',
        completed: false,
        notes: 'Must address real-time integration latency charts.'
      },
      {
        id: 'task-3',
        title: 'Mindfulness & Cardio Strength Session',
        deadline: (() => {
          const d = new Date();
          d.setHours(21, 30, 0, 0); // today at 21:30
          return formatToLocalDatetimeString(d);
        })(), // ~9.5 hours away
        importance: 'Medium',
        category: 'Health',
        estimatedEffort: '1h',
        completed: false,
        notes: 'Restores executive brain clarity after extensive screens.'
      },
      {
        id: 'task-4',
        title: 'Draft Project Specs Proposal',
        deadline: (() => {
          const d = new Date();
          d.setDate(d.getDate() + 3); // 3 days away
          d.setHours(17, 0, 0, 0); // 17:00
          return formatToLocalDatetimeString(d);
        })(), // 3 days away
        importance: 'Medium',
        category: 'Study',
        estimatedEffort: '4h',
        completed: true,
        notes: 'Submit specifications to advisors.'
      }
    ];
  });

  // Save tasks on modification
  useEffect(() => {
    localStorage.setItem('ontime_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Pomodoro Timer State
  const [timerMode, setTimerMode] = useState<'focus' | 'short' | 'long'>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 mins
  const [timerRunning, setTimerRunning] = useState(false);
  const [selectedTaskForTimer, setSelectedTaskForTimer] = useState<string>('task-1');
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const cached = localStorage.getItem('ontime_chat_messages');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Error loading cached chat messages:', e);
      }
    }
    return [
      { role: 'assistant', content: 'Hi there! I am OnTime AI, your personal productivity analyst. I can plan your day, run interactive time blocking, prioritize work, or suggest emergency turnaround steps. Try typing a command or clicking one of the instant presets below!' }
    ];
  });
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // AI Analysis State
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [activeAnalysisMsg, setActiveAnalysisMsg] = useState('');
  const [customRequestInput, setCustomRequestInput] = useState('');
  const [rawOutputText, setRawOutputText] = useState<string>(() => {
    return localStorage.getItem('ontime_raw_analysis') || '';
  });

  const [parsedAnalysis, setParsedAnalysis] = useState<AnalysisParsed>(() => {
    const cached = localStorage.getItem('ontime_parsed_analysis');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    // Return pristine seed structure
    return {
      priority_level: 'High',
      priority_order: [
        'Complete Final Security Audit Report',
        'Prepare Slide Deck for Client Demo'
      ],
      task_breakdowns: [
        {
          task: 'Complete Final Security Audit Report',
          urgency: 'Action required - Overdue soon',
          steps: [
            'Audit package configurations & security signatures',
            'Integrate system log metrics on port 3000',
            'Draft remediation response report'
          ]
        },
        {
          task: 'Prepare Slide Deck for Client Demo',
          urgency: 'Looming deadline (under 24 hours)',
          steps: [
            'Create key introductory slides & architecture layout',
            'Incorporate telemetry metrics on visual dashboard',
            'Conduct practice demo with system engineer role'
          ]
        }
      ],
      schedule: [
        '09:30 - 11:30: Focus session on Security Audit',
        '11:30 - 12:00: Recharge split',
        '13:00 - 15:00: Slide deck demo practice iteration',
        '15:00 - 16:30: Mindful study specs draft writeups'
      ],
      risk_alerts: [
        'Critical alert: Security Audit Report deadline is due very soon!',
        'Prepare Slide Deck has a looming 22 hour threat limit.'
      ],
      productivity_tip: 'Apply the Eisenhower matrix to prevent last minute panic, and prioritize tasks using Pomodoro deep focus blocks.',
      next_action: 'Initialize a Pomodoro focus loop for the Security Audit Report right now.',
      emergency_mode: true
    };
  });

  // Track subtask checkoff states locally
  const [subtaskProgress, setSubtaskProgress] = useState<SubtaskState>(() => {
    const cached = localStorage.getItem('ontime_subtask_checklist');
    return cached ? JSON.parse(cached) : {};
  });

  useEffect(() => {
    localStorage.setItem('ontime_subtask_checklist', JSON.stringify(subtaskProgress));
  }, [subtaskProgress]);

  // Keep Cache Updated
  useEffect(() => {
    localStorage.setItem('ontime_parsed_analysis', JSON.stringify(parsedAnalysis));
    localStorage.setItem('ontime_raw_analysis', rawOutputText);
  }, [parsedAnalysis, rawOutputText]);

  // Alert system countdown relative to the closest task under 24 hours
  const [emergencyCountdown, setEmergencyCountdown] = useState<{
    title: string;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  // Sync scroll on chat and loading indicator (scoped locally to container)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'auto'
      });
    }
  }, [chatMessages, chatLoading]);

  // Persist chat messages
  useEffect(() => {
    localStorage.setItem('ontime_chat_messages', JSON.stringify(chatMessages));
  }, [chatMessages]);

  // Countdown clock tick
  useEffect(() => {
    const calcCountdown = () => {
      const activeTargets = tasks.filter(t => !t.completed && t.deadline);
      if (activeTargets.length === 0) {
        setEmergencyCountdown(null);
        return;
      }
      const sorted = [...activeTargets].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
      const imminent = sorted[0];
      const diffMs = new Date(imminent.deadline).getTime() - systemTime.getTime();

      if (diffMs > 0 && diffMs < 24 * 60 * 60 * 1000) {
        const diffSecs = Math.floor(diffMs / 1000);
        const hrs = Math.floor(diffSecs / 3600);
        const mins = Math.floor((diffSecs % 3600) / 60);
        const secs = diffSecs % 60;
        setEmergencyCountdown({
          title: imminent.title,
          hours: hrs,
          minutes: mins,
          seconds: secs
        });
      } else {
        setEmergencyCountdown(null);
      }
    };
    calcCountdown();
  }, [tasks, systemTime]);

  // Dynamic values
  const getDeadlineStatus = (deadlineStr: string) => {
    if (!deadlineStr) return { text: 'No strict deadline', color: 'text-slate-400 bg-slate-50 dark:bg-slate-800' };
    const deadline = new Date(deadlineStr);
    const diffMs = deadline.getTime() - systemTime.getTime();
    
    const isOverdue = diffMs < 0;
    const absDiffMs = Math.abs(diffMs);
    const diffMins = Math.floor(absDiffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (isOverdue) {
      if (diffDays > 0) return { text: `Overdue by ${diffDays}d`, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900 font-semibold' };
      if (diffHours > 0) return { text: `Overdue by ${diffHours}h`, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900 font-semibold shadow-xs' };
      return { text: `Overdue by ${diffMins}m`, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900 font-bold' };
    } else {
      if (diffDays > 0) {
        return { text: `Due in ${diffDays}d`, color: diffDays <= 1 ? 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30' : 'text-slate-600 bg-slate-50 dark:text-slate-300 dark:bg-slate-800' };
      }
      if (diffHours > 0) {
        return { text: `Due in ${diffHours}h`, color: 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 font-medium' };
      }
      return { text: `Due in ${diffMins}m`, color: 'text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 font-bold' };
    }
  };

  const getIsOverdue = (deadlineStr: string) => {
    if (!deadlineStr) return false;
    return new Date(deadlineStr).getTime() < systemTime.getTime();
  };

  const calculateProductivityScore = () => {
    const totalCount = tasks.length;
    if (totalCount === 0) return 0;
    
    const completedCount = tasks.filter(t => t.completed).length;
    let score = 0;
    
    // Completion contribution (0 - 50 points)
    score += Math.round((completedCount / totalCount) * 50);
    
    // Uncompleted urgency penalties (0 - 30 points)
    const overdueCount = tasks.filter(t => !t.completed && getIsOverdue(t.deadline)).length;
    const penalty = overdueCount * 10;
    let consistencyPoints = 30 - penalty;
    if (consistencyPoints < 0) consistencyPoints = 0;
    score += consistencyPoints;

    // Daily Focus Hours bonus (0 - 20 points)
    // Completed tasks and timer runs add up to focus bonus
    let focusBonus = Math.min(20, completedCount * 5);
    score += focusBonus;

    if (score > 100) score = 100;
    if (score < 10 && totalCount > 0) score = 10;
    return score;
  };

  const productivityScore = calculateProductivityScore();

  // Tasks Filter mapping
  const checkTaskQuadrant = (task: Task): 'UI' | 'INU' | 'UNI' | 'NEITHER' => {
    if (!task.deadline) return task.importance === 'Critical' || task.importance === 'High' ? 'INU' : 'NEITHER';
    const isUrgent = (new Date(task.deadline).getTime() - systemTime.getTime()) <= 24 * 60 * 60 * 1000;
    const isImportant = task.importance === 'Critical' || task.importance === 'High';
    
    if (isUrgent && isImportant) return 'UI';
    if (!isUrgent && isImportant) return 'INU';
    if (isUrgent && !isImportant) return 'UNI';
    return 'NEITHER';
  };

  const quadrantCounts = () => {
    let counts = { UI: 0, INU: 0, UNI: 0, NEITHER: 0 };
    tasks.forEach(t => {
      if (!t.completed) {
        counts[checkTaskQuadrant(t)]++;
      }
    });
    return counts;
  };
  const counts = quadrantCounts();

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = categoryFilter === 'All' || t.category === categoryFilter;
    const matchesMatrix = matrixFilter === 'All' || checkTaskQuadrant(t) === matrixFilter;

    return matchesSearch && matchesCategory && matchesMatrix;
  });

  // Task Actions
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      setErrorText('Objective title cannot be blank.');
      return;
    }
    setErrorText('');

    if (editingTaskId) {
      // Edit mode
      setTasks(prev => prev.map(t => t.id === editingTaskId ? {
        ...t,
        title: taskTitle.trim(),
        deadline: taskDeadline,
        importance: taskImportance,
        category: taskCategory,
        estimatedEffort: taskEffort || '1h',
        notes: taskNotes.trim()
      } : t));

      if (currentUser) {
        setDoc(doc(db, 'users', currentUser.uid, 'tasks', editingTaskId), {
          title: taskTitle.trim(),
          deadline: taskDeadline,
          importance: taskImportance,
          category: taskCategory,
          estimatedEffort: taskEffort || '1h',
          completed: tasks.find(t => t.id === editingTaskId)?.completed || false,
          notes: taskNotes.trim()
        }).catch(err => console.error(err));
      }

      setEditingTaskId(null);
    } else {
      // Create mode
      const newId = `task-${Date.now()}`;
      const newTask: Task = {
        id: newId,
        title: taskTitle.trim(),
        deadline: taskDeadline,
        importance: taskImportance,
        category: taskCategory,
        estimatedEffort: taskEffort || '1h',
        completed: false,
        notes: taskNotes.trim()
      };
      setTasks(prev => [...prev, newTask]);

      if (currentUser) {
        setDoc(doc(db, 'users', currentUser.uid, 'tasks', newId), {
          title: newTask.title,
          deadline: newTask.deadline,
          importance: newTask.importance,
          category: newTask.category,
          estimatedEffort: newTask.estimatedEffort,
          completed: newTask.completed,
          notes: newTask.notes || ''
        }).catch(err => console.error(err));
      }
    }
    
    // Clear inputs
    setTaskTitle('');
    setTaskNotes('');
  };

  const handleEditClick = (task: Task) => {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskDeadline(task.deadline);
    setTaskImportance(task.importance);
    setTaskCategory(task.category);
    setTaskEffort(task.estimatedEffort);
    setTaskNotes(task.notes || '');
    setActiveTab('tasks'); // jump to edit workspace
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskNotes('');
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (selectedTaskForTimer === id) {
      const remaining = tasks.filter(t => t.id !== id && !t.completed);
      if (remaining.length > 0) setSelectedTaskForTimer(remaining[0].id);
    }
    if (currentUser) {
      deleteDoc(doc(db, 'users', currentUser.uid, 'tasks', id)).catch(err => console.error(err));
    }
  };

  const handleToggleComplete = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const updated = { ...t, completed: !t.completed };
        if (currentUser) {
          setDoc(doc(db, 'users', currentUser.uid, 'tasks', id), {
            title: updated.title,
            deadline: updated.deadline,
            importance: updated.importance,
            category: updated.category,
            estimatedEffort: updated.estimatedEffort,
            completed: updated.completed,
            notes: updated.notes || ''
          }).catch(err => console.error(err));
        }
        return updated;
      }
      return t;
    }));
  };

  // Google Calendar Sync Helper Functions
  const parseTaskTiming = (task: Task) => {
    const end = new Date(task.deadline);
    let durationMins = 60; // default 1 hour
    if (task.estimatedEffort) {
      const matchH = task.estimatedEffort.match(/(\d+)\s*h/);
      const matchM = task.estimatedEffort.match(/(\d+)\s*m/);
      let total = 0;
      if (matchH) total += parseInt(matchH[1]) * 60;
      if (matchM) total += parseInt(matchM[1]);
      if (!matchH && !matchM) {
        const parsed = parseInt(task.estimatedEffort);
        if (!isNaN(parsed)) total += parsed * 60;
      }
      if (total > 0) durationMins = total;
    }
    const start = new Date(end.getTime() - durationMins * 60 * 1000);
    return { start, end };
  };

  const getOverlappingTasksForEvent = (event: any) => {
    if (!event.start?.dateTime || !event.end?.dateTime) return [];
    
    const eventStart = new Date(event.start.dateTime).getTime();
    const eventEnd = new Date(event.end.dateTime).getTime();
    
    return tasks.filter(task => {
      if (task.completed) return false;
      const { start, end } = parseTaskTiming(task);
      const taskStart = start.getTime();
      const taskEnd = end.getTime();
      
      // Check for overlap: taskStart < eventEnd && taskEnd > eventStart
      return taskStart < eventEnd && taskEnd > eventStart;
    });
  };

  const fetchCalendarEvents = async (tokenStr?: string) => {
    const token = tokenStr || googleAccessToken;
    if (!token) return;
    
    setCalendarSyncing(true);
    setCalendarSyncMessage(null);
    try {
      const startOfDay = new Date(systemTime);
      startOfDay.setHours(0, 0, 0, 0);
      const nextWeek = new Date(startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const timeMin = startOfDay.toISOString();
      const timeMax = nextWeek.toISOString();
      
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          setGoogleAccessToken(null);
          setCalendarEvents([]);
          throw new Error('Google Calendar session expired. Please reconnect.');
        }
        throw new Error('Failed to retrieve calendar events.');
      }
      
      const data = await res.json();
      const items = data.items || [];
      setCalendarEvents(items);
    } catch (err: any) {
      console.error('Fetch calendar error:', err);
      setCalendarSyncMessage(err.message || 'Failed to fetch calendar events.');
    } finally {
      setCalendarSyncing(false);
    }
  };

  const exportTaskToGoogleCalendar = async (task: Task, silent = false) => {
    const token = googleAccessToken;
    if (!token) {
      setCalendarSyncMessage('Please connect your Google Calendar first.');
      return false;
    }
    
    if (!silent) {
      const confirmed = window.confirm(`Export task "${task.title}" to Google Calendar?`);
      if (!confirmed) return false;
    }
    
    setCalendarSyncing(true);
    setCalendarSyncMessage(null);
    try {
      const { start, end } = parseTaskTiming(task);
      
      const eventBody = {
        summary: `OnTime: ${task.title}`,
        description: `Priority Level: ${task.importance}\nCategory: ${task.category}\nEstimated Effort: ${task.estimatedEffort}\nNotes: ${task.notes || 'None'}\n\nManaged by OnTime AI Deadline Advisor.`,
        start: {
          dateTime: start.toISOString()
        },
        end: {
          dateTime: end.toISOString()
        }
      };
      
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(eventBody)
      });
      
      if (!res.ok) {
        throw new Error('Failed to create calendar event.');
      }
      
      const eventData = await res.json();
      
      // Update local state and Firestore
      setTasks(prev => prev.map(t => {
        if (t.id === task.id) {
          const updated = { ...t, syncedToGCal: true, gcalEventId: eventData.id };
          if (currentUser) {
            setDoc(doc(db, 'users', currentUser.uid, 'tasks', t.id), {
              title: updated.title,
              deadline: updated.deadline,
              importance: updated.importance,
              category: updated.category,
              estimatedEffort: updated.estimatedEffort,
              completed: updated.completed,
              notes: updated.notes || '',
              syncedToGCal: true,
              gcalEventId: eventData.id
            }).catch(e => console.error(e));
          }
          return updated;
        }
        return t;
      }));
      
      if (!silent) {
        setCalendarSyncMessage(`Successfully exported "${task.title}" to Google Calendar!`);
        fetchCalendarEvents(token).catch(e => console.error(e));
      }
      return true;
    } catch (err: any) {
      console.error('Export event error:', err);
      if (!silent) {
        setCalendarSyncMessage(`Export failed: ${err.message || 'Please try again.'}`);
      }
      return false;
    } finally {
      setCalendarSyncing(false);
    }
  };

  const removeTaskFromGoogleCalendar = async (task: Task) => {
    const token = googleAccessToken;
    if (!token || !task.gcalEventId) return;
    
    const confirmed = window.confirm(`Remove task "${task.title}" from Google Calendar? This will delete the synced calendar event.`);
    if (!confirmed) return;
    
    setCalendarSyncing(true);
    setCalendarSyncMessage(null);
    try {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${task.gcalEventId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!res.ok && res.status !== 404) {
        throw new Error('Failed to delete calendar event.');
      }
      
      // Update local state and Firestore
      setTasks(prev => prev.map(t => {
        if (t.id === task.id) {
          const updated = { ...t, syncedToGCal: false, gcalEventId: undefined };
          if (currentUser) {
            setDoc(doc(db, 'users', currentUser.uid, 'tasks', t.id), {
              title: updated.title,
              deadline: updated.deadline,
              importance: updated.importance,
              category: updated.category,
              estimatedEffort: updated.estimatedEffort,
              completed: updated.completed,
              notes: updated.notes || ''
            }).catch(e => console.error(e));
          }
          return updated;
        }
        return t;
      }));
      
      setCalendarSyncMessage(`Successfully removed "${task.title}" from Google Calendar.`);
      fetchCalendarEvents(token).catch(e => console.error(e));
    } catch (err: any) {
      console.error('Remove calendar event error:', err);
      setCalendarSyncMessage(`Removal failed: ${err.message || 'Please try again.'}`);
    } finally {
      setCalendarSyncing(false);
    }
  };

  const syncAllTasksToGoogleCalendar = async () => {
    const token = googleAccessToken;
    if (!token) return;
    
    const unsynced = tasks.filter(t => !t.completed && !t.syncedToGCal);
    if (unsynced.length === 0) {
      setCalendarSyncMessage('All active tasks are already synced to Google Calendar!');
      return;
    }
    
    const confirmed = window.confirm(`Sync all ${unsynced.length} unsynced active tasks to Google Calendar?`);
    if (!confirmed) return;
    
    setCalendarSyncing(true);
    let successCount = 0;
    for (const task of unsynced) {
      const ok = await exportTaskToGoogleCalendar(task, true);
      if (ok) successCount++;
    }
    
    setCalendarSyncMessage(`Successfully synced ${successCount} tasks to Google Calendar!`);
    fetchCalendarEvents(token).catch(e => console.error(e));
  };

  const handleDisconnectCalendar = () => {
    setGoogleAccessToken(null);
    setCalendarEvents([]);
    localStorage.removeItem('ontime_gcal_connected');
    setCalendarSyncMessage('Disconnected from Google Calendar.');
  };

  const handleConnectCalendar = async () => {
    setCalendarSyncing(true);
    setCalendarSyncMessage(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
        localStorage.setItem('ontime_gcal_connected', 'true');
        setCalendarSyncMessage('Successfully connected to Google Calendar!');
        await fetchCalendarEvents(credential.accessToken);
      } else {
        throw new Error('No access token returned from Google Sign In');
      }
    } catch (err: any) {
      console.error('Google Calendar link error:', err);
      setCalendarSyncMessage(`Connection failed: ${err.message || 'Please try again.'}`);
    } finally {
      setCalendarSyncing(false);
    }
  };

  // Pomodoro Actions
  const triggerTick = () => {
    setTimeLeft(prev => {
      if (prev <= 1) {
        setTimerRunning(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        return 0;
      }
      return prev - 1;
    });
  };

  const startStopTimer = () => {
    if (timerRunning) {
      setTimerRunning(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    } else {
      setTimerRunning(true);
      timerIntervalRef.current = setInterval(triggerTick, 1000);
    }
  };

  const resetTimer = () => {
    setTimerRunning(false);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (timerMode === 'focus') setTimeLeft(25 * 60);
    else if (timerMode === 'short') setTimeLeft(5 * 60);
    else setTimeLeft(15 * 60);
  };

  const handleTimerModeChange = (mode: 'focus' | 'short' | 'long') => {
    setTimerMode(mode);
    setTimerRunning(false);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mode === 'focus') setTimeLeft(25 * 60);
    else if (mode === 'short') setTimeLeft(5 * 60);
    else setTimeLeft(15 * 60);
  };

  // call OnTime AI prioritize schedules
  const triggerAIAnalysis = async () => {
    setIsLoadingAnalysis(true);
    setActiveAnalysisMsg('Analyzing upcoming deadlines, assessing urgency tiers, and configuring optimal time blocks with Gemini...');
    try {
      const response = await fetch('/api/ontime/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks,
          userMessage: customRequestInput,
          currentLocalTime: systemTime.toISOString(),
          availableHours,
          preferredWorkHours
        })
      });
      const data = await response.json();
      if (data && data.priority_level) {
        setParsedAnalysis(data);
        setRawOutputText(JSON.stringify(data, null, 2));
        setSubtaskProgress({});
        setCustomRequestInput('');
      } else {
        setErrorText(data.error || 'Server rejected OnTime analysis query.');
      }
    } catch (err) {
      console.error('Failed to contact live engine, activated local modeling heuristics:', err);
      // Construct a high quality local fallback analysis gracefully
      const activePending = tasks.filter(t => !t.completed);
      const isUrgentImpActive = activePending.some(t => {
        const quadrant = checkTaskQuadrant(t);
        return quadrant === 'UI';
      });
      setParsedAnalysis({
        priority_level: isUrgentImpActive ? 'Critical' : 'High',
        priority_order: activePending.map(t => t.title),
        task_breakdowns: activePending.map(t => ({
          task: t.title,
          urgency: getDeadlineStatus(t.deadline).text,
          steps: [
            `Initiate first milestone steps for ${t.title}`,
            `Focus sprint iteration on objective outline (${t.estimatedEffort || '2h'})`,
            `Perform strict accuracy checklist reviews`
          ]
        })),
        schedule: [
          `09:30 - 11:30: Work on ${activePending[0]?.title || 'Tasks Registry'}`,
          '11:30 - 12:00: Mindful breathing split',
          `13:00 - 15:00: Deep focus on remainder requirements`
        ],
        risk_alerts: isUrgentImpActive ? ['Warning: Immediate deadline hazard looming in Quadrant I!'] : [],
        productivity_tip: 'Apply the Pomodoro work method in 50 minute blocks to maintain sustainable stress bounds.',
        next_action: `Target your focus core on ${activePending[0]?.title || 'pending tasks catalog'} immediately.`,
        emergency_mode: isUrgentImpActive
      });
    } finally {
      setIsLoadingAnalysis(false);
      setActiveAnalysisMsg('');
    }
  };

  // call Assistant Chat Q&A
  const handleSendChat = async (presetText?: string) => {
    const textToSend = presetText || chatInput;
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = { role: 'user', content: textToSend.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    if (!presetText) setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch('/api/ontime/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, userMsg].slice(-8), // send last history items
          tasks,
          currentLocalTime: systemTime.toISOString()
        })
      });
      const data = await response.json();
      if (data && data.reply) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble analyzing the schedule. Let's make sure our tasks registry contains appropriate deadline attributes." }]);
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Offline heuristic: Focus on Quadrant I actions. Start with tasks that have deadlines strictly under 24 hours." }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Clear chat conversation
  const handleClearChat = () => {
    const initialGreeting: ChatMessage[] = [
      { role: 'assistant', content: 'Hi there! I am OnTime AI, your personal productivity analyst. I can plan your day, run interactive time blocking, prioritize work, or suggest emergency turnaround steps. Try typing a command or clicking one of the instant presets below!' }
    ];
    setChatMessages(initialGreeting);
    localStorage.setItem('ontime_chat_messages', JSON.stringify(initialGreeting));
  };

  // Custom markdown renderer to elegantly format headers, lists, code, and bold/italic elements
  const renderMarkdown = (text: string) => {
    if (!text) return null;

    // First, parse code blocks (``` ... ```)
    const blocks: Array<{ type: 'code' | 'markdown'; content: string; language?: string }> = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIdx = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        blocks.push({
          type: 'markdown',
          content: text.substring(lastIdx, match.index)
        });
      }
      blocks.push({
        type: 'code',
        language: match[1],
        content: match[2]
      });
      lastIdx = codeBlockRegex.lastIndex;
    }
    if (lastIdx < text.length) {
      blocks.push({
        type: 'markdown',
        content: text.substring(lastIdx)
      });
    }

    // Helper to format inline tags: bold, italic, inline code
    const formatInline = (line: string, lineKey: string | number) => {
      let elements: React.ReactNode[] = [line];

      // 1. Parse inline code: `code`
      const codeRegex = /`([^`]+)`/g;
      let newElements: React.ReactNode[] = [];
      for (const el of elements) {
        if (typeof el === 'string') {
          let lastIndex = 0;
          let codeMatch;
          while ((codeMatch = codeRegex.exec(el)) !== null) {
            if (codeMatch.index > lastIndex) {
              newElements.push(el.substring(lastIndex, codeMatch.index));
            }
            newElements.push(
              <code key={`inline-code-${lineKey}-${codeMatch.index}`} className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 font-mono text-[10.5px] rounded text-blue-600 dark:text-blue-300 border border-slate-300 dark:border-slate-600">
                {codeMatch[1]}
              </code>
            );
            lastIndex = codeRegex.lastIndex;
          }
          if (lastIndex < el.length) {
            newElements.push(el.substring(lastIndex));
          }
        } else {
          newElements.push(el);
        }
      }
      elements = newElements;

      // 2. Parse bold: **text**
      const boldRegex = /\*\*([^*]+)\*\*/g;
      newElements = [];
      for (const el of elements) {
        if (typeof el === 'string') {
          let lastIndex = 0;
          let boldMatch;
          while ((boldMatch = boldRegex.exec(el)) !== null) {
            if (boldMatch.index > lastIndex) {
              newElements.push(el.substring(lastIndex, boldMatch.index));
            }
            newElements.push(
              <strong key={`bold-${lineKey}-${boldMatch.index}`} className="font-extrabold text-slate-900 dark:text-white">
                {boldMatch[1]}
              </strong>
            );
            lastIndex = boldRegex.lastIndex;
          }
          if (lastIndex < el.length) {
            newElements.push(el.substring(lastIndex));
          }
        } else {
          newElements.push(el);
        }
      }
      elements = newElements;

      // 3. Parse italic: *text*
      const italicRegex = /\*([^*]+)\*/g;
      newElements = [];
      for (const el of elements) {
        if (typeof el === 'string') {
          let lastIndex = 0;
          let italicMatch;
          while ((italicMatch = italicRegex.exec(el)) !== null) {
            if (italicMatch.index > lastIndex) {
              newElements.push(el.substring(lastIndex, italicMatch.index));
            }
            newElements.push(
              <em key={`italic-${lineKey}-${italicMatch.index}`} className="italic text-slate-800 dark:text-slate-200">
                {italicMatch[1]}
              </em>
            );
            lastIndex = italicRegex.lastIndex;
          }
          if (lastIndex < el.length) {
            newElements.push(el.substring(lastIndex));
          }
        } else {
          newElements.push(el);
        }
      }
      elements = newElements;

      return elements;
    };

    return (
      <div className="space-y-2">
        {blocks.map((block, bIdx) => {
          if (block.type === 'code') {
            return (
              <pre key={`code-block-${bIdx}`} className="p-3 bg-slate-950 text-slate-100 font-mono text-[11px] rounded-xl overflow-x-auto border border-slate-800 my-2 leading-relaxed">
                <code>{block.content}</code>
              </pre>
            );
          }

          // Parse markdown lines
          const lines = block.content.split('\n');
          return lines.map((line, lIdx) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={`empty-${bIdx}-${lIdx}`} className="h-1" />;

            // 1. Headers: #, ##, ###, ####, #####, ######
            const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
            if (headerMatch) {
              const level = headerMatch[1].length;
              const title = headerMatch[2];
              const formattedTitle = formatInline(title, `header-${bIdx}-${lIdx}`);

              if (level === 1) {
                return (
                  <h1 key={`h1-${bIdx}-${lIdx}`} className="text-sm font-black text-slate-900 dark:text-white mt-4 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">
                    {formattedTitle}
                  </h1>
                );
              } else if (level === 2) {
                return (
                  <h2 key={`h2-${bIdx}-${lIdx}`} className="text-xs font-extrabold text-slate-900 dark:text-white mt-3 mb-1.5">
                    {formattedTitle}
                  </h2>
                );
              } else {
                return (
                  <h3 key={`h3-${bIdx}-${lIdx}`} className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mt-2.5 mb-1 uppercase tracking-wide">
                    {formattedTitle}
                  </h3>
                );
              }
            }

            // 2. Unordered lists: - or *
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
              const listContent = trimmed.substring(2);
              return (
                <li key={`ul-${bIdx}-${lIdx}`} className="ml-4 list-disc pl-1 text-slate-800 dark:text-slate-100 leading-relaxed text-xs">
                  {formatInline(listContent, `ul-content-${bIdx}-${lIdx}`)}
                </li>
              );
            }

            // 3. Ordered lists: 1. or 2.
            const numListMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
            if (numListMatch) {
              const num = numListMatch[1];
              const listContent = numListMatch[2];
              return (
                <li key={`ol-${bIdx}-${lIdx}`} className="ml-4 list-decimal pl-1 text-slate-800 dark:text-slate-100 leading-relaxed text-xs">
                  {formatInline(listContent, `ol-content-${bIdx}-${lIdx}`)}
                </li>
              );
            }

            // 4. Regular paragraph
            return (
              <p key={`p-${bIdx}-${lIdx}`} className="text-slate-800 dark:text-slate-100 leading-relaxed text-xs">
                {formatInline(line, `p-content-${bIdx}-${lIdx}`)}
              </p>
            );
          });
        })}
      </div>
    );
  };

  // Copy raw output
  const handleCopyCode = () => {
    navigator.clipboard.writeText(rawOutputText || JSON.stringify(parsedAnalysis, null, 2));
    const btn = document.getElementById('copy-indicator');
    if (btn) {
      btn.innerHTML = 'Copied!';
      setTimeout(() => {
        btn.innerHTML = 'Copy Plan';
      }, 2000);
    }
  };

  // Quick stats
  const totalCompleted = tasks.filter(t => t.completed).length;
  const totalPending = tasks.filter(t => !t.completed).length;
  const deadlinesThisWeek = tasks.filter(t => {
    if (!t.deadline || t.completed) return false;
    const diffMs = new Date(t.deadline).getTime() - systemTime.getTime();
    return diffMs > 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError('Email and Password are required.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      if (authIsSignUp) {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
      setShowAuthModal(false);
      setAuthEmail('');
      setAuthPassword('');
    } catch (err: any) {
      console.error(err);
      let msg = err.message || 'An error occurred during authentication.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'This email is already in use.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Invalid email format.';
      }
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
        localStorage.setItem('ontime_gcal_connected', 'true');
        // Fetch events immediately in the background
        fetchCalendarEvents(credential.accessToken).catch(err => console.error(err));
      }
      setShowAuthModal(false);
    } catch (err: any) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setAuthError(err.message || 'Error signing in with Google.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-900 text-slate-100' : 'bg-[#F8FAFC] text-slate-800'} font-sans antialiased transition-colors duration-200`}>
      <header className="border-b border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
              <Shield className="h-5.5 w-5.5" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight font-display text-slate-900 dark:text-white">OnTime AI</span>
              <span className="ml-2 text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold">Pro Advisor</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Clock Sync */}
            <div className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono">
              <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {systemTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            {/* Firebase Auth Controls */}
            {currentUser ? (
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 px-3 py-1.5 rounded-xl text-xs font-semibold">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="hidden lg:inline text-slate-600 dark:text-slate-300">
                  {currentUser.email}
                </span>
                <button 
                  onClick={() => signOut(auth)}
                  className="text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-bold ml-1 transition-colors cursor-pointer"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button 
                onClick={() => {
                  setAuthError('');
                  setShowAuthModal(true);
                }}
                                 className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm cursor-pointer"
                 aria-label="Sign In"
              >
                <User className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {/* Dark Mode Toggle */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Toggle Theme"
              aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive Grid Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Critical Emergency Banner if Countdown Active */}
        {emergencyCountdown && (
          <div className="mb-6 bg-rose-500 text-white border border-rose-600 rounded-2xl p-4 shadow-md flex flex-col md:flex-row justify-between items-center gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest block opacity-75">EMERGENCY MODE ENGAGED</span>
                <span className="text-sm font-extrabold font-display">Impending Target: "{emergencyCountdown.title}" deadline threat!</span>
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono text-xl font-bold bg-white/20 px-4 py-2 rounded-xl">
              <span>{emergencyCountdown.hours.toString().padStart(2, '0')}h</span>
              <span>:</span>
              <span>{emergencyCountdown.minutes.toString().padStart(2, '0')}m</span>
              <span>:</span>
              <span>{emergencyCountdown.seconds.toString().padStart(2, '0')}s</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: SIDEBAR TABS */}
          <aside className="lg:col-span-3 space-y-3">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-4 shadow-xs space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 px-3 block mb-3">Navigation Modules</span>
              
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border-l-2 ${
                  activeTab === 'dashboard' 
                    ? 'bg-blue-50/70 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-600 font-extrabold shadow-xs pl-2.5' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Grid className="h-4.5 w-4.5" />
                  <span>Task Dashboard</span>
                </div>
                <ChevronRight className={`h-3 w-3 ${activeTab === 'dashboard' ? 'opacity-100 text-blue-600 dark:text-blue-400' : 'opacity-40'}`} />
              </button>

              <button 
                onClick={() => setActiveTab('tasks')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border-l-2 ${
                  activeTab === 'tasks' 
                    ? 'bg-blue-50/70 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-600 font-extrabold shadow-xs pl-2.5' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ListTodo className="h-4.5 w-4.5" />
                  <span>Tasks Catalog</span>
                </div>
                {totalPending > 0 && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === 'tasks' ? 'bg-blue-600 text-white' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300'}`}>{totalPending}</span>
                )}
              </button>

              <button 
                onClick={() => setActiveTab('chat')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border-l-2 ${
                  activeTab === 'chat' 
                    ? 'bg-blue-50/70 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-600 font-extrabold shadow-xs pl-2.5' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="h-4.5 w-4.5" />
                  <span>AI Assistant Chat</span>
                </div>
                <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
              </button>

              <button 
                onClick={() => setActiveTab('emergency')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border-l-2 relative overflow-hidden ${
                  activeTab === 'emergency' 
                    ? 'bg-rose-50/70 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-600 font-extrabold shadow-xs pl-2.5' 
                    : emergencyCountdown 
                      ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 pl-2.5' 
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Zap className="h-4.5 w-4.5" />
                  <span>Emergency Mode</span>
                </div>
                {emergencyCountdown && (
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping absolute right-3"></span>
                )}
              </button>

              <button 
                onClick={() => setActiveTab('analytics')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border-l-2 ${
                  activeTab === 'analytics' 
                    ? 'bg-blue-50/70 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-600 font-extrabold shadow-xs pl-2.5' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Activity className="h-4.5 w-4.5" />
                  <span>Coach Analytics</span>
                </div>
                <ChevronRight className={`h-3 w-3 ${activeTab === 'analytics' ? 'opacity-100 text-blue-600 dark:text-blue-400' : 'opacity-40'}`} />
              </button>

              <button 
                onClick={() => setActiveTab('calendar')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border-l-2 ${
                  activeTab === 'calendar' 
                    ? 'bg-blue-50/70 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-600 font-extrabold shadow-xs pl-2.5' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-4.5 w-4.5" />
                  <span>Google Calendar</span>
                </div>
                {googleAccessToken ? (
                  <span className="h-2 w-2 rounded-full bg-green-500" title="Connected"></span>
                ) : (
                  <ChevronRight className={`h-3 w-3 ${activeTab === 'calendar' ? 'opacity-100 text-blue-600 dark:text-blue-400' : 'opacity-40'}`} />
                )}
              </button>

              <button 
                onClick={() => setActiveTab('soundscape')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border-l-2 ${
                  activeTab === 'soundscape' 
                    ? 'bg-blue-50/70 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-600 font-extrabold shadow-xs pl-2.5' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Headphones className="h-4.5 w-4.5" />
                  <span>Ambient Sounds</span>
                </div>
                <ChevronRight className={`h-3 w-3 ${activeTab === 'soundscape' ? 'opacity-100 text-blue-600 dark:text-blue-400' : 'opacity-40'}`} />
              </button>
            </div>

            {/* PRODUCTIVITY METER COMPONENT */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs text-center space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">OnTime Scoring</span>
                <span className="text-blue-600 dark:text-blue-400 font-extrabold font-mono">{productivityScore}/100</span>
              </div>
              
              {/* Radial Meter layout */}
              <div className="flex justify-center relative items-center py-2">
                <svg className="w-28 h-28 transform -rotate-90">
                  <circle cx="56" cy="56" r="48" stroke="#E2E8F0" strokeWidth="6" fill="transparent" className="dark:stroke-slate-800" />
                  <circle 
                    cx="56" 
                    cy="56" 
                    r="48" 
                    stroke={productivityScore > 75 ? "#2563EB" : productivityScore > 40 ? "#F59E0B" : "#EF4444"} 
                    strokeWidth="6" 
                    fill="transparent" 
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={(1 - productivityScore / 100) * (2 * Math.PI * 48)}
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute text-center flex flex-col">
                  <span className="text-2xl font-black tracking-tight">{productivityScore}</span>
                  <span className="text-[8px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-extrabold">Active Rating</span>
                </div>
              </div>

              <div className="text-xs">
                <p className="font-medium text-slate-600 dark:text-slate-300">
                  {productivityScore >= 80 ? '👑 Elite consistency rate!' : productivityScore >= 50 ? '⚡ Good, keep managing priorities' : '⚠️ Extreme threat of missing deadlines'}
                </p>
              </div>
            </div>
          </aside>

          {/* MAIN CENTER CONTENT WORKSPACE */}
          <main className="lg:col-span-6 space-y-6">

            {/* TAB 1: DASHBOARD VIEW */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                
                {/* Dynamic OnTime Header Greeting Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-blue-100/30 dark:bg-blue-900/10 rounded-full blur-2xl pointer-events-none"></div>
                  <div>
                    <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">Active Plan Status</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Here is a synthesized summary of your tactical priorities, timeblocks, and critical goals.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('tasks')}
                    className="self-start text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all font-bold flex items-center gap-1 cursor-pointer"
                  >
                    Manage Catalog <ChevronRight className="h-3 w-3" />
                  </button>
                </div>

                {/* Grid stats highlights */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-bold">Uncompleted</span>
                    <span className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{totalPending}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-bold">Done Tasks</span>
                    <span className="text-2xl font-black text-green-600 dark:text-green-400 tracking-tight">{totalCompleted}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-bold">This Week</span>
                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">{deadlinesThisWeek}</span>
                  </div>
                </div>

                {/* Priority order timeline */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <TrendingUp className="h-4.5 w-4.5 text-blue-500" /> Optimal Prioritization Flow
                  </h3>
                  <div className="space-y-2">
                    {parsedAnalysis.priority_order && parsedAnalysis.priority_order.length > 0 ? (
                      parsedAnalysis.priority_order.map((item, idx) => {
                        let title = '';
                        let priority = '';
                        let reason = '';
                        
                        if (typeof item === 'object' && item !== null) {
                          title = (item as any).task || (item as any).title || '';
                          priority = (item as any).priority || '';
                          reason = (item as any).reason || '';
                        } else {
                          title = String(item);
                        }

                        return (
                          <div key={idx} className="flex flex-col gap-1 text-xs bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center justify-center font-extrabold font-mono text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 h-5 w-5 rounded-full shrink-0">{idx + 1}</span>
                              <span className="font-extrabold text-slate-800 dark:text-slate-100">{title}</span>
                              {priority && (
                                <span className="text-[8px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 ml-auto shrink-0">
                                  {priority}
                                </span>
                              )}
                            </div>
                            {reason && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-8 leading-relaxed mt-0.5">
                                {reason}
                              </p>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 italic">No tasks prioritization generated. Update your catalog elements!</p>
                    )}
                  </div>
                </div>

                {/* AI Interactive Task Breakdown Checklist */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <ListTodo className="h-4.5 w-4.5 text-blue-500" /> Interactive Subtask Checklists
                    </h3>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">Powered by AI Analysis</span>
                  </div>

                  <div className="space-y-4">
                    {parsedAnalysis.task_breakdowns && parsedAnalysis.task_breakdowns.length > 0 ? (
                      parsedAnalysis.task_breakdowns.map((breakdown, bIdx) => {
                        // Find matching task from state to identify if completed
                        const matchingTask = tasks.find(t => t.title.toLowerCase() === breakdown.task.toLowerCase());
                        const isMainTaskCompleted = matchingTask ? matchingTask.completed : false;
                        const taskIdKey = matchingTask ? matchingTask.id : `breakdown-${bIdx}`;
                        
                        // Calculate completion progress
                        const steps = breakdown.steps || [];
                        const completedStepsCount = steps.reduce((acc, step, sIdx) => {
                          const isDone = subtaskProgress[`${taskIdKey}-${sIdx}`] || false;
                          return acc + (isDone ? 1 : 0);
                        }, 0);
                        const totalSteps = steps.length;
                        const percentComplete = totalSteps > 0 ? Math.round((completedStepsCount / totalSteps) * 100) : 0;

                        return (
                          <div key={bIdx} className={`p-4 rounded-xl border transition-all ${isMainTaskCompleted ? 'bg-slate-50/50 dark:bg-slate-900/30 opacity-60 border-slate-100 dark:border-slate-850' : 'bg-slate-50/30 dark:bg-slate-800/20 border-slate-200/60 dark:border-slate-800/60 hover:shadow-xs'}`}>
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div>
                                <h4 className={`text-xs font-bold ${isMainTaskCompleted ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                  {breakdown.task}
                                </h4>
                                {breakdown.urgency && (
                                  <span className="text-[9px] uppercase font-black text-rose-500 dark:text-rose-400 block mt-0.5 tracking-wider">
                                    {breakdown.urgency}
                                  </span>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                  {completedStepsCount}/{totalSteps} Steps
                                </span>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-200/60 dark:bg-slate-800 rounded-full h-1.5 mb-3 overflow-hidden">
                              <div 
                                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                                style={{ width: `${percentComplete}%` }}
                              />
                            </div>

                            {/* Checklist steps */}
                            <div className="space-y-2">
                              {steps.map((step, sIdx) => {
                                const stepKey = `${taskIdKey}-${sIdx}`;
                                const isStepChecked = subtaskProgress[stepKey] || false;

                                return (
                                  <div 
                                    key={sIdx} 
                                    onClick={() => {
                                      if (isMainTaskCompleted) return;
                                      setSubtaskProgress(prev => ({
                                        ...prev,
                                        [stepKey]: !prev[stepKey]
                                      }));
                                    }}
                                    className={`flex items-start gap-2.5 p-2 rounded-lg transition-all text-[11px] ${isMainTaskCompleted ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-white dark:hover:bg-slate-900/40'} ${isStepChecked ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300 font-medium'}`}
                                  >
                                    <div className="mt-0.5 shrink-0">
                                      <div className={`h-4 w-4 rounded border transition-all flex items-center justify-center ${isStepChecked ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950'}`}>
                                        {isStepChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                                      </div>
                                    </div>
                                    <span className={`${isStepChecked ? 'line-through' : ''}`}>
                                      {step}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Complete main task helper if all steps checked and not already complete */}
                            {!isMainTaskCompleted && matchingTask && percentComplete === 100 && totalSteps > 0 && (
                              <button
                                onClick={() => handleToggleComplete(matchingTask.id)}
                                className="mt-3 w-full py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold rounded-lg text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer border border-emerald-200/50 dark:border-emerald-900/50"
                              >
                                <CheckCircle2 className="h-3 w-3" /> Complete Main Task: "{matchingTask.title}"
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 italic">No task breakdowns generated yet. Generate an AI analysis of your active catalog tasks to populate interactive breakdowns!</p>
                    )}
                  </div>
                </div>

                {/* Scheduled timeblocking */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Calendar className="h-4.5 w-4.5 text-blue-500" /> Real Time Blocking Schedule
                    </h3>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{preferredWorkHours} preferred hours</span>
                  </div>
                  
                  <div className="relative border-l border-slate-200/60 dark:border-slate-800/60 pl-4 ml-1.5 space-y-2">
                    {parsedAnalysis.schedule && parsedAnalysis.schedule.map((item, idx) => {
                      let timeslot = 'Slot';
                      let message = '';

                      if (typeof item === 'object' && item !== null) {
                        timeslot = (item as any).time || '';
                        message = (item as any).activity || '';
                      } else {
                        const strItem = String(item);
                        const colonIndex = strItem.indexOf(':');
                        timeslot = colonIndex !== -1 ? strItem.substring(0, colonIndex).trim() : 'Slot';
                        message = colonIndex !== -1 ? strItem.substring(colonIndex + 1).trim() : strItem;
                      }

                      return (
                        <div key={idx} className="relative text-xs group p-2.5 -mx-2.5 rounded-xl hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-all">
                          {/* Indicator dot */}
                          <div className="absolute -left-[20.5px] top-[18px] h-2 w-2 rounded-full bg-blue-500 ring-4 ring-white dark:ring-slate-900 transition-all group-hover:scale-125 group-hover:bg-blue-600"></div>
                          <span className="font-bold text-slate-500 dark:text-slate-400 block tracking-wide text-[10px]">{timeslot}</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5 block leading-relaxed">{message}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: TASKS ACTION & CATALOG WORKSPACE */}
            {activeTab === 'tasks' && (
              <div className="space-y-6">
                
                {/* Form to Create/Edit Task */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm" id="catalog-card">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-sm font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <ListTodo className="h-5 w-5 text-blue-600" /> {editingTaskId ? 'Edit Objective Details' : 'Catalog New Task'}
                    </h2>
                    {editingTaskId && (
                      <button 
                        onClick={handleCancelEdit}
                        className="text-xs text-rose-600 hover:underline hover:text-rose-700 transition-colors"
                      >
                        Cancel Editing
                      </button>
                    )}
                  </div>

                  {/* Quick-Add Templates */}
                  {!editingTaskId && (
                    <div className="mb-4 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2 flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5 text-blue-500" /> Preconfigured Templates
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {[
                          {
                            label: '🖥️ Client Demo',
                            title: 'Prepare Slide Deck & Demo for Client',
                            importance: 'High' as const,
                            category: 'Work' as const,
                            effort: '2h',
                            notes: 'Build mockups, draft outline slides, rehearse demo flows.'
                          },
                          {
                            label: '⚡ Code Refactor',
                            title: 'Refactor Duplicate Code Modules',
                            importance: 'Medium' as const,
                            category: 'Work' as const,
                            effort: '3h',
                            notes: 'Consolidate helper functions, optimize query layers, write unit tests.'
                          },
                          {
                            label: '🎓 Exam Prep',
                            title: 'Study for Advanced Subject Exam',
                            importance: 'Critical' as const,
                            category: 'Study' as const,
                            effort: '4h',
                            notes: 'Review textbook materials, solve previous practice papers, write quick summary cards.'
                          },
                          {
                            label: '💪 Fitness Session',
                            title: 'High-Intensity Strength & Cardio Workout',
                            importance: 'Low' as const,
                            category: 'Health' as const,
                            effort: '1h',
                            notes: 'Warm up 10m, follow dynamic stretching, complete compound lift sets, cooldown.'
                          }
                        ].map((tpl, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setTaskTitle(tpl.title);
                              setTaskImportance(tpl.importance);
                              setTaskCategory(tpl.category);
                              setTaskEffort(tpl.effort);
                              setTaskNotes(tpl.notes);
                              
                              // Set deadline to 24 hours from now
                              const tomorrow = new Date();
                              tomorrow.setHours(tomorrow.getHours() + 24);
                              const formatted = tomorrow.toISOString().slice(0, 16);
                              setTaskDeadline(formatted);
                            }}
                            className="text-[10px] font-bold bg-white hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 py-1.5 px-2.5 rounded-lg transition-all cursor-pointer shadow-2xs hover:border-blue-300 dark:hover:border-blue-900"
                            title={`Instantly fill out form for ${tpl.title}`}
                          >
                            {tpl.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <form onSubmit={handleAddTask} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Name */}
                      <div className="md:col-span-2">
                        <label htmlFor="task-title-input" className="block font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Task Objective Title</label>
                        <input 
                          id="task-title-input"
                          type="text" 
                          placeholder="e.g. Cybersecurity Assignment or Complete Security Audit"
                          value={taskTitle}
                          onChange={(e) => setTaskTitle(e.target.value)}
                          className="w-full text-xs font-semibold border-slate-200 dark:border-slate-800 border rounded-xl p-3 bg-slate-50/50 hover:bg-white dark:bg-slate-800 dark:hover:bg-slate-700 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus-visible:outline-none outline-none transition-all placeholder:text-slate-400 text-slate-800 dark:text-white"
                        />
                      </div>

                      {/* Deadline */}
                      <div>
                        <label htmlFor="task-deadline-input" className="block font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Deadline Threshold Offset</label>
                        <input 
                          id="task-deadline-input"
                          type="datetime-local" 
                          value={taskDeadline}
                          onChange={(e) => setTaskDeadline(e.target.value)}
                          className="w-full text-xs font-semibold border-slate-200 dark:border-slate-800 border rounded-xl p-3 bg-slate-50/50 focus:bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus-visible:outline-none outline-none focus:border-blue-500 text-slate-800 dark:text-white"
                        />
                      </div>

                      {/* Estimated Effort */}
                      <div>
                        <label htmlFor="task-effort-input" className="block font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Estimated Duration Workload</label>
                        <input 
                          id="task-effort-input"
                          type="text" 
                          placeholder="e.g. 2h, 45m, 1h"
                          value={taskEffort}
                          onChange={(e) => setTaskEffort(e.target.value)}
                          className="w-full text-xs font-semibold border-slate-200 dark:border-slate-800 border rounded-xl p-3 bg-slate-50/50 focus:bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus-visible:outline-none outline-none focus:border-blue-500 text-slate-800 dark:text-white"
                        />
                      </div>

                      {/* Importance Level */}
                      <div>
                        <label htmlFor="task-importance-select" className="block font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Importance / Urgency Tier</label>
                        <select 
                          id="task-importance-select"
                          value={taskImportance}
                          onChange={(e) => setTaskImportance(e.target.value as any)}
                          className="w-full text-xs font-semibold border-slate-200 dark:border-slate-800 border rounded-xl p-3 bg-slate-50/50 focus:bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus-visible:outline-none outline-none focus:border-blue-500 text-slate-800 dark:text-white"
                        >
                          <option className="bg-white text-slate-800 dark:bg-slate-800 dark:text-white" value="Critical">🔴 Critical (Action Required Now)</option>
                          <option className="bg-white text-slate-800 dark:bg-slate-800 dark:text-white" value="High">🟠 High (Significant Delay Cost)</option>
                          <option className="bg-white text-slate-800 dark:bg-slate-800 dark:text-white" value="Medium">🟡 Medium (Substantial Priority)</option>
                          <option className="bg-white text-slate-800 dark:bg-slate-800 dark:text-white" value="Low">🔵 Low (Deferrable / Flexible)</option>
                        </select>
                      </div>

                      {/* Category */}
                      <div>
                        <label htmlFor="task-category-select" className="block font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Discipline / Class Mode</label>
                        <select 
                          id="task-category-select"
                          value={taskCategory}
                          onChange={(e) => setTaskCategory(e.target.value as any)}
                          className="w-full text-xs font-semibold border-slate-200 dark:border-slate-800 border rounded-xl p-3 bg-slate-50/50 focus:bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus-visible:outline-none outline-none focus:border-blue-500 text-slate-800 dark:text-white"
                        >
                          <option className="bg-white text-slate-800 dark:bg-slate-800 dark:text-white" value="Work">👜 Professional / Work</option>
                          <option className="bg-white text-slate-800 dark:bg-slate-800 dark:text-white" value="Study">📚 Study / Academic</option>
                          <option className="bg-white text-slate-800 dark:bg-slate-800 dark:text-white" value="Personal">🏠 Personal Logistics</option>
                          <option className="bg-white text-slate-800 dark:bg-slate-800 dark:text-white" value="Health">💪 Rest, Exercise & Health</option>
                        </select>
                      </div>

                      {/* Notes */}
                      <div className="md:col-span-2">
                        <label htmlFor="task-notes-textarea" className="block font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Contextual Outline Proposal</label>
                        <textarea 
                          id="task-notes-textarea"
                          placeholder="Provide details about specs, deliverables or context..."
                          value={taskNotes}
                          onChange={(e) => setTaskNotes(e.target.value)}
                          rows={2}
                          className="w-full text-xs font-semibold border-slate-200 dark:border-slate-800 border rounded-xl p-3 bg-slate-50/50 focus:bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus-visible:outline-none outline-none focus:border-blue-500 placeholder:text-slate-400 text-slate-800 dark:text-white"
                        />
                      </div>
                    </div>

                    {errorText && (
                      <div className="text-red-700 bg-red-50 border-red-200 border p-2.5 rounded-lg font-medium flex items-center gap-1.5">
                        <Info className="h-4 w-4" /> {errorText}
                      </div>
                    )}

                    <button 
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      {editingTaskId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      {editingTaskId ? 'Commit Changes' : 'Queue Target Objective'}
                    </button>
                  </form>
                </div>

                {/* Eisenhower Matrix selection */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5">
                      <Grid className="h-5 w-5 text-blue-600" /> Eisenhower Matrix Triage
                    </h3>
                    <button 
                      onClick={() => setMatrixFilter('All')}
                      className={`text-[10px] text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 ${matrixFilter === 'All' ? 'font-bold underline text-blue-600 dark:text-blue-400' : ''}`}
                    >
                      Clear Quadrant Filter
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3.5">
                    <button 
                      onClick={() => setMatrixFilter(matrixFilter === 'UI' ? 'All' : 'UI')}
                      aria-label="Filter by Quadrant 1: Urgent and Important"
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between h-20 transition-all ${
                        matrixFilter === 'UI' 
                          ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900 ring-2 ring-rose-200' 
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 hover:bg-rose-50/20'
                      }`}
                    >
                      <div>
                        <span className="text-[8px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 block">Quadrant I</span>
                        <span className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 block">Urgent & Important</span>
                      </div>
                      <div className="flex justify-between items-end w-full">
                        <span className="text-[8px] font-black bg-rose-100 dark:bg-rose-900/40 text-rose-800 px-1.5 py-0.5 rounded uppercase font-mono">Do First</span>
                        <span className="font-black text-xs font-mono">{counts.UI}</span>
                      </div>
                    </button>

                    <button 
                      onClick={() => setMatrixFilter(matrixFilter === 'INU' ? 'All' : 'INU')}
                      aria-label="Filter by Quadrant 2: Important, Not Urgent"
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between h-20 transition-all ${
                        matrixFilter === 'INU' 
                          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900 ring-2 ring-amber-200' 
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 hover:bg-amber-50/20'
                      }`}
                    >
                      <div>
                        <span className="text-[8px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">Quadrant II</span>
                        <span className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 block">Important, Not Urgent</span>
                      </div>
                      <div className="flex justify-between items-end w-full">
                        <span className="text-[8px] font-black bg-amber-100 dark:bg-amber-900/40 text-amber-800 px-1.5 py-0.5 rounded uppercase font-mono font-bold">Plan Loop</span>
                        <span className="font-black text-xs font-mono">{counts.INU}</span>
                      </div>
                    </button>

                    <button 
                      onClick={() => setMatrixFilter(matrixFilter === 'UNI' ? 'All' : 'UNI')}
                      aria-label="Filter by Quadrant 3: Urgent, Not Important"
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between h-20 transition-all ${
                        matrixFilter === 'UNI' 
                          ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-900 ring-2 ring-blue-200' 
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 hover:bg-blue-50/20'
                      }`}
                    >
                      <div>
                        <span className="text-[8px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 block">Quadrant III</span>
                        <span className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 block">Urgent, Not Important</span>
                      </div>
                      <div className="flex justify-between items-end w-full">
                        <span className="text-[8px] font-black bg-blue-100 dark:bg-blue-900/40 text-blue-800 px-1.5 py-0.5 rounded uppercase font-mono">Delegate</span>
                        <span className="font-black text-xs font-mono">{counts.UNI}</span>
                      </div>
                    </button>

                    <button 
                      onClick={() => setMatrixFilter(matrixFilter === 'NEITHER' ? 'All' : 'NEITHER')}
                      aria-label="Filter by Quadrant 4: Not Urgent and Not Important"
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between h-20 transition-all ${
                        matrixFilter === 'NEITHER' 
                          ? 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 ring-2 ring-slate-100' 
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 hover:bg-slate-100/50'
                      }`}
                    >
                      <div>
                        <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Quadrant IV</span>
                        <span className="font-extrabold text-[11px] text-slate-800 dark:text-slate-200 block">Lazy / Eliminate</span>
                      </div>
                      <div className="flex justify-between items-end w-full">
                        <span className="text-[8px] font-black bg-slate-200 dark:bg-slate-800/90 text-slate-700 px-1.5 py-0.5 rounded uppercase">Eliminate</span>
                        <span className="font-black text-xs font-mono">{counts.NEITHER}</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Tasks List */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
                  {/* Search and Filters heading */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
                    <input 
                      type="text" 
                      placeholder="Search tasks spec logs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 outline-none focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    />

                    <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 items-center">
                      {['All', 'Work', 'Study', 'Personal', 'Health'].map((cat: any) => (
                        <button 
                          key={cat}
                          onClick={() => setCategoryFilter(cat)}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${categoryFilter === cat ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'hover:text-slate-800'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTasks.length === 0 ? (
                      <div className="p-12 text-center text-xs">
                        <CheckCircle2 className="h-12 w-12 text-slate-400 dark:text-slate-500 mx-auto stroke-[1.2]" />
                        <p className="font-bold text-slate-700 dark:text-slate-300 mt-4 text-sm">Pragmatic clarity achieved</p>
                        <p className="text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">No outstanding tasks matches this filter setup. Release search queries or add custom deadlines!</p>
                      </div>
                    ) : (
                      filteredTasks.map(task => {
                        const statusObj = getDeadlineStatus(task.deadline);
                        const deadlineDate = new Date(task.deadline);
                        const displayTime = deadlineDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <div 
                            key={task.id} 
                            className={`p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-all flex items-start gap-3.5 relative group border-l-2 border-transparent hover:border-blue-600 ${task.completed ? 'opacity-65 bg-slate-50/30' : ''}`}
                          >
                            <button 
                              onClick={() => handleToggleComplete(task.id)}
                              className="mt-1 shrink-0 p-0.5 hover:text-blue-600 transition-colors cursor-pointer"
                              title="Toggle completion"
                              aria-label={task.completed ? `Mark "${task.title}" as incomplete` : `Mark "${task.title}" as completed`}
                            >
                              {task.completed ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 fill-emerald-100 dark:fill-emerald-950/20" />
                              ) : (
                                <div className="h-5 w-5 rounded-md border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"></div>
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-bold ${task.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                  {task.title}
                                </span>
                                <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-bold uppercase">{task.category}</span>
                                {task.importance === 'Critical' && <span className="text-[9px] bg-rose-150/80 dark:bg-rose-950/30 text-rose-800 dark:text-rose-400 px-1.5 py-0.5 rounded font-bold">Critical</span>}
                                {task.importance === 'High' && <span className="text-[9px] bg-amber-150/80 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold">High</span>}
                              </div>

                              {task.notes && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{task.notes}</p>
                              )}

                              <div className="flex items-center gap-3 mt-2.5 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-slate-400" /> Duration: {task.estimatedEffort}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-slate-400" /> {displayTime}</span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2.5 justify-between select-none shrink-0">
                              <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-md border ${statusObj.color}`}>
                                {statusObj.text}
                              </span>

                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all duration-200">
                                {googleAccessToken && !task.completed && (
                                  <>
                                    {task.syncedToGCal ? (
                                      <button 
                                        onClick={() => removeTaskFromGoogleCalendar(task)}
                                        className="p-1 text-green-600 dark:text-green-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-952/10 rounded transition-all cursor-pointer"
                                        title="Synced. Click to remove from Google Calendar"
                                        aria-label={`Remove "${task.title}" from Google Calendar`}
                                      >
                                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                                      </button>
                                    ) : (
                                      <button 
                                        onClick={() => exportTaskToGoogleCalendar(task)}
                                        className="p-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-952/10 rounded transition-all cursor-pointer"
                                        title="Export to Google Calendar"
                                        aria-label={`Export "${task.title}" to Google Calendar`}
                                      >
                                        <Calendar className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </>
                                )}
                                <button 
                                  onClick={() => handleEditClick(task)}
                                  className="p-1 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-952/10 rounded transition-all cursor-pointer"
                                  title="Edit Task Details"
                                  aria-label={`Edit task "${task.title}" details`}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="p-1 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-952/10 rounded transition-all cursor-pointer"
                                  title="Delete task log"
                                  aria-label={`Delete task "${task.title}" log`}
                                >
                                  <Trash className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 3: AI ASSISTANT CHAT TERMINAL */}
            {activeTab === 'chat' && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[560px] overflow-hidden" id="chat-scaffold">
                {/* Chat window heading */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-lg">
                      <Brain className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <span className="font-extrabold text-xs block text-slate-800 dark:text-white uppercase tracking-wider">OnTime AI Assistant</span>
                      <span className="text-[10px] text-slate-400">Generative companion model 3.5 active</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleClearChat}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                      title="Clear chat history"
                      aria-label="Clear chat history"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                    <Sparkles className="h-4 w-4 text-amber-500 animate-spin" style={{ animationDuration: '6s' }} />
                  </div>
                </div>

                {/* Messages stream roll */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.map((msg, i) => (
                    <div 
                      key={i} 
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                        msg.role === 'user' 
                          ? 'bg-blue-600 text-white font-semibold rounded-br-none' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none'
                      }`}>
                        {msg.role === 'user' ? (
                          msg.content.split('\n').map((line, idx) => (
                            <p key={idx} className={idx > 0 ? 'mt-1.5' : ''}>{line}</p>
                          ))
                        ) : (
                          renderMarkdown(msg.content)
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 dark:bg-slate-800 p-3.5 rounded-2xl rounded-bl-none text-xs text-slate-400 flex items-center gap-1.5 font-bold animate-pulse">
                        <RefreshCw className="h-3 w-3 animate-spin text-blue-600" /> OnTime AI is composing...
                      </div>
                    </div>
                  )}
                </div>

                {/* Instant prompts row */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800/80 flex gap-2 flex-wrap text-[10px]">
                  <button 
                    onClick={() => handleSendChat('Plan my day')}
                    disabled={chatLoading}
                    className="bg-white hover:bg-blue-50 border border-slate-200 text-slate-700 hover:text-blue-600 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer shadow-2xs dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    📅 Plan my day
                  </button>
                  <button 
                    onClick={() => handleSendChat('Prioritize my work')}
                    disabled={chatLoading}
                    className="bg-white hover:bg-blue-50 border border-slate-200 text-slate-700 hover:text-blue-600 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer shadow-2xs dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    ⚖️ Prioritize my work
                  </button>
                  <button 
                    onClick={() => handleSendChat('How can I finish before tomorrow?')}
                    disabled={chatLoading}
                    className="bg-white hover:bg-blue-50 border border-slate-200 text-slate-700 hover:text-blue-600 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer shadow-2xs dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    ⚠️ Finish before tomorrow
                  </button>
                  <button 
                    onClick={() => handleSendChat('What should I do next?')}
                    disabled={chatLoading}
                    className="bg-white hover:bg-blue-50 border border-slate-200 text-slate-700 hover:text-blue-600 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer shadow-2xs dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    🚀 What should I do next?
                  </button>
                </div>

                {/* Input block */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChat();
                  }}
                  className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2"
                >
                  <input 
                    type="text" 
                    placeholder="Ask assistant something... e.g. Triage my goals..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 outline-none focus:border-blue-500 bg-slate-50/50 dark:bg-slate-800 dark:text-slate-100"
                    disabled={chatLoading}
                    aria-label="Ask assistant something"
                  />
                  <button 
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-2.5 rounded-xl transition-all cursor-pointer shadow-sm"
                    disabled={chatLoading}
                    aria-label="Send message to OnTime AI"
                  >
                    <Send className="h-4.5 w-4.5" />
                  </button>
                </form>
              </div>
            )}

            {/* TAB 4: EMERGENCY MODE WORKSPACE */}
            {activeTab === 'emergency' && (
              <div className="space-y-6">
                
                {/* Imminent crisis status block */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-36 h-36 bg-rose-500/5 rounded-full blur-2xl pointer-events-none"></div>
                  
                  <div className="flex justify-center">
                    <div className="p-4 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full h-16 w-16 flex items-center justify-center animate-beat">
                      <Zap className="h-8 w-8 text-rose-600 animate-pulse" />
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-black font-display tracking-tight text-slate-900 dark:text-white uppercase">Turnaround Protocol Level</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                      {emergencyCountdown 
                        ? `Emergency Mode is actively running due to "${emergencyCountdown.title}" deadline proximity threat inside 24 hours!`
                        : 'No pending objectives have looming 24 hour deadlines. System is running under sustainable standards.'}
                    </p>
                  </div>

                  {emergencyCountdown ? (
                    <div className="space-y-4">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">Target Threshold Deficit Countdown</span>
                      <div className="flex justify-center items-center gap-4 text-center">
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl min-w-16 border border-slate-100 dark:border-slate-800">
                          <span className="text-2xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400 block">{emergencyCountdown.hours.toString().padStart(2, '0')}</span>
                          <span className="text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold block mt-0.5">Hours</span>
                        </div>
                        <span className="text-xl font-bold font-mono text-slate-300">:</span>
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl min-w-16 border border-slate-100 dark:border-slate-800">
                          <span className="text-2xl font-black font-mono tracking-tight text-rose-600  dark:text-rose-400 block">{emergencyCountdown.minutes.toString().padStart(2, '0')}</span>
                          <span className="text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold block mt-0.5">Minutes</span>
                        </div>
                        <span className="text-xl font-bold font-mono text-slate-300">:</span>
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl min-w-16 border border-slate-100 dark:border-slate-800">
                          <span className="text-2xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400 block">{emergencyCountdown.seconds.toString().padStart(2, '0')}</span>
                          <span className="text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold block mt-0.5">Seconds</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900 p-4 rounded-2xl text-xs max-w-sm mx-auto text-blue-800 dark:text-blue-300">
                      👍 All objectives currently structured safely. You can manually simulate emergency by custom-scheduling tasks for today.
                    </div>
                  )}
                </div>

                {/* Tactical Recovery plans & Alerts */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Activity className="h-4 w-4 text-blue-600" /> Crisis Plan of Execution
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="border-l-2 border-rose-500 pl-4 space-y-4">
                      {parsedAnalysis.schedule && parsedAnalysis.schedule.length > 0 ? (
                        parsedAnalysis.schedule.slice(0, 4).map((planItem, idx) => {
                          let displayStr = '';
                          if (typeof planItem === 'object' && planItem !== null) {
                            const time = (planItem as any).time || '';
                            const activity = (planItem as any).activity || '';
                            displayStr = time ? `${time} - ${activity}` : activity;
                          } else {
                            displayStr = String(planItem);
                          }

                          return (
                            <div key={idx} className="text-xs">
                              <span className="font-extrabold text-rose-600 dark:text-rose-400 block">Immediate turnaround block #{idx + 1}</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-200 mt-1 block leading-relaxed">{displayStr}</span>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-400 italic">No scheduled priorities compiled.</p>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 5: COACH ANALYTICS WORKSPACE */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                
                {/* Profile strengths & advice panel */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 p-5 shadow-xs space-y-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="h-5.5 w-5.5 text-blue-600" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white">Active Habits Breakdown</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Strengths */}
                    <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100/60 dark:border-slate-800/50 text-xs space-y-2">
                      <span className="font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest text-[9px] block">Personal Profile Strengths</span>
                      <p className="text-slate-700 dark:text-slate-200 leading-relaxed font-semibold">
                        "Your average morning execution throughput has increased by 15%. Highly productive between 9 AM and 11:30 AM."
                      </p>
                    </div>

                    {/* Areas of Improvements */}
                    <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100/60 dark:border-slate-800/50 text-xs space-y-2">
                      <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest text-[9px] block">Areas for Improvement</span>
                      <p className="text-slate-700 dark:text-slate-200 leading-relaxed font-semibold">
                        "Vulnerable to afternoon transition fatigue after 3:00 PM. High threat of uncompleted Quadrant I items when multitasking."
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/60 dark:border-blue-900/60 rounded-2xl text-xs space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-blue-800 dark:text-blue-300 block">AI Strategic Suggestion Briefing</span>
                    <p className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                      "To safeguard your scheduling consistency, consider dedicating your first 25-minute Pomodoro segment strictly to Quadrant I objectives. Restrict mail triggers during focal blocks."
                    </p>
                  </div>
                </div>

                {/* AI Insights & Trends */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Tactical Insights Tracker</h3>
                  
                  <div className="grid grid-cols-1 gap-3 text-xs">
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Total Completed Requirements</span>
                      </div>
                      <span className="font-black font-mono text-slate-800 dark:text-white">{totalCompleted} tasks</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Active Task Congestion</span>
                      </div>
                      <span className="font-black font-mono text-slate-800 dark:text-white">{totalPending} objectives</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-amber-500" />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Deadlines approaching this week</span>
                      </div>
                      <span className="font-black font-mono text-slate-800 dark:text-white">{deadlinesThisWeek} item blocks</span>
                    </div>
                  </div>
                </div>

                {/* Productivity Accomplishment Badges */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <Award className="h-5 w-5 text-amber-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">Productivity Achievements</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        id: 'first-step',
                        title: 'First Step',
                        desc: 'Complete at least 1 objective',
                        icon: '🎯',
                        unlocked: totalCompleted >= 1
                      },
                      {
                        id: 'inbox-zero',
                        title: 'Zero Congestion',
                        desc: 'Triage all catalog objectives',
                        icon: '🧹',
                        unlocked: totalCompleted > 0 && totalPending === 0
                      },
                      {
                        id: 'quad-one',
                        title: 'Priority Master',
                        desc: 'Clear all Critical priority tasks',
                        icon: '👑',
                        unlocked: tasks.filter(t => t.importance === 'Critical' && !t.completed).length === 0 && tasks.some(t => t.importance === 'Critical')
                      },
                      {
                        id: 'marathon',
                        title: 'Deep Work Hero',
                        desc: 'Log a task of 3 hours or more',
                        icon: '🚴',
                        unlocked: tasks.some(t => {
                          if (!t.completed) return false;
                          const hrs = parseFloat(t.estimatedEffort || '0');
                          return hrs >= 3 || (t.estimatedEffort && t.estimatedEffort.includes('3h'));
                        })
                      },
                      {
                        id: 'focus-sprint',
                        title: 'Sprint Champion',
                        desc: 'Complete 3 or more total objectives',
                        icon: '⚡',
                        unlocked: totalCompleted >= 3
                      },
                      {
                        id: 'perfectionist',
                        title: 'Subtask Slayer',
                        desc: 'Check off 5 individual checklist steps',
                        icon: '🛡️',
                        unlocked: Object.values(subtaskProgress).filter(v => v === true).length >= 5
                      }
                    ].map((badge) => (
                      <div 
                        key={badge.id}
                        className={`p-3 rounded-2xl border transition-all flex items-start gap-2.5 ${
                          badge.unlocked 
                            ? 'bg-blue-50/40 dark:bg-blue-950/15 border-blue-200 dark:border-blue-900 shadow-3xs' 
                            : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/80 opacity-50'
                        }`}
                      >
                        <span className={`text-xl p-1.5 rounded-lg shrink-0 ${badge.unlocked ? 'bg-blue-100 dark:bg-blue-900/55' : 'bg-slate-200/50 dark:bg-slate-850'}`}>
                          {badge.icon}
                        </span>
                        <div className="space-y-0.5">
                          <span className={`font-bold text-[11px] block ${badge.unlocked ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500'}`}>
                            {badge.title}
                          </span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 block leading-tight">
                            {badge.desc}
                          </span>
                          <span className={`text-[8px] uppercase font-bold tracking-widest block ${badge.unlocked ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                            {badge.unlocked ? 'Unlocked ✓' : 'Locked'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'calendar' && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Header Greeting Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-blue-100/30 dark:bg-blue-900/10 rounded-full blur-2xl pointer-events-none"></div>
                  <div>
                    <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">Google Calendar Sync Center</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Establish real-time planning loops, prevent scheduled event conflicts, and advisor-synchronize tasks directly with your primary calendar.</p>
                  </div>
                </div>

                {/* Status/Message Banner if any */}
                {calendarSyncMessage && (
                  <div className="p-4 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-2xl flex items-center justify-between text-xs text-blue-700 dark:text-blue-300">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-500 shrink-0" />
                      <span>{calendarSyncMessage}</span>
                    </div>
                    <button onClick={() => setCalendarSyncMessage(null)} className="font-bold hover:underline cursor-pointer">Dismiss</button>
                  </div>
                )}

                {/* Connection Controls Panel */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                  {!googleAccessToken ? (
                    <div className="text-center py-8 max-w-md mx-auto space-y-4">
                      <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                        <Calendar className="h-8 w-8" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-base text-slate-900 dark:text-white">No Google Calendar Connected</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          Authorize OnTime AI to access your schedule events and sync task deadlines directly to your primary calendar. Credentials are held securely in-memory.
                        </p>
                      </div>
                      <button
                        onClick={handleConnectCalendar}
                        disabled={calendarSyncing}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 hover:shadow-lg transition-all cursor-pointer"
                      >
                        {calendarSyncing ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            <span>Linking Calendar...</span>
                          </>
                        ) : (
                          <>
                            <Calendar className="h-4 w-4" />
                            <span>Connect Google Calendar</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center shadow-xs">
                          <CheckCircle2 className="h-5.5 w-5.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Status</h4>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Google Calendar Connected</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => fetchCalendarEvents()}
                          disabled={calendarSyncing}
                          className="px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${calendarSyncing ? 'animate-spin' : ''}`} />
                          <span>Refresh Calendar</span>
                        </button>
                        <button
                          onClick={syncAllTasksToGoogleCalendar}
                          disabled={calendarSyncing}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Sync All Unsynced</span>
                        </button>
                        <button
                          onClick={handleDisconnectCalendar}
                          className="px-4 py-2 bg-transparent hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-500 hover:text-rose-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-900/50 font-bold rounded-xl text-xs transition-all cursor-pointer"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Main Calendar Management Split */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Sync Queue Column */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <ListTodo className="h-4.5 w-4.5 text-blue-500" /> Synchronization Queue
                      </h3>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
                        {tasks.filter(t => !t.completed).length} Tasks
                      </span>
                    </div>

                    <div className="space-y-3">
                      {tasks.filter(t => !t.completed).map(task => {
                        const { start, end } = parseTaskTiming(task);
                        const formatTime = (date: Date) => {
                          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        };
                        const formatDate = (date: Date) => {
                          return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                        };

                        return (
                          <div 
                            key={task.id} 
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-3xs space-y-3 relative overflow-hidden"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="space-y-1">
                                <span className={`inline-block text-[9px] uppercase font-black px-1.5 py-0.5 rounded-md tracking-wider ${
                                  task.importance === 'Critical' ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/40' :
                                  task.importance === 'High' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40' :
                                  task.importance === 'Medium' ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40' :
                                  'bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800/80'
                                }`}>
                                  {task.importance} Priority
                                </span>
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">{task.title}</h4>
                              </div>
                              
                              {googleAccessToken && (
                                <div>
                                  {task.syncedToGCal ? (
                                    <button
                                      onClick={() => removeTaskFromGoogleCalendar(task)}
                                      disabled={calendarSyncing}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
                                      title="Remove from Calendar"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => exportTaskToGoogleCalendar(task)}
                                      disabled={calendarSyncing}
                                      className="p-1.5 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg transition-all cursor-pointer"
                                      title="Export to Calendar"
                                    >
                                      <Plus className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                              <div>
                                <span className="block text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-extrabold">Active Window</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {formatDate(start)} @ {formatTime(start)} - {formatTime(end)}
                                </span>
                              </div>
                              <div>
                                <span className="block text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-extrabold">Allocated Duration</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {task.estimatedEffort} ({task.category})
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {task.syncedToGCal ? (
                                <span className="text-[9px] font-bold text-green-600 dark:text-green-400 flex items-center gap-0.5">
                                  <Check className="h-3 w-3 stroke-[3]" /> Synced to Google Calendar
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-400 dark:text-slate-500 italic">
                                  Not exported yet
                                </span>
                              )}
                            </div>

                          </div>
                        );
                      })}

                      {tasks.filter(t => !t.completed).length === 0 && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 space-y-2">
                          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
                          <p className="font-bold text-xs text-slate-800 dark:text-white">All Clear!</p>
                          <p className="text-[10px] leading-relaxed">There are no active pending tasks in your catalog queue.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Calendar Agenda Column */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Calendar className="h-4.5 w-4.5 text-blue-500" /> Primary Calendar Feed
                      </h3>
                      {googleAccessToken && (
                        <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">
                          {calendarEvents.length} Events
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {!googleAccessToken ? (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 space-y-2">
                          <Calendar className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto" />
                          <p className="font-bold text-xs">Calendar Feed Standby</p>
                          <p className="text-[10px] leading-relaxed">Connect your account above to fetch and inspect your real schedule conflicts.</p>
                        </div>
                      ) : calendarSyncing && calendarEvents.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 space-y-2">
                          <RefreshCw className="h-8 w-8 text-blue-500 mx-auto animate-spin" />
                          <p className="font-bold text-xs">Retrieving Google Calendar...</p>
                        </div>
                      ) : (
                        <>
                          {calendarEvents.map(event => {
                            const eventStart = event.start?.dateTime ? new Date(event.start.dateTime) : (event.start?.date ? new Date(event.start.date) : null);
                            const eventEnd = event.end?.dateTime ? new Date(event.end.dateTime) : (event.end?.date ? new Date(event.end.date) : null);
                            
                            const formatTime = (date: Date | null) => {
                              if (!date) return 'All Day';
                              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            };
                            
                            const formatDate = (date: Date | null) => {
                              if (!date) return '';
                              return date.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });
                            };

                            const overlappingTasks = getOverlappingTasksForEvent(event);

                            return (
                              <div 
                                key={event.id}
                                className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-3xs space-y-2 transition-all ${
                                  overlappingTasks.length > 0 
                                    ? 'border-amber-200 dark:border-amber-950/60 bg-amber-50/10 dark:bg-amber-950/5' 
                                    : 'border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">{event.summary || '(No Title)'}</h4>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                      {formatDate(eventStart)} {eventStart && `• ${formatTime(eventStart)} - ${formatTime(eventEnd)}`}
                                    </p>
                                  </div>
                                  <span className="text-[8px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">
                                    Google Cal
                                  </span>
                                </div>

                                {event.description && (
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-2 italic leading-relaxed border-t border-slate-100 dark:border-slate-800/80 pt-1.5">
                                    {event.description}
                                  </p>
                                )}

                                {/* Conflicts Warning */}
                                {overlappingTasks.length > 0 && (
                                  <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-xl space-y-1.5">
                                    <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Schedule Conflict Alert
                                    </span>
                                    <div className="space-y-1">
                                      {overlappingTasks.map(t => (
                                        <div key={t.id} className="text-[9px] text-slate-600 dark:text-slate-300 leading-normal flex items-start gap-1 pl-1">
                                          <span>•</span>
                                          <span>Task <strong>"{t.title}"</strong> overlaps this slot!</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {calendarEvents.length === 0 && (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 space-y-2">
                              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
                              <p className="font-bold text-xs text-slate-800 dark:text-white font-display">Schedule Clear</p>
                              <p className="text-[10px] leading-relaxed">No calendar events found in your primary calendar for the next 7 days.</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                </div>

              </div>
            )}

            {activeTab === 'soundscape' && (
              <Soundscapes pomodoroRunning={timerRunning} timerMode={timerMode} />
            )}

          </main>

          {/* RIGHT COLUMN: AI RECOMMENDATIONS & ACTIONS COCH */}
          <aside className="lg:col-span-3 space-y-6">
            
            {/* The Gemini Trigger Panel */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Brain className="h-5.5 w-5.5 text-blue-600 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Time Scheduler Opts</h3>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Re-prioritize task sequences, break down targets, and generate schedules using Gemini server metrics.
              </p>

              {/* Day settings adjustments */}
              <div className="space-y-3 pt-1 text-xs font-semibold">
                <div>
                  <label className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Focus hours available</label>
                  <input 
                    type="number" 
                    value={availableHours}
                    onChange={(e) => setAvailableHours(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full text-xs font-bold border-slate-200 dark:border-slate-800 border rounded-xl p-2.5 bg-slate-50/50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Preferred work intervals</label>
                  <input 
                    type="text" 
                    value={preferredWorkHours}
                    placeholder="e.g. 09:00 - 17:00"
                    onChange={(e) => setPreferredWorkHours(e.target.value)}
                    className="w-full text-xs font-bold border-slate-200 dark:border-slate-800 border rounded-xl p-2.5 bg-slate-50/50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Custom Prompt (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Include morning jog break..."
                    value={customRequestInput}
                    onChange={(e) => setCustomRequestInput(e.target.value)}
                    className="w-full text-xs font-bold border-slate-200 dark:border-slate-800 border rounded-xl p-2.5 bg-slate-50/50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all placeholder:text-slate-400 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <button 
                onClick={triggerAIAnalysis}
                disabled={isLoadingAnalysis}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-extrabold py-3 rounded-xl transition-all shadow-sm text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isLoadingAnalysis ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Synthesizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Trigger Gemini Synthesis
                  </>
                )}
              </button>
            </div>

            {/* COACH ADVICE DIRECTIVE CARD */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">Next Coach Directive</span>
              
              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900 rounded-2xl text-xs space-y-2">
                <span className="text-[9px] uppercase font-black text-blue-700 dark:text-blue-400 block tracking-widest">Coaching Tip</span>
                <p className="text-slate-700 dark:text-slate-300 italic font-semibold leading-relaxed">
                  "{parsedAnalysis.productivity_tip}"
                </p>
              </div>

              <div className="space-y-1 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Recommended next action</span>
                <p className="font-extrabold text-slate-800 dark:text-slate-200 leading-relaxed">
                  {parsedAnalysis.next_action}
                </p>
              </div>

              <button 
                onClick={() => {
                  handleTimerModeChange('focus');
                  startStopTimer();
                }}
                className="w-full text-center text-xs font-extrabold bg-blue-50 hover:bg-blue-105 border border-blue-200 text-blue-700 py-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                Launch Focused Session
              </button>
            </div>

            {/* POMODORO WORKSTATION widget */}
            <div className="bg-slate-950 text-white rounded-3xl p-5 shadow-md border border-slate-800 space-y-4 relative overflow-hidden" id="pomodoro-aside">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Timer className="h-4.5 w-4.5 text-blue-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-blue-400">Tactical Focus</span>
                </div>
                
                <span className="text-[8px] bg-slate-800 text-slate-300 mb-0.5 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  {timerMode}
                </span>
              </div>

              {/* Timer metrics dial */}
              <div className="text-center py-2 relative flex flex-col items-center justify-center">
                <span className="text-3xl font-black font-mono tracking-tight block text-white tabular-nums">
                  {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:
                  {(timeLeft % 60).toString().padStart(2, '0')}
                </span>
                <span className="text-[8px] uppercase tracking-widest font-black text-slate-500 mt-1 block">
                  {timerRunning ? 'Session Engaged' : 'Suspended'}
                </span>
              </div>

              {/* Modes split bar */}
              <div className="grid grid-cols-3 gap-1.5 p-0.5 bg-slate-900 rounded-xl text-[9px] text-center font-bold">
                <button 
                  onClick={() => handleTimerModeChange('focus')}
                  className={`py-1.5 rounded-lg ${timerMode === 'focus' ? 'bg-blue-600 text-white font-extrabold' : 'text-slate-400 hover:text-white'}`}
                >
                  Focus
                </button>
                <button 
                  onClick={() => handleTimerModeChange('short')}
                  className={`py-1.5 rounded-lg ${timerMode === 'short' ? 'bg-blue-600 text-white font-extrabold' : 'text-slate-400 hover:text-white'}`}
                >
                  Short
                </button>
                <button 
                  onClick={() => handleTimerModeChange('long')}
                  className={`py-1.5 rounded-lg ${timerMode === 'long' ? 'bg-blue-600 text-white font-extrabold' : 'text-slate-400 hover:text-white'}`}
                >
                  Long
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={startStopTimer}
                  className="flex-1 bg-blue-600 hover:bg-blue-550 text-slate-950 font-black text-center text-xs py-2 rounded-xl bg-blue-500 hover:bg-blue-400 transition-colors cursor-pointer"
                  aria-label={timerRunning ? "Pause session timer" : "Start session timer"}
                >
                  {timerRunning ? 'Pause Session' : 'Start Session'}
                </button>
                <button 
                  onClick={resetTimer}
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl transition-all cursor-pointer"
                  title="Reset clock"
                  aria-label="Reset clock"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Link selected task */}
              <div className="space-y-1 text-xs">
                <select 
                  value={selectedTaskForTimer}
                  onChange={(e) => setSelectedTaskForTimer(e.target.value)}
                  aria-label="Select task for timer session"
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-slate-300 focus:outline-none focus:border-blue-500 text-[10px]"
                >
                  {tasks.filter(t => !t.completed).map(t => (
                    <option key={t.id} value={t.id}>{t.title} ({t.estimatedEffort})</option>
                  ))}
                  {tasks.filter(t => !t.completed).length === 0 && (
                    <option value="">No targets scheduled</option>
                  )}
                </select>
              </div>
            </div>

            {/* Quick action JSON copier tab */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs text-xs space-y-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Strict Text brief</span>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                Copy raw compiled JSON configuration for external workflow tools.
              </p>
              <button 
                id="copy-indicator"
                onClick={handleCopyCode}
                className="w-full py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer select-none text-slate-700 dark:text-slate-200 dark:border-slate-800"
              >
                Copy Plan
              </button>
            </div>

          </aside>

        </div>

        {/* Footer */}
        <footer className="mt-16 border-t border-slate-200 dark:border-slate-800 pt-6 pb-12 flex flex-col md:flex-row justify-between items-center text-xs text-slate-400 dark:text-slate-500 gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4.5 w-4.5 text-blue-500" />
            <span>© 2026 OnTime AI. Active protection against deadline degradation. Secure execution.</span>
          </div>
          <div className="flex gap-4">
            <span className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-help">Secure Protocol</span>
            <span>•</span>
            <span className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-help">Workspace Status</span>
          </div>
        </footer>

        {/* Authentication Modal */}
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative overflow-hidden">
              {/* Background Accent Gradients */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -z-10"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-green-500/10 rounded-full blur-2xl -z-10"></div>
              
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white font-display">
                    {authIsSignUp ? 'Create Cloud Account' : 'Welcome to Cloud Sync'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {authIsSignUp ? 'Register to safely backup your productivity plans.' : 'Sign in to access your objectives on any device.'}
                  </p>
                </div>
                <button 
                  onClick={() => setShowAuthModal(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  aria-label="Close authentication modal"
                >
                  <span className="text-lg font-bold">×</span>
                </button>
              </div>

              {/* Error Alert */}
              {authError && (
                <div className="mb-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-3 rounded-xl flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
                  <input 
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-hidden focus:border-blue-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
                  <input 
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-hidden focus:border-blue-500 text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {authLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
                  <span>{authIsSignUp ? 'Sign Up' : 'Sign In'}</span>
                </button>
              </form>

              {/* Separator */}
              <div className="relative my-6 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                </div>
                <span className="relative px-3 bg-white dark:bg-slate-900 text-[10px] text-slate-400 uppercase font-bold tracking-wider">Or continue with</span>
              </div>

              {/* Google OAuth Login */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                className="w-full py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                <span>Google Account</span>
              </button>

              {/* Mode Toggle */}
              <div className="mt-6 text-center text-xs">
                <span className="text-slate-500">
                  {authIsSignUp ? 'Already have an account? ' : 'First time here? '}
                </span>
                <button
                  onClick={() => {
                    setAuthError('');
                    setAuthIsSignUp(!authIsSignUp);
                  }}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-bold underline transition-colors cursor-pointer"
                >
                  {authIsSignUp ? 'Sign In Instead' : 'Register Account'}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
