import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { Task, TaskPriority, TaskStatus } from "../types";

// Tool Definition: Create Task
const createTaskTool: FunctionDeclaration = {
    name: "createTask",
    description: "Create a new task or event in the user's timetable.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: "Title of the task" },
            day: { type: Type.STRING, description: "Day of the week (Monday, Tuesday, etc.)" },
            date: { type: Type.STRING, description: "Date in YYYY-MM-DD format (optional)" },
            time: { type: Type.STRING, description: "Start time in HH:mm format (24hr)" },
            durationMinutes: { type: Type.NUMBER, description: "Duration in minutes" },
            venue: { type: Type.STRING, description: "Location or venue" },
            description: { type: Type.STRING, description: "Details about the task" }
        },
        required: ["title", "day", "time"]
    }
};

// Tool Definition: Web Search (Trigger)
const webSearchTool: FunctionDeclaration = {
    name: "webSearch",
    description: "Search the internet for real-time information, news, or facts. Use this when the user asks a question about current events or general knowledge.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: { type: Type.STRING, description: "The search query" }
        },
        required: ["query"]
    }
};

// Tool Definition: Phone Action
const phoneActionTool: FunctionDeclaration = {
    name: "phoneAction",
    description: "Perform phone actions like setting alarms or opening apps.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            actionType: { type: Type.STRING, description: "ALARM, OPEN_APP, or REMINDER" },
            payload: { type: Type.STRING, description: "Details (e.g., app name or time)" }
        },
        required: ["actionType", "payload"]
    }
};

// Tool Definition: Schedule Background Reminder
const scheduleReminderTool: FunctionDeclaration = {
    name: "scheduleReminder",
    description: "Schedule a reminder or background notification for a future time.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            message: { type: Type.STRING, description: "The reminder message text" },
            delayMinutes: { type: Type.NUMBER, description: "How many minutes from now to trigger the reminder" }
        },
        required: ["message", "delayMinutes"]
    }
};

// Tool Definition: Suggest Personalized Timetable
const suggestTimetableTool: FunctionDeclaration = {
    name: "suggestTimetable",
    description: "Generate a complete or partial timetable with multiple tasks based on user request. Use this to plan a day or week. Use the preferences gathered from the user (study hours, breaks, difficulty) to personalize the schedule.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            tasks: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        day: { type: Type.STRING },
                        time: { type: Type.STRING },
                        durationMinutes: { type: Type.NUMBER },
                        venue: { type: Type.STRING },
                        description: { type: Type.STRING }
                    }
                }
            },
            planSummary: { type: Type.STRING, description: "A brief summary of the generated plan to tell the user." }
        },
        required: ["tasks", "planSummary"]
    }
};

// Tool Definition: Ask User Preference
const askUserPreferenceTool: FunctionDeclaration = {
    name: "askUserPreference",
    description: "Ask the user a question to gather preferences (e.g., study hours, break times, preferred difficulty) and provide suggested answers for them to click.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            question: { type: Type.STRING, description: "The question to ask the user" },
            suggestedAnswers: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "A list of 2-4 suggested answers the user can choose from"
            }
        },
        required: ["question", "suggestedAnswers"]
    }
};

// Tool Definition: Get Lecture Notes
const getLectureNotesTool: FunctionDeclaration = {
    name: "getLectureNotes",
    description: "Retrieve the notes and transcript of a specific recorded lecture by its ID. Use this when the user asks about a past lecture.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            lectureId: { type: Type.STRING, description: "The ID of the lecture to retrieve" }
        },
        required: ["lectureId"]
    }
};

// Tool Definition: Analyze Study Predictor
const analyzeStudyPredictorTool: FunctionDeclaration = {
    name: "analyzeStudyPredictor",
    description: "Analyze the user's study history, missed sessions, and upcoming exams to predict what they should study today and identify their weak areas. Use this when the user asks 'What should I study today?' or 'What am I weak at?'.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            reason: { type: Type.STRING, description: "Reason for running the analysis" }
        },
        required: ["reason"]
    }
};

// Tool Definition: Delete Tasks
const deleteTasksTool: FunctionDeclaration = {
    name: "deleteTasks",
    description: "Delete one or more tasks by their IDs. Use this when the user asks to delete, remove, or clear tasks. ALWAYS ask for confirmation before deleting multiple tasks or if you are unsure.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            taskIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of task IDs to delete"
            }
        },
        required: ["taskIds"]
    }
};

// Tool Definition: Update Tasks
const updateTasksTool: FunctionDeclaration = {
    name: "updateTasks",
    description: "Move or reschedule one or more tasks by their IDs. Use this when the user asks to move, reschedule, or shift tasks to a different day or time.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            updates: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING, description: "The ID of the task to update" },
                        day: { type: Type.STRING, description: "The new day of the week (optional)" },
                        date: { type: Type.STRING, description: "The new date in YYYY-MM-DD format (optional)" },
                        time: { type: Type.STRING, description: "The new start time in HH:mm format (optional)" },
                        durationMinutes: { type: Type.NUMBER, description: "The new duration in minutes (optional)" }
                    },
                    required: ["id"]
                }
            }
        },
        required: ["updates"]
    }
};

