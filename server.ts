import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Initialize Gemini API client lazily
const apiKey = process.env.GEMINI_API_KEY;
const hasApiKey = !!apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim() !== '';
const ai = hasApiKey ? new GoogleGenAI({ 
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
}) : null;

console.log(`[OnTime AI Engine] API Key configured: ${hasApiKey}`);

// AI OnTime Chat Assistant Endpoint
app.post('/api/ontime/chat', async (req, res) => {
  try {
    const { messages, tasks, currentLocalTime } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages must be provided as an array.' });
    }

    const lastUserMessage = messages[messages.length - 1]?.content || '';

    // Format tasks to supply context to the assistant
    const tasksCtx = (tasks || []).map((t: any, idx: number) => {
      return `- Task #${idx + 1}: ${t.title} (Deadline: ${t.deadline || 'None'}, Importance: ${t.importance || 'Medium'}, Status: ${t.completed ? 'Completed' : 'Pending'})`;
    }).join('\n');

    const systemInstruction = `
You are OnTime AI - an intelligent, highly motivational, professional productivity companion. Your purpose is to help users maintain their schedules, manage threat levels of deadlines, and actively beat procrastination.

Current Time: ${currentLocalTime || new Date().toISOString()}

User's Task Logs Context:
${tasksCtx || 'No tasks currently scheduled.'}

Please provide a highly motivating, professional, actionable reply to the user's request.
Keep your tone encouraging, proactive, professional and clean. Include actionable details or recommend productive execution models (like Pomodoro sprints, Time Blocking, or the Eisenhower quadrant).
`;

    if (ai) {
      try {
        // Map roles 'assistant' -> 'model' and format parts for multi-turn chat in @google/genai
        const contents = messages.map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }));

        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents,
          config: {
            systemInstruction
          }
        });

        const textResponse = response.text ? response.text.trim() : '';
        if (textResponse) {
          return res.json({ reply: textResponse });
        }
      } catch (geminiError: any) {
        console.error('Error in chat model:', geminiError);
      }
    }

    // Fallback response if offline/no API key
    let fallbackReply = "I have reviewed your active schedules. To proceed, I suggest initiating a 25-minute Pomodoro sprint for your most urgent tasks. Please let me know if you would like me to draft a time-blocking layout for you!";
    const lastLower = lastUserMessage.toLowerCase();
    if (lastLower.includes('plan my day')) {
      fallbackReply = "Here is an optimized time blocking plan for today:\n- **09:00 - 09:30**: Triage priority goals & eliminate Quadrant IV distractions\n- **09:30 - 11:30**: Hyper-focus sprint on your top priority item block\n- **11:30 - 12:00**: Restoration breather\n- **13:00 - 16:00**: Tackle high-effort project actions\n- **16:00 - 17:00**: Align pending objectives.";
    } else if (lastLower.includes('prioritize my work') || lastLower.includes('prioritize')) {
      fallbackReply = "Based on your active tasks list: I suggest placing '🔴 Critical' and '🟠 High' deadline items first in Quadrant I (Do First). Defer any '🔵 Low' importance items. What specific topic would you like to structure first?";
    } else if (lastLower.includes('before tomorrow') || lastLower.includes('finish')) {
      fallbackReply = "Emergency Mode recommendations deployed! To finish your work before tomorrow: \n1. Eliminate all notification alerts immediately.\n2. Execute 50-minute blocks with 10-minute restorative bounds.\n3. Address the absolute closest deadline first without multitasking.";
    } else if (lastLower.includes('what should i do next') || lastLower.includes('next')) {
      fallbackReply = "Your immediate next action is starting a Pomodoro block. Click 'Launch Focused Session Now' in your coaching recommendations widget to fire up the focus dial timer!";
    }

    return res.json({ reply: fallbackReply });

  } catch (error: any) {
    console.error('Server error during chat:', error);
    res.status(500).json({ error: error.message || 'Error executing OnTime AI chat.' });
  }
});

