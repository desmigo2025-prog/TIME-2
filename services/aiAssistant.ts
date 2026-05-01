import Groq from "groq-sdk";
import { Task, TaskPriority, TaskStatus } from "../types";

// Tool Definitions for Groq
const createTaskTool = {
    type: "function",
    function: {
        name: "createTask",
        description: "Create a new task or event in the user's timetable.",
        parameters: {
            type: "object",
            properties: {
                title: { type: "string", description: "Title of the task" },
                day: { type: "string", description: "Day of the week (Monday, Tuesday, etc.)" },
                date: { type: "string", description: "Date in YYYY-MM-DD format (optional)" },
                time: { type: "string", description: "Start time in HH:mm format (24hr)" },
                durationMinutes: { type: "number", description: "Duration in minutes" },
                venue: { type: "string", description: "Location or venue" },
                description: { type: "string", description: "Details about the task" }
            },
            required: ["title", "day", "time"]
        }
    }
};

const webSearchTool = {
    type: "function",
    function: {
        name: "webSearch",
        description: "Search the internet for real-time information, news, or facts. Use this when the user asks a question about current events or general knowledge.",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "The search query" }
            },
            required: ["query"]
        }
    }
};

const phoneActionTool = {
    type: "function",
    function: {
        name: "phoneAction",
        description: "Perform phone actions like setting alarms or opening apps.",
        parameters: {
            type: "object",
            properties: {
                actionType: { type: "string", description: "ALARM, OPEN_APP, or REMINDER" },
                payload: { type: "string", description: "Details (e.g., app name or time)" }
            },
            required: ["actionType", "payload"]
        }
    }
};

const scheduleReminderTool = {
    type: "function",
    function: {
        name: "scheduleReminder",
        description: "Schedule a reminder or background notification for a future time.",
        parameters: {
            type: "object",
            properties: {
                message: { type: "string", description: "The reminder message text" },
                delayMinutes: { type: "number", description: "How many minutes from now to trigger the reminder" }
            },
            required: ["message", "delayMinutes"]
        }
    }
};

const suggestTimetableTool = {
    type: "function",
    function: {
        name: "suggestTimetable",
        description: "Generate a complete or partial timetable with multiple tasks based on user request. Use this to plan a day or week. Use the preferences gathered from the user (study hours, breaks, difficulty) to personalize the schedule.",
        parameters: {
            type: "object",
            properties: {
                tasks: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            title: { type: "string" },
                            day: { type: "string" },
                            time: { type: "string" },
                            durationMinutes: { type: "number" },
                            venue: { type: "string" },
                            description: { type: "string" }
                        }
                    }
                },
                planSummary: { type: "string", description: "A brief summary of the generated plan to tell the user." }
            },
            required: ["tasks", "planSummary"]
        }
    }
};

const getLectureNotesTool = {
    type: "function",
    function: {
        name: "getLectureNotes",
        description: "Retrieve the notes and transcript of a specific recorded lecture by its ID. Use this when the user asks about a past lecture.",
        parameters: {
            type: "object",
            properties: {
                lectureId: { type: "string", description: "The ID of the lecture to retrieve" }
            },
            required: ["lectureId"]
        }
    }
};

const analyzeStudyPredictorTool = {
    type: "function",
    function: {
        name: "analyzeStudyPredictor",
        description: "Analyze the user's study history, missed sessions, and upcoming exams to predict what they should study today and identify their weak areas. Use this when the user asks 'What should I study today?' or 'What am I weak at?'.",
        parameters: {
            type: "object",
            properties: {
                reason: { type: "string", description: "Reason for running the analysis" }
            },
            required: ["reason"]
        }
    }
};

const deleteTasksTool = {
    type: "function",
    function: {
        name: "deleteTasks",
        description: "Delete one or more tasks by their IDs. Use this when the user asks to delete, remove, or clear tasks. ALWAYS ask for confirmation before deleting multiple tasks or if you are unsure.",
        parameters: {
            type: "object",
            properties: {
                taskIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of task IDs to delete"
                }
            },
            required: ["taskIds"]
        }
    }
};

const updateTasksTool = {
    type: "function",
    function: {
        name: "updateTasks",
        description: "Move or reschedule one or more tasks by their IDs. Use this when the user asks to move, reschedule, or shift tasks to a different day or time.",
        parameters: {
            type: "object",
            properties: {
                updates: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string", description: "The ID of the task to update" },
                            day: { type: "string", description: "The new day of the week (optional)" },
                            date: { type: "string", description: "The new date in YYYY-MM-DD format (optional)" },
                            time: { type: "string", description: "The new start time in HH:mm format (optional)" },
                            durationMinutes: { type: "number", description: "The new duration in minutes (optional)" }
                        },
                        required: ["id"]
                    }
                }
            },
            required: ["updates"]
        }
    }
};