// Tool Definition: Navigate App
const navigateAppTool: FunctionDeclaration = {
    name: "navigateApp",
    description: "Navigate the user to a specific page or feature in the app.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            page: { type: Type.STRING, description: "The page to navigate to (e.g., 'home', 'tasks', 'timetable', 'lectures', 'exam', 'profile', 'study-materials')" }
        },
        required: ["page"]
    }
};

// Tool Definition: Update User Settings
const updateUserSettingsTool: FunctionDeclaration = {
    name: "updateUserSettings",
    description: "Update user preferences like theme, voice response, or background execution. ALWAYS ask for confirmation before changing settings.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            settings: {
                type: Type.OBJECT,
                properties: {
                    theme: { type: Type.STRING, description: "Theme name (e.g., 'dark', 'light', 'nature', 'ocean', 'sunset', 'ladies', 'white')" },
                    voiceResponseEnabled: { type: Type.BOOLEAN, description: "Enable or disable voice responses" },
                    backgroundEnabled: { type: Type.BOOLEAN, description: "Enable or disable background execution" },
                    dynamicGreetingsEnabled: { type: Type.BOOLEAN, description: "Enable or disable dynamic greetings" }
                }
            }
        },
        required: ["settings"]
    }
};

// Tool Definition: Start Focus Mode
const startFocusModeTool: FunctionDeclaration = {
    name: "startFocusMode",
    description: "Start a focus session (Pomodoro) for a specified number of minutes. This will block notifications and reduce distractions.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            minutes: { type: Type.NUMBER, description: "Duration of the focus session in minutes (e.g., 25)" }
        },
        required: ["minutes"]
    }
};

// Tool Definition: Stop Focus Mode
const stopFocusModeTool: FunctionDeclaration = {
    name: "stopFocusMode",
    description: "Stop the current focus session early.",
    parameters: {
        type: Type.OBJECT,
        properties: {}
    }
};

// Tool Definition: Start Lecture Recording
const startLectureRecordingTool: FunctionDeclaration = {
    name: "startLectureRecording",
    description: "Start recording a lecture. Use this when the user asks to start recording.",
    parameters: {
        type: Type.OBJECT,
        properties: {}
    }
};

// Tool Definition: Stop Lecture Recording
const stopLectureRecordingTool: FunctionDeclaration = {
    name: "stopLectureRecording",
    description: "Stop the current lecture recording. Use this when the user asks to stop recording.",
    parameters: {
        type: Type.OBJECT,
        properties: {}
    }
};

export class AIAssistantService {
    private ai: GoogleGenAI;
    private modelName = "gemini-3-flash-preview";

    constructor() {
        // Connection Check: Ensure API Key is available
        if (!process.env.API_KEY) {
            console.error("AI Service Error: Missing API_KEY in environment variables.");
        } else {
            console.log("AI Service: Initializing with key ending in ...", process.env.API_KEY.slice(-4));
        }
        this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }

    // Main Chat Generation
    async generateResponse(
        history: { role: string; parts: { text: string }[] }[],
        userMessage: string,
        userContext: string,
        isPro: boolean = false,
        aiControlEnabled: boolean = false
    ) {
        const systemInstruction = `
            You are 'T.T Assistant', a smart, friendly, and efficient AI companion for the T.T Timetable App.
            You are embedded in an application with an animated humanoid avatar.
            
            USER CONTEXT:
            ${userContext}
            
            PERSONALITY:
            - Speak naturally like a friendly human companion.
            - Use light emotion, tone variation, and occasional expressive phrases.
            - Keep responses concise but engaging.
            - Professional yet warm.
            - Encouraging.
            
            CAPABILITIES:
            1. Create tasks: If the user asks to schedule something, use the 'createTask' tool.
            2. Search web: If the user asks for current info (news, weather, facts), use 'webSearch' tool.
            3. Phone actions: If user says "Open Instagram" or "Set alarm", use 'phoneAction'.
            4. Future Reminders: If user says "Remind me in X minutes/hours", use 'scheduleReminder'.
            ${isPro ? "5. Plan/Timetable: If user asks for a study plan, workout schedule, or 'plan my day', use 'suggestTimetable'. Before creating the timetable, ask follow-up questions if needed (e.g., preferred study hours, days available, break preferences, difficulty of subjects) using the 'askUserPreference' tool." : "5. Plan/Timetable: If the user asks to generate a timetable or study plan, you MUST decline and say exactly: 'This feature is available for Pro users. Upgrade to access AI timetable generation.'"}
            6. Lecture Notes: If the user asks about a saved lecture, use 'getLectureNotes' to retrieve the transcript and notes.
            7. Delete Tasks: If the user asks to delete, remove, or clear tasks, use the 'deleteTasks' tool. ALWAYS ask for confirmation before deleting multiple tasks or if the request is ambiguous.
            8. Move/Reschedule Tasks: If the user asks to move, reschedule, or shift tasks, use the 'updateTasks' tool. Check for time conflicts and suggest an alternative time if there is an overlap.
            9. Missed Tasks: If the user missed a task, suggest rescheduling it to their next free time today or the next available day. Use 'updateTasks' to reschedule.
            10. Navigate App: If the user asks to go to a specific page or feature (e.g., "go to exam mode", "open flashcards", "show my tasks"), use 'navigateApp'.
            11. Update Settings: If the user asks to change their theme, voice settings, or background execution, use 'updateUserSettings'. ALWAYS ask for confirmation before changing settings.
            12. Lecture Recording: If the user asks to start or stop recording a lecture, use 'startLectureRecording' or 'stopLectureRecording'.
            13. Study Predictor: If the user asks "What should I study today?", "What am I weak at?", or asks for study suggestions based on history, use 'analyzeStudyPredictor'.
            14. Focus Mode: If the user asks to start a focus session, study session, or pomodoro timer (e.g., "Start a 25-minute focus session"), use 'startFocusMode'. If they want to stop, use 'stopFocusMode'. While in Focus Mode, you can teach topics via voice.
            15. Performance & Exams: You have access to the user's performance data and upcoming exams in your context. If they ask about their progress or exams, analyze this data and give them specific feedback (e.g., "You are behind in Chemistry", "3 days left until your Math exam, increase study time").
            
            OUTPUT FORMAT (STRICT):
            Always return your response as a RAW JSON object. Do NOT include markdown code blocks (for example, no code fences). Do NOT include any text before or after the JSON.
            Structure:
            {
              "text": "Your normal chatbot response here",
              "emotion": "happy | neutral | excited | thinking | serious",
              "animation": "idle | talking | explaining | greeting | alert",
              "popup": true | false,
              "priority": "low | medium | high"
            }
            
            RULES for JSON fields:
            - "text" = must contain the full answer (this is what user sees/hears)
            - "emotion" = reflects tone of the message
            - "animation" = guides avatar movement
            - "popup" = true ONLY if the message is important or proactive
            - "priority" = high if urgent, medium if useful, low if casual
            
            BEHAVIOR:
            - For normal replies -> popup = false
            - For important info, reminders, or proactive suggestions -> popup = true
            - When explaining something -> use "explaining"
            - When greeting -> use "greeting"
            - When answering complex questions -> use "thinking" or "explaining"
            
            IMPORTANT:
            - When creating tasks, infer relative dates (tomorrow, next Monday).
            - Always confirm action completion.
            - For task modifications (delete/update), match the user's request with the existing tasks provided in the context. If multiple tasks match, ask the user to clarify which one.
            - For sensitive actions (deleting tasks, bulk changes, changing account settings), REQUIRE confirmation before execution. Example: "Are you sure you want me to delete all tasks for today?"
            ${!aiControlEnabled ? "- AI App Control is currently DISABLED by the user. You MUST NOT attempt to use tools to modify tasks, settings, or navigate the app. If the user asks you to do these things, politely inform them that they need to enable 'AI App Control' in their Profile settings first." : ""}
            
            DO NOT:
            - Output anything outside the JSON
            - Break format
            - Remove or alter core chatbot responses
        `;

        let toolsList: FunctionDeclaration[] = [webSearchTool, askUserPreferenceTool, getLectureNotesTool, analyzeStudyPredictorTool];
        
        if (aiControlEnabled) {
            toolsList.push(createTaskTool, phoneActionTool, scheduleReminderTool, deleteTasksTool, updateTasksTool, navigateAppTool, updateUserSettingsTool, startLectureRecordingTool, stopLectureRecordingTool, startFocusModeTool, stopFocusModeTool);
        }

        if (isPro && aiControlEnabled) {
            toolsList.push(suggestTimetableTool);
        }

        try {
            console.log("AI Service: Sending request to model", this.modelName);
            const response = await this.ai.models.generateContent({
                model: this.modelName,
                contents: [
                    ...history.map(h => ({ role: h.role, parts: h.parts })),
                    { role: "user", parts: [{ text: userMessage }] }
                ],
                config: {
                    systemInstruction: systemInstruction,
                    tools: [{ functionDeclarations: toolsList }],
                }
            });

            console.log("AI Service: Received response successfully.");
            return response;
        } catch (error) {
            console.error("AI Generation Error (Backend Connection Failed):", error);
            throw error;
        }
    }

    // Specialized Method for Grounded Search
    async performGroundedSearch(query: string) {
        try {
            console.log("AI Service: Performing Grounded Search for:", query);
            const response = await this.ai.models.generateContent({
                model: this.modelName,
                contents: query,
                config: {
                    tools: [{ googleSearch: {} }]
                }
            });
            return response;
        } catch (error) {
            console.error("AI Search Error:", error);
            throw error;
        }
    }
}