// AI OnTime Analysis Endpoint
app.post('/api/ontime/analyze', async (req, res) => {
  try {
    const { tasks, userMessage, currentLocalTime } = req.body;

    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'Tasks must be provided as an array.' });
    }

    // Format tasks for the prompt
    const tasksFormatted = tasks.map((t: any, idx: number) => {
      return `Task #${idx + 1}:
- Title: ${t.title}
- Deadline: ${t.deadline || 'No deadline'}
- Importance: ${t.importance || 'Medium'}
- Estimated Effort: ${t.estimatedEffort || 'Unspecified'}
- Status: ${t.completed ? 'Completed' : 'Pending'}
- Notes: ${t.notes || 'None'}`;
    }).join('\n\n');

    const promptMessage = `
Current Time: ${currentLocalTime || new Date().toISOString()}

User's Tasks:
${tasksFormatted || 'No tasks inputted yet. Please instruct the user to add tasks.'}

${userMessage ? `User's Special Request/Message: "${userMessage}"` : ''}

Please analyze these tasks as OnTime AI. 
Evaluate proximity of deadlines, task importance, and estimated effort to prioritize, breakdown and schedule.

You MUST return your response as a valid JSON object in EXACTLY the following JSON format:
{
  "priority_level": "Critical" | "High" | "Medium" | "Low",
  "priority_order": [
    "Title of Task A",
    "Title of Task B"
  ],
  "task_breakdowns": [
    {
      "task": "Title of the task",
      "urgency": "Short description of urgency, e.g. Due in 2 hours, Overdue by 1 day, or High Importance",
      "steps": [
        "First specific actionable step to complete this task",
        "Second specific actionable step to complete this task",
        "Third specific actionable step to complete this task"
      ]
    }
  ],
  "schedule": [
    "09:30 - 11:30: Deep Focus on Task Title",
    "11:30 - 12:00: Recharge split"
  ],
  "risk_alerts": [
    "Identify any critical risk block or time conflicts"
  ],
  "productivity_tip": "Motivative productivity tip recommending Pomodoro, Time Blocking, or Eisenhower Matrix.",
  "next_action": "Specific actionable next step recommendation for immediate execution.",
  "emergency_mode": true | false
}

If any deadline is within 24 hours or past its deadline, activate EMERGENCY MODE (set "emergency_mode" to true) and provide a detailed recovery plan.