const navigateAppTool = {
    type: "function",
    function: {
        name: "navigateApp",
        description: "Navigate the user to a specific page or feature in the app.",
        parameters: {
            type: "object",
            properties: {
                page: { type: "string", description: "The page to navigate to (e.g., 'home', 'tasks', 'timetable', 'lectures', 'exam', 'profile', 'study-materials')" }
            },
            required: ["page"]
        }
    }
};

const updateUserSettingsTool = {
    type: "function",
    function: {
        name: "updateUserSettings",
        description: "Update user preferences like theme, voice response, or background execution. ALWAYS ask for confirmation before changing settings.",
        parameters: {
            type: "object",
            properties: {
                settings: {
                    type: "object",
                    properties: {
                        theme: { type: "string", description: "Theme name (e.g., 'dark', 'light', 'nature', 'ocean', 'sunset', 'ladies', 'white'). If the user asks for a specific color like purple or red, set this to 'custom'." },
                        customThemeColor: { type: "string", description: "Hex color code for the custom theme (e.g., '#8A2BE2' for purple). ONLY use this if theme is 'custom'." },
                        voiceResponseEnabled: { type: "boolean", description: "Enable or disable voice responses" },
                        backgroundEnabled: { type: "boolean", description: "Enable or disable background execution" },
                        dynamicGreetingsEnabled: { type: "boolean", description: "Enable or disable dynamic greetings" },
                        aiControlEnabled: { type: "boolean", description: "Enable or disable AI App Control" },
                        showFloatingAvatar: { type: "boolean", description: "Enable or disable the floating AI avatar" }
                    }
                },
                generalSettings: {
                    type: "object",
                    properties: {
                        backgroundAlertsEnabled: { type: "boolean", description: "Enable or disable push notifications" }
                    }
                }
            },
            required: ["settings"]
        }
    }
};

const startFocusModeTool = {
    type: "function",
    function: {
        name: "startFocusMode",
        description: "Start a focus session (Pomodoro) for a specified number of minutes. This will block notifications and reduce distractions.",
        parameters: {
            type: "object",
            properties: {
                minutes: { type: "number", description: "Duration of the focus session in minutes (e.g., 25)" }
            },
            required: ["minutes"]
        }
    }
};

const stopFocusModeTool = {
    type: "function",
    function: {
        name: "stopFocusMode",
        description: "Stop the current focus session early.",
        parameters: {
            type: "object",
            properties: {}
        }
    }
};

const startLectureRecordingTool = {
    type: "function",
    function: {
        name: "startLectureRecording",
        description: "Start recording a lecture. Use this when the user asks to start recording.",
        parameters: {
            type: "object",
            properties: {}
        }
    }
};

const stopLectureRecordingTool = {
    type: "function",
    function: {
        name: "stopLectureRecording",
        description: "Stop the current lecture recording. Use this when the user asks to stop recording.",
        parameters: {
            type: "object",
            properties: {}
        }
    }
};

export class AIAssistantService {
    private groq: Groq;
    private modelName = "llama-3.3-70b-versatile";