Do not wrap the output in markdown code blocks. Return ONLY the raw valid JSON matching this schema.
`;

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: promptMessage,
          config: {
            responseMimeType: 'application/json'
          }
        });

        const textResponse = response.text ? response.text.trim() : '';
        if (textResponse) {
          const result = JSON.parse(textResponse);
          // Return the exact requested body structure
          return res.json({
            priority_level: result.priority_level || "High",
            priority_order: result.priority_order || [],
            task_breakdowns: result.task_breakdowns || [],
            schedule: result.schedule || [],
            risk_alerts: result.risk_alerts || [],
            productivity_tip: result.productivity_tip || "Stay focused and proceed with deliberate intent.",
            next_action: result.next_action || "",
            emergency_mode: !!result.emergency_mode
          });
        }
      } catch (geminiError: any) {
        console.error('Error invoking Gemini model, falling back to local reasoning:', geminiError);
      }
    }

    // LOCAL ALGORITHMIC FALLBACK
    const pendingTasks = tasks.filter((t: any) => !t.completed);
    
    let priorityLevel = 'Medium';
    const schedule: string[] = [];
    const riskAlerts: string[] = [];
    let productivityTip = 'Use Pomodoro sprints: 25 minutes of deep focus followed by a 5-minute breather.';
    let recommendation = 'Add some pending tasks with deadlines to trigger active time-boxing.';
    let emergencyMode = false;
    
    // Sort tasks based on deadline proximity and importance
    const sorted = [...pendingTasks].sort((a: any, b: any) => {
      const aTime = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bTime = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      
      const importanceWeight = (imp: string) => {
        if (imp === 'Critical') return 4;
        if (imp === 'High') return 3;
        if (imp === 'Medium') return 2;
        return 1;
      };

      if (aTime !== bTime) {
        return aTime - bTime;
      }
      return importanceWeight(b.importance) - importanceWeight(a.importance);
    });

    const parsedTaskBreakdowns = sorted.map((task: any) => {
      let urgencyText = 'Medium priority';
      const nowTime = currentLocalTime ? new Date(currentLocalTime).getTime() : Date.now();
      if (task.deadline) {
        const diffMs = new Date(task.deadline).getTime() - nowTime;
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffMs < 0) {
          urgencyText = 'Overdue';
          emergencyMode = true;
          riskAlerts.push(`Alert: "${task.title}" is currently overdue. High deadline threat!`);
        } else if (diffHrs < 24) {
          urgencyText = `Due in ${diffHrs}h`;
          emergencyMode = true;
          riskAlerts.push(`Urgent: "${task.title}" is due in less than 24 hours!`);
        } else {
          urgencyText = `Due in ${Math.floor(diffHrs / 24)}d`;
        }
      } else {
        urgencyText = task.importance || 'Medium';
      }

      return {
        task: task.title,
        urgency: urgencyText,
        steps: [
          `Gather specs and clarify objectives for "${task.title}"`,
          `Execute main implementation and tackle hurdles for "${task.title}" (${task.estimatedEffort || '1h'})`,
          `Validate milestones and check off target metrics`
        ]
      };
    });

    if (sorted.length > 0) {
      const topTask = sorted[0];
      const nowTime = currentLocalTime ? new Date(currentLocalTime).getTime() : Date.now();
      const urgentSoon = topTask.deadline ? (new Date(topTask.deadline).getTime() - nowTime < 24 * 60 * 60 * 1000) : false;

      if (topTask.importance === 'Critical' || urgentSoon || emergencyMode) {
        priorityLevel = 'Critical';
        emergencyMode = true;
        if (riskAlerts.length === 0) {
          riskAlerts.push(`Emergency: "${topTask.title}" has a looming deadline. Initiate immediate turnaround strategy.`);
        }
      } else if (topTask.importance === 'High') {
        priorityLevel = 'High';
      }

      schedule.push('09:00 - 09:30: Immediate Strategy and Prioritization Session');
      schedule.push(`09:30 - 11:30: Tactical focus segment on "${topTask.title}" using Pomodoro technique`);
      schedule.push('11:30 - 12:00: Recharge break and checklist review');
      
      recommendation = `Initiate a focused 25-minute Pomodoro sprint for "${topTask.title}" immediately.`;
      productivityTip = 'Emergency Mode active. Execute tasks in 50-minute hyper-focus blocks with 10-minute rest bounds.';
    } else {
      parsedTaskBreakdowns.push({
        task: 'No active tasks found',
        urgency: 'Minimal',
        steps: [
          'Add a new task in the catalog card',
          'Configure a strict deadline and high priority',
          'Initiate OnTime tracking to safeguard your schedule'
        ]
      });
      schedule.push('09:00 - 10:00: Mindful planning segment');
    }

    const priorityOrder = sorted.map((t: any) => t.title);

    return res.json({
      priority_level: priorityLevel,
      priority_order: priorityOrder,
      task_breakdowns: parsedTaskBreakdowns,
      schedule: schedule,
      risk_alerts: riskAlerts,
      productivity_tip: productivityTip,
      next_action: recommendation,
      emergency_mode: emergencyMode
    });

  } catch (error: any) {
    console.error('Server error during analysis:', error);
    res.status(500).json({ error: error.message || 'Error executing OnTime AI engine.' });
  }
});

// Serve frontend assets
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  // Leverage Vite Dev Server as a middleware
  try {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    console.log('[OnTime AI Engine] Dev Mode: Vite dev middlewares attached.');
  } catch (err) {
    console.error('Failed to attach Vite dev middleware:', err);
  }
}

app.listen(port, '0.0.0.0', () => {
  console.log(`[OnTime AI Engine] Server running on port ${port}`);
});