    constructor() {
        const apiKey = process.env.GROQ_API_KEY || "missing_key";
        if (apiKey === "missing_key") {
            console.error("AI Service Error: Missing GROQ_API_KEY in environment variables.");
        } else {
            console.log("AI Service: Initializing with Groq key ending in ...", apiKey.slice(-4));
        }
        this.groq = new Groq({ apiKey: apiKey, dangerouslyAllowBrowser: true });
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
            ${isPro ? "5. Plan/Timetable: If user asks for a study plan, workout schedule, or 'plan my day', use 'suggestTimetable'. Before creating the timetable, ask follow-up questions if needed (e.g., preferred study hours, days available, break preferences, difficulty of subjects)." : "5. Plan/Timetable: If the user asks to generate a timetable or study plan, you MUST decline and say exactly: 'This feature is available for Pro users. Upgrade to access AI timetable generation.'"}
            6. Lecture Notes: If the user asks about a saved lecture, use 'getLectureNotes' to retrieve the transcript and notes.
            7. Delete Tasks: If the user asks to delete, remove, or clear tasks, use the 'deleteTasks' tool. ALWAYS ask for confirmation before deleting multiple tasks or if the request is ambiguous.
            8. Move/Reschedule Tasks: If the user asks to move, reschedule, or shift tasks, use the 'updateTasks' tool. Check for time conflicts and suggest an alternative time if there is an overlap.
            9. Missed Tasks: If the user missed a task, suggest rescheduling it to their next free time today or the next available day. Use 'updateTasks' to reschedule.
            10. Navigate App: If the user asks to go to a specific page or feature (e.g., "go to exam mode", "open flashcards", "show my tasks", "open notifications", "go to calendar", "my profile"), use 'navigateApp'.
            11. Update Settings: If the user asks to change their theme (e.g. "dark blue theme", "purple theme", "light mode"), use 'updateUserSettings'. For specific unlisted colors, set theme to 'custom' and provide the HEX code in 'customThemeColor'. ALWAYS ask for confirmation before changing sensitive settings, but for themes, apply them instantly!
            12. Lecture Recording: If the user asks to start or stop recording a lecture, use 'startLectureRecording' or 'stopLectureRecording'.
            13. Study Predictor & Exams: If the user asks "What should I study today?", "Prepare me for next week's exams", "What am I weak at?", use 'analyzeStudyPredictor'.
            14. Focus Mode: If the user asks to start a focus session, study session, or pomodoro timer (e.g., "Start a 25-minute focus session"), use 'startFocusMode'. If they want to stop, use 'stopFocusMode'.
            15. Multi-Step Execution: You can execute multiple tools and commands at once if the user asks for a complex workflow. For example, "Enable focus mode, switch to dark theme, and open my timetable" -> You must invoke 'startFocusMode', 'updateUserSettings', and 'navigateApp' all at once.
            16. File & Data Intelligence: You will receive text content representing uploaded notes, PDFs, or images if the user attaches them. Deeply analyze the information to extract Dates, Subjects, Deadlines, Locations, and Time blocks. Use this data to accurately answer questions or actively generate tasks and study plans.
            17. Strict Confirmation Control: For sensitive or bulk actions (deleting tasks, bulk modifications), you MUST first ask the user for confirmation and WAIT for their reply BEFORE invoking the tool. DO NOT invoke the tool natively in the same turn you ask for confirmation. EXCEPTION: Theme changes and navigating the app are safe and MUST BE EXECUTED INSTANTLY without confirmation.
            
            OUTPUT FORMAT:
            You must return your conversational response as a JSON object (unless you are ONLY calling a tool). 
            Example structure:
            {
              "text": "Your conversational response here",
              "emotion": "happy | neutral | excited | thinking | serious",
              "animation": "idle | talking | explaining | greeting | alert",
              "popup": false,
              "priority": "low | medium | high",
              "suggestedAnswers": ["Option 1"]
            }

            SPEECH & TEXT FORMATTING RULES:
            - Write 'text' as if it will be spoken by a voice assistant.
            - Do NOT include raw URLs, raw JSON, technical file paths, or excessive markdown symbols.
            - If you must share a link or code, write a conversational summary in "text".
            - Use natural human-like phrasing. Avoid overly technical robotic jargon.
            - Keep responses concise when possible.
            - Speak numbers naturally (e.g., "$10" as "ten dollars" logic is handled, but try to use words if better suited).

            TOOL CALLING:
            If you need to perform an action (e.g. navigateApp, updateTasks), just invoke the tool natively using your function calling capabilities. DO NOT output manual HTML/XML/function tags like <function=navigateApp>. Just call the function directly! If you call a function, the API will handle it.
            
            BEHAVIOR:
            - For normal replies -> popup = false
            - For important info -> popup = true
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

        let toolsList = [webSearchTool, getLectureNotesTool, analyzeStudyPredictorTool] as any[];
        
        if (aiControlEnabled) {
            toolsList.push(createTaskTool, phoneActionTool, scheduleReminderTool, deleteTasksTool, updateTasksTool, navigateAppTool, updateUserSettingsTool, startLectureRecordingTool, stopLectureRecordingTool, startFocusModeTool, stopFocusModeTool);
        }

        if (isPro && aiControlEnabled) {
            toolsList.push(suggestTimetableTool);
        }

        try {
            console.log("AI Service: Sending request to model", this.modelName);
            
            const convertedHistory = history.map(h => ({
                role: h.role === "model" ? "assistant" : "user",
                content: h.parts.map(p => p.text).join(" ")
            })) as any[];

            const response = await this.groq.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: "system", content: systemInstruction },
                    ...convertedHistory,
                    { role: "user", content: userMessage }
                ],
                tools: toolsList,
                tool_choice: "auto"
            });

            console.log("AI Service: Received response successfully.");
            
            const choice = response.choices[0].message;
            
            // Map Groq response to match Gemini's structure expected by AIContext
            const mappedResponse = {
                text: choice.content || "",
                functionCalls: choice.tool_calls ? choice.tool_calls.map(tc => ({
                    name: tc.function.name,
                    args: JSON.parse(tc.function.arguments)
                })) : undefined
            };

            return mappedResponse;
        } catch (error: any) {
            console.error("AI Generation Error (Backend Connection Failed):", error);
            
            // Auto-recover from Groq tool parsing errors
            let rawError = error?.error?.error || error?.error || error;
            
            // Sometimes it's a string inside error.message
            if (!rawError?.failed_generation && error?.message && error.message.includes('failed_generation')) {
                try {
                    const match = error.message.match(/400\s+(\{.*\})/);
                    if (match && match[1]) {
                        rawError = JSON.parse(match[1]).error || JSON.parse(match[1]);
                    }
                } catch(e){}
            }

            if (rawError?.failed_generation && rawError?.code === "tool_use_failed") {
                const failedGen = rawError.failed_generation as string;
                console.log("Attempting to recover from failed_generation:", failedGen);
                
                // Try to extract the text vs the tool call
                // Example: {"text": "Navigating..."} <function=navigateApp{"page": "home"}</function>
                let textContent = "";
                if (failedGen.includes("{") && failedGen.indexOf("<function") > 0) {
                    const jsonPart = failedGen.substring(0, failedGen.indexOf("<function")).trim();
                    try {
                         // Verify it's valid JSON
                         JSON.parse(jsonPart);
                         textContent = jsonPart;
                    } catch(e) {}
                }

                // Extensible regex to capture <function=NAME{JSON}</function> or similar outputs
                const looseRegex = /<function=([^>\[\{\s]+)\s*([\[\{].*?[\]\}])\s*(?:<\/function>|>|$)/is;
                const match = failedGen.match(looseRegex);
                if (match && match[1] && match[2]) {
                    const funcName = match[1].replace(/["']/g, '').trim(); // Remove rogue brackets or quotes
                    try {
                        let funcArgs = JSON.parse(match[2]);
                        if (Array.isArray(funcArgs) && funcArgs.length > 0) {
                            funcArgs = funcArgs[0];
                        }
                        console.log("Recovered tool call:", funcName, funcArgs);
                        return {
                            text: textContent,
                            functionCalls: [{
                                name: funcName,
                                args: funcArgs
                            }]
                        };
                    } catch (parseErr) {
                        console.error("Could not parse JSON in failed_generation", parseErr);
                    }
                }
                
                // Also handle cases where there are spaces, e.g. <function=askUserPreference {"question": "..."}>
                const spaceRegex = /<function=([^\[\{\s>]+)(?:>|\s+)([\[\{].*?[\]\}])\s*(?:<\/function>|>|$)/is;
                const spaceMatch = failedGen.match(spaceRegex);
                if (spaceMatch && spaceMatch[1] && spaceMatch[2]) {
                    const funcName = spaceMatch[1].trim();
                    try {
                        let funcArgs = JSON.parse(spaceMatch[2]);
                        if (Array.isArray(funcArgs) && funcArgs.length > 0) {
                            funcArgs = funcArgs[0];
                        }
                        console.log("Recovered tool call (spaceMatch):", funcName, funcArgs);
                        return {
                            text: textContent,
                            functionCalls: [{
                                name: funcName,
                                args: funcArgs
                            }]
                        };
                    } catch (parseErr) {
                        console.error("Could not parse JSON in failed_generation spaceMatch", parseErr);
                    }
                }
            }
            
            throw error;
        }
    }

    // Specialized Method for Grounded Search
    async performGroundedSearch(query: string) {
        try {
            console.log("AI Service: Performing Grounded Search for:", query);
            const response = await this.groq.chat.completions.create({
                model: "llama3-8b-8192", // Fast model for simple search fallback
                messages: [
                    { role: "system", content: "You are a helpful assistant. Search tools are currently offline, so answer the user's question to the best of your knowledge." },
                    { role: "user", content: query }
                ],
                response_format: { type: "text" }
            });
            
            // Map to expected Gemini format
            return {
                text: response.choices[0].message.content,
                candidates: [] // No grounding metadata available from Groq natively in this shim
            };
        } catch (error) {
            console.error("AI Search Error:", error);
            throw error;
        }
    }
}