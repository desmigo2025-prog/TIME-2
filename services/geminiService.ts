import { GoogleGenAI, Type } from "@google/genai";
import { Task, TaskPriority, TaskStatus, ParsingMetaData, ValidationStatus, NoteFormat } from "../types";

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Stage 3 & 4: Time Parsing & Normalization Engine
 * Standardizes 12h/24h, dots, ranges to ISO-like HH:mm
 */
const normalizeTime = (timeStr: string): string => {
    if (!timeStr) return "09:00";
    let clean = timeStr.trim().toLowerCase().replace(/\s/g, '');
    
    // Handle ranges "09:00-10:00" -> take start time
    if (clean.includes('-')) clean = clean.split('-')[0];
    if (clean.includes('–')) clean = clean.split('–')[0]; // En-dash
    
    // Handle "8am", "8pm"
    const amPmMatch = clean.match(/(\d{1,2})([.:]\d{2})?(am|pm)/);
    if (amPmMatch) {
        let hours = parseInt(amPmMatch[1]);
        const minutes = amPmMatch[2] ? parseInt(amPmMatch[2].replace(/[.:]/, '')) : 0;
        const period = amPmMatch[3];
        
        if (period === 'pm' && hours < 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    // Handle "1400" (military no colon)
    if (/^\d{4}$/.test(clean)) {
        return `${clean.substr(0,2)}:${clean.substr(2,2)}`;
    }

    // Handle "14.00"
    if (clean.includes('.')) return clean.replace('.', ':').padStart(5, '0');
    
    // Default fallback if simple number "9" -> "09:00"
    if (/^\d{1,2}$/.test(clean)) {
        return `${clean.padStart(2, '0')}:00`;
    }

    return clean.includes(':') ? clean.padStart(5, '0') : "09:00";
};

// Learning Loop Storage (Session based)
let correctionPatterns: string[] = [];

export const learnFromCorrection = (original: string, corrected: string) => {
    correctionPatterns.push(`When you see "${original}", interpret it as "${corrected}"`);
};

export interface ParsedNews {
    title: string;
    category: 'Daily news' | 'Important updates' | 'General information';
    summary: string;
    keyPoints: string[];
    date: string;
    isImportant: boolean;
}

export const extractNewsFromLink = async (url: string): Promise<ParsedNews> => {
    try {
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error('Failed to fetch link content');
        
        const data = await response.json();
        const htmlContent = data.contents;
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // 1. Extract Metadata BEFORE removing head elements
        const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
        const titleTag = doc.querySelector('title')?.textContent;
        const extractedTitle = ogTitle || titleTag || 'Unknown Title';

        const ogDate = doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content');
        const metaDate = doc.querySelector('meta[name="pubdate"]')?.getAttribute('content');
        const timeTag = doc.querySelector('time[datetime]')?.getAttribute('datetime');
        const extractedDate = ogDate || metaDate || timeTag || 'Unknown Date';

        const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
        const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content');
        const extractedDesc = ogDesc || metaDesc || '';

        // 2. Clean up unnecessary elements to isolate main content
        const elementsToRemove = doc.querySelectorAll('script, style, nav, footer, header, iframe, img, svg, aside, noscript, .ads, .comments, .sidebar');
        elementsToRemove.forEach(el => el.remove());

        // 3. Extract Main Content
        let mainContent = '';
        // Try to find the semantic article tag first
        const article = doc.querySelector('article') || doc.querySelector('main') || doc.querySelector('[role="main"]');
        if (article) {
            mainContent = article.textContent?.replace(/\s+/g, ' ').trim() || '';
        } else {
            // Fallback to body
            mainContent = doc.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
        }
        
        const textContent = mainContent.slice(0, 12000) || extractedDesc; // Expanded context
        
        const prompt = `
Extract and summarize the following web content.
Analyze the content and classify it into one of these categories: "Daily news", "Important updates", "General information".
Identify the Main Content summary and extract Key Points (bulleted format).

For the Title and Date, try to use the provided Extracted Metadata first, but if they are missing or invalid, infer them from the Web Content. Provide the Date in a standard readable format.

[EXTRACTED METADATA]
Suggested Title: ${extractedTitle}
Suggested Date: ${extractedDate}
Suggested Description: ${extractedDesc}

[WEB CONTENT]
${textContent}

Ensure extreme accuracy. For 'isImportant', set to true ONLY IF it strongly signals an abrupt change, emergency, or critical deadline.
`;
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
        const result = await ai.models.generateContent({
             model: 'gemini-3-flash-preview',
             contents: prompt,
             config: {
                 responseMimeType: 'application/json',
                 responseSchema: {
                     type: Type.OBJECT,
                     properties: {
                         title: { type: Type.STRING },
                         category: { type: Type.STRING, enum: ['Daily news', 'Important updates', 'General information'] },
                         summary: { type: Type.STRING },
                         keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                         date: { type: Type.STRING },
                         isImportant: { type: Type.BOOLEAN }
                     },
                     required: ["title", "category", "summary", "keyPoints", "date", "isImportant"]
                 }
             }
        });
        const jsonResponse = result.text;
        if (!jsonResponse) throw new Error("No text from Gemini");
        return JSON.parse(jsonResponse);
    } catch (e) {
        console.error("Failed to extract news", e);
        throw e;
    }
};

export const extractAnnouncementsFromLink = async (url: string, preferences?: string): Promise<any[]> => {
    try {
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error('Failed to fetch link content');
        
        const data = await response.json();
        const htmlContent = data.contents;
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        const elementsToRemove = doc.querySelectorAll('script, style, nav, footer, header, iframe, img, svg, aside, noscript, .ads, .comments, .sidebar');
        elementsToRemove.forEach(el => el.remove());

        let mainContent = '';
        const article = doc.querySelector('article') || doc.querySelector('main') || doc.querySelector('[role="main"]');
        if (article) {
            mainContent = article.textContent?.replace(/\s+/g, ' ').trim() || '';
        } else {
            mainContent = doc.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
        }
        
        const textContent = mainContent.slice(0, 15000);
        
        const prompt = `
            Extract current, relevant announcements from the following web content.
            Filter the information to bring up current announcements and trash irrelevant/outdated ones.
            ${preferences ? `User Preferences for filtering: "${preferences}". Make sure to prioritize content matching these preferences.` : 'Pick the most generally useful and current information.'}
            
            [WEB CONTENT]
            ${textContent}
            
            Return a JSON array of announcements.
        `;
        
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
        const result = await ai.models.generateContent({
             model: 'gemini-3.1-pro-preview',
             contents: prompt,
             config: {
                 responseMimeType: 'application/json',
                 responseSchema: {
                     type: Type.ARRAY,
                     items: {
                         type: Type.OBJECT,
                         properties: {
                             title: { type: Type.STRING },
                             message: { type: Type.STRING },
                             type: { type: Type.STRING, enum: ['Critical', 'Announcement', 'Attention', 'Info'] },
                             isCurrent: { type: Type.BOOLEAN, description: "True if the event/news is recent or upcoming" }
                         },
                         required: ["title", "message", "type", "isCurrent"]
                     }
                 }
             }
        });
        
        const jsonResponse = result.text;
        if (!jsonResponse) throw new Error("No text from Gemini");
        const parsed = JSON.parse(jsonResponse);
        
        return parsed
            .filter((a: any) => a.isCurrent !== false)
            .map((a: any, i: number) => ({
                id: `ai-${Date.now()}-${i}`,
                title: a.title,
                message: a.message,
                type: a.type,
                timestamp: new Date().toISOString(),
                isRead: false,
                source: new URL(url).hostname
            }));
    } catch (e) {
        console.error("Failed to extract announcements", e);
        throw e;
    }
};

export const parseTimetableWithGemini = async (file: File): Promise<Partial<Task>[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const filePart = await fileToGenerativePart(file);

    /**
     * MULTI-LAYER AI SCANNING PIPELINE PROMPT
     */
    const prompt = `
      Act as an Enterprise-Grade OCR & Data Extraction AI for Timetables.
      Execute the following 6-Stage Pipeline:

      STAGE 1: PREPROCESSING & LAYOUT RECONSTRUCTION
      - Analyze the image geometry. Detect if it is a Complex Grid, List, or Columnar layout.
      - Identify the Day Headers (Mon, Tue, etc.) vs Time Headers.
      - Identify Week labels (e.g., Week 1, Week 2, A/B weeks) or Dates (e.g., 12/03/2026).
      - Handle merged cells (e.g., a "Lunch" block spanning all days).
      - Handle multi-row entries, irregular spacing, screenshots, PDFs, Excel-like layouts, and mixed formats (text + table).
      - Ignore noise text, headers, and footers.
      
      STAGE 2: CONTEXTUAL EXTRACTION
      - Extract: Course Code, Course Title, Date, Start Time, End Time, Venue.
      - Extract: weekIdentifier (week number, A/B label, or date range) if available.
      - CRITICAL: Extract the full date and convert it to standard ISO format (YYYY-MM-DD). If only the day is present, infer the date if possible or leave empty.
      - CRITICAL: Extract time ranges (e.g., 3:00 PM - 5:00 PM) and convert them into a start time (HH:mm) and calculate durationMinutes.
      - Use surrounding text to infer missing venues (e.g., "Room 304" near title).
      
      STAGE 3: INTELLIGENT GROUPING & MULTI-WEEK HANDLING
      - Associate every task with the correct Day column AND exact Date. 
      - If a task is visually between Monday and Tuesday, check alignment to decide.
      - CRITICAL: Detect multiple weeks (Week 1, Week 2, A/B). DO NOT merge same days across weeks.
      - Use (date OR weekIdentifier + day) as a unique key to separate them.
      - Ensure each Monday from different weeks is stored separately with its respective weekIdentifier or date.
      
      STAGE 4: NORMALIZATION, SPELL CHECK & ERROR CORRECTION
      - Fix typos: "Wednesdy" -> "Wednesday", "Pysics" -> "Physics".
      - Expand abbreviations: "Lec" -> "Lecture".
      - Fix misaligned rows and remove duplicate entries.
      - Validate time formats.
      
      STAGE 5: LEARNING APPLICATION
      - Apply these user-defined correction patterns from previous sessions: ${JSON.stringify(correctionPatterns)}

      STAGE 6: CONFIDENCE SCORING & OUTPUT
      - Rate confidence (0.0 - 1.0) for each field.
      - Flag "isLowConfidence" if overall score < 0.7.
      - Format: JSON Array.

      RETURN JSON SCHEMA:
      [
        {
          "title": "string (Course Code + Title)",
          "day": "Monday" | "Tuesday" | ... | "Sunday",
          "weekIdentifier": "string (optional, e.g., 'Week 1', 'A')",
          "date": "string (optional, YYYY-MM-DD)",
          "time": "HH:mm" (24-hour format start time),
          "durationMinutes": number,
          "venue": "string",
          "category": "School" | "Work" | "Personal",
          "confidenceScore": number (0-1),
          "parsingMetaData": {
             "confidence": { "title": number, "day": number, "time": number, "venue": number },
             "correctionsApplied": ["string"],
             "detectedLayout": "grid" | "list" | "columnar"
          }
        }
      ]
      
      IMPORTANT: Return ONLY valid JSON. No Markdown.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview', 
      contents: {
        parts: [filePart, { text: prompt }]
      }
    });

    const text = response.text || "[]";
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsedData: Partial<Task>[] = [];
    try {
        parsedData = JSON.parse(jsonString);
    } catch (e) {
        console.error("JSON Parse Error", e);
        throw new Error("Complex layout detected. Please try a clearer image.");
    }

    // Client-side Validation & Post-Processing
    return parsedData.map(task => {
        // Enforce Day Format
        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        let day = task.day ? task.day.charAt(0).toUpperCase() + task.day.slice(1) : "Monday";
        if (!validDays.includes(day)) {
            // Fuzzy match fallback
            day = validDays.find(d => d.startsWith(day.substr(0, 3))) || "Monday";
        }

        // Enforce Time Format
        const normalizedTime = normalizeTime(task.time || "09:00");
        const confidence = task.confidenceScore || 0.8;
        
        // Determine Initial Validation Status
        let valStatus: ValidationStatus = 'validated';
        if (confidence < 0.7 || (task.parsingMetaData?.isLowConfidence)) {
            valStatus = 'needs_review';
        }

        return {
            ...task,
            time: normalizedTime,
            day: day,
            durationMinutes: task.durationMinutes || 60,
            confidenceScore: confidence,
            validationStatus: valStatus
        };
    });

  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    throw new Error("Some data could not be fully extracted. Please review.");
  }
};

export const generateTimetableWithGemini = async (
    subjects: string,
    studyHours: number,
    breakPreferences: string,
    startTime: string,
    mode: 'daily' | 'weekly'
): Promise<Partial<Task>[]> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const currentDate = new Date();
        const currentDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDate.getDay()];
        
        // Generate dates for the current week
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(currentDate);
            d.setDate(currentDate.getDate() + i);
            weekDates.push(`${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()]} (${d.toISOString().split('T')[0]})`);
        }
        
        const prompt = `
            You are an expert study planner. Generate a highly effective ${mode} study timetable.
            
            User Preferences:
            - Subjects to cover: ${subjects}
            - Total study hours per day: ${studyHours}
            - Break preferences: ${breakPreferences}
            - Preferred start time: ${startTime}
            
            Current Day: ${currentDay} (${currentDate.toISOString().split('T')[0]})
            Upcoming 7 Days: ${weekDates.join(', ')}
            
            Rules:
            1. Create a realistic schedule that balances the subjects.
            2. Include breaks as separate tasks (e.g., "Break: 15 mins").
            3. If mode is 'daily', generate tasks ONLY for ${currentDay}.
            4. If mode is 'weekly', distribute the subjects across the upcoming 7 days, maintaining ${studyHours} hours per day.
            5. Ensure times do not overlap.
            6. Time must be in 24-hour HH:mm format.
            7. Duration must be in minutes.
            8. Include the exact date in YYYY-MM-DD format for each task.
            
            Return a JSON array of tasks.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING, description: "Subject or Break title" },
                            day: { type: Type.STRING, description: "Monday to Sunday" },
                            date: { type: Type.STRING, description: "YYYY-MM-DD format" },
                            time: { type: Type.STRING, description: "HH:mm format" },
                            durationMinutes: { type: Type.NUMBER, description: "Duration in minutes" },
                            venue: { type: Type.STRING, description: "Location, e.g., Library, Home" }
                        },
                        required: ["title", "day", "date", "time", "durationMinutes"]
                    }
                }
            }
        });

        const jsonStr = response.text.trim();
        const parsedData = JSON.parse(jsonStr);

        return parsedData.map((task: any) => ({
            ...task,
            time: normalizeTime(task.time),
            venue: task.venue || "Home",
            confidenceScore: 0.95,
            validationStatus: 'validated'
        }));

    } catch (error) {
        console.error("Gemini Generation Error:", error);
        throw new Error("Failed to generate timetable. Please try again.");
    }
};

export const getSmartSuggestions = async (tasks: Task[], progress?: number): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        let prompt = `Based on these tasks: ${JSON.stringify(tasks.map(t => t.title))}, give a 1 sentence productivity tip.`;
        if (progress !== undefined) {
             if (progress === 100) {
                 prompt = "The user has completed 100% of their tasks today! Give them a short, 1-sentence enthusiastic congratulation.";
             } else if (progress > 50) {
                 prompt = `The user has completed ${progress}% of their tasks today. Based on their remaining tasks: ${JSON.stringify(tasks.map(t => t.title))}, give a 1 sentence motivating tip to keep going string.`;
             } else {
                 prompt = `The user has only completed ${progress}% of their tasks today. Based on their upcoming tasks: ${JSON.stringify(tasks.map(t => t.title))}, give a 1 sentence encouraging tip to focus and finish strong.`;
             }
        }
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash',
            contents: prompt
        });
        return response.text || "Stay focused!";
    } catch (e) {
        return "Conquer your day!";
    }
}

export const analyzeStudyPredictor = async (
    tasks: Task[],
    exams: any[]
): Promise<{ suggestion: string, weakArea: string, prioritySubjects: string[] }> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const completedTasks = tasks.filter(t => t.status === 'Completed').map(t => t.title);
        const missedTasks = tasks.filter(t => t.status === 'Missed').map(t => t.title);
        
        const prompt = `
            You are an AI Study Predictor named Tai.
            Analyze the student's study history and upcoming exams.
            
            Completed Study Sessions: ${JSON.stringify(completedTasks)}
            Missed Study Sessions: ${JSON.stringify(missedTasks)}
            Upcoming Exams: ${JSON.stringify(exams)}
            
            Identify:
            1. What they should study today (suggestion).
            2. Their weak area based on missed sessions or lack of study (weakArea).
            3. A list of up to 3 priority subjects.
            
            Return JSON:
            {
                "suggestion": "You should study [Subject] today because...",
                "weakArea": "You are weak in [Subject] based on...",
                "prioritySubjects": ["Subject 1", "Subject 2"]
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestion: { type: Type.STRING },
                        weakArea: { type: Type.STRING },
                        prioritySubjects: { 
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["suggestion", "weakArea", "prioritySubjects"]
                }
            }
        });

        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Predictor Error:", e);
        return {
            suggestion: "You should review your upcoming exam subjects today.",
            weakArea: "We need more data to determine your weak areas.",
            prioritySubjects: []
        };
    }
};

/**
 * PARSE VOICE COMMAND FOR TASK CREATION
 * Transforms "Meet John tomorrow at 5pm at Starbucks" -> Structured JSON
 */
export const parseVoiceTask = async (transcript: string): Promise<Partial<Task>> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `
                Extract task details from this voice command: "${transcript}".
                Current Date: ${new Date().toISOString()} (Use this to calculate relative dates like "tomorrow").
                
                Return JSON schema:
                {
                    "title": "string",
                    "day": "Monday"..."Sunday",
                    "time": "HH:mm" (24h format),
                    "venue": "string",
                    "durationMinutes": number (default 60 if not specified)
                }
                If data is missing, make a best guess or leave empty.
            `,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        day: { type: Type.STRING },
                        time: { type: Type.STRING },
                        venue: { type: Type.STRING },
                        durationMinutes: { type: Type.NUMBER }
                    }
                }
            }
        });

        const jsonStr = response.text.trim();
        const data = JSON.parse(jsonStr);

        // Normalize
        data.time = normalizeTime(data.time);
        
        return data;
    } catch (e) {
        console.error("Voice Parse Error", e);
        return { title: transcript }; // Fallback
    }
};

export const generateLectureNotes = async (
    audioBase64: string, 
    mimeType: string, 
    format: NoteFormat,
    removeFillerWords: boolean = true
): Promise<{ rawTranscript: string, cleanTranscript: string, notes: string }> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
        
        let prompt = `
            You are an expert academic assistant and transcriptionist.
            I will provide an audio recording of a lecture.
            
            ========================================
            1. STRICT TRANSCRIPTION MODE (rawTranscript)
            ========================================
            Transcribe the audio EXACTLY word-for-word.
            - You are a highly accurate, literal transcriber. Do not summarize, paraphrase, or skip any words.
            - Capture every single spoken word exactly as it sounds.
            - Include all repetitions, false starts, pauses (use "..."), and filler words (um, uh, you know).
            - DO NOT rephrase sentences, add missing words, predict unclear speech, or auto-correct meaning.
            - Your sole goal for rawTranscript is 100% verbatim accuracy.
            
            ========================================
            2. NO AI HALLUCINATION RULE
            ========================================
            - If audio is unclear, insert "[inaudible]" or "[unclear]".
            - NEVER guess missing words.
            - NEVER fabricate sentences.
            
            ========================================
            3. AUDIO-ONLY SOURCE RULE
            ========================================
            - Transcription must come ONLY from the recorded audio.
            - Do NOT use prior knowledge, context guessing, or AI completion.
            
            ========================================
            4. CLEAN MODE (cleanTranscript)
            ========================================
            Create a "cleanTranscript" based on the raw transcript.
            ${removeFillerWords ? '- Remove filler words (um, uh, like, you know).' : '- Keep filler words.'}
            - Correct grammar and spelling, and improve readability while preserving the exact meaning.
            
            ========================================
            5. NOTES GENERATION
            ========================================
            Generate notes based on the transcript in the requested format: ${format.toUpperCase()}.
            
            FORMAT DEFINITIONS:
            - RAW_TRANSCRIPT: Just return the raw transcript again.
            - CLEAN_TRANSCRIPT: Just return the clean transcript again.
            - FULL: Well-structured, detailed explanations, organized into sections.
            - SUMMARY: Short and concise, key ideas only.
            - KEY_POINTS: Bullet points of important concepts only.
            - KEYWORDS: Important terms useful for revision.
            
            Return the result as a JSON object with three fields:
            1. "rawTranscript": The verbatim transcript following the STRICT TRANSCRIPTION MODE rules.
            2. "cleanTranscript": The cleaned transcript.
            3. "notes": The generated content in the requested format (use markdown for formatting).
            
            IMPORTANT: Do not hallucinate or add information not present in the recording. Ensure output is accurate, clear, and well-structured.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: audioBase64,
                            mimeType: mimeType
                        }
                    },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        rawTranscript: { type: Type.STRING },
                        cleanTranscript: { type: Type.STRING },
                        notes: { type: Type.STRING }
                    },
                    required: ["rawTranscript", "cleanTranscript", "notes"]
                }
            }
        });

        const jsonStr = response.text?.trim() || "{}";
        const data = JSON.parse(jsonStr);
        
        return {
            rawTranscript: data.rawTranscript || "Raw transcript could not be generated.",
            cleanTranscript: data.cleanTranscript || "Clean transcript could not be generated.",
            notes: data.notes || "Notes could not be generated."
        };
    } catch (error) {
        console.error("Lecture Notes Generation Error:", error);
        throw new Error("Could not generate notes. Try again.");
    }
};

export const generateStudyMaterials = async (
    sourceText: string,
    materialType: 'flashcards' | 'multiple_choice' | 'short_answer',
    count: number = 10
): Promise<any[]> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
        
        let schemaProperties: any = {};
        let requiredFields: string[] = [];

        if (materialType === 'flashcards' || materialType === 'short_answer') {
            schemaProperties = {
                question: { type: Type.STRING },
                answer: { type: Type.STRING }
            };
            requiredFields = ["question", "answer"];
        } else if (materialType === 'multiple_choice') {
            schemaProperties = {
                question: { type: Type.STRING },
                options: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING } 
                },
                correctAnswer: { type: Type.STRING }
            };
            requiredFields = ["question", "options", "correctAnswer"];
        }

        const prompt = `
            You are an expert educational content creator and data extractor.
            Based on the following source material, generate or extract ${count} ${materialType.replace('_', ' ')}.
            
            Source Material:
            """
            ${sourceText}
            """
            
            Rules:
            1. SMART DETECTION: Analyze if the source material is already a quiz, exam, or test.
               - If it IS a quiz: Extract the existing questions, options (A, B, C, D), and correct answers (if available). Handle numbered questions, bullet lists, and paragraph questions. Extract up to ${count} items.
               - If it is NOT a quiz (just notes/text): Generate exactly ${count} new items based ONLY on the provided source material. Do not hallucinate external facts.
            2. Ensure questions are clear and educational.
            ${materialType === 'multiple_choice' ? '3. Provide 4 options for each question, and specify the exact string of the correct answer. If extracting an existing quiz that lacks answers, try to infer the correct answer from the context or leave it blank if impossible.' : ''}
            
            Return a JSON array of objects.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: schemaProperties,
                        required: requiredFields
                    }
                }
            }
        });

        const jsonStr = response.text?.trim() || "[]";
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Study Materials Generation Error:", error);
        throw new Error("Failed to generate study materials. Please try again.");
    }
};

export const generateExamScheduleWithGemini = async (
    examDate: string,
    subjects: string[],
    difficultSubjects: string[],
    studyHoursPerDay: number
): Promise<{ tasks: Partial<Task>[], prioritySubjects: string[], dailyFocus: string }> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const currentDate = new Date();
        
        const prompt = `
            You are an expert exam preparation AI. Generate an optimized study schedule leading up to an exam.
            
            Exam Details:
            - Exam Date: ${examDate}
            - Current Date: ${currentDate.toISOString().split('T')[0]}
            - Subjects to cover: ${subjects.join(', ')}
            - Difficult Subjects (need more time): ${difficultSubjects.join(', ')}
            - Total study hours per day: ${studyHoursPerDay}
            
            Rules:
            1. Allocate significantly more time to the difficult subjects.
            2. Include short breaks between study sessions.
            3. Generate a realistic daily schedule from tomorrow until the day before the exam.
            4. Do not exceed ${studyHoursPerDay} hours per day of actual study time.
            5. Time must be in 24-hour HH:mm format.
            6. Duration must be in minutes.
            7. Include the exact date in YYYY-MM-DD format for each task.
            8. Also provide a brief "dailyFocus" summary (e.g., "Focus heavily on Physics and Math concepts") and a list of "prioritySubjects".
            
            Return a JSON object with:
            - tasks: Array of study tasks
            - prioritySubjects: Array of strings
            - dailyFocus: A short string summarizing the strategy
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        tasks: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING, description: "Subject or Break title" },
                                    day: { type: Type.STRING, description: "Monday to Sunday" },
                                    date: { type: Type.STRING, description: "YYYY-MM-DD format" },
                                    time: { type: Type.STRING, description: "HH:mm format" },
                                    durationMinutes: { type: Type.NUMBER, description: "Duration in minutes" },
                                    venue: { type: Type.STRING, description: "Location, e.g., Library, Home" }
                                },
                                required: ["title", "day", "date", "time", "durationMinutes"]
                            }
                        },
                        prioritySubjects: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        dailyFocus: { type: Type.STRING }
                    },
                    required: ["tasks", "prioritySubjects", "dailyFocus"]
                }
            }
        });

        const jsonStr = response.text.trim();
        const parsedData = JSON.parse(jsonStr);

        const tasks = parsedData.tasks.map((task: any) => ({
            ...task,
            time: normalizeTime(task.time),
            venue: task.venue || "Home",
            confidenceScore: 0.95,
            validationStatus: 'validated',
            category: 'School'
        }));

        return {
            tasks,
            prioritySubjects: parsedData.prioritySubjects,
            dailyFocus: parsedData.dailyFocus
        };

    } catch (error) {
        console.error("Gemini Exam Generation Error:", error);
        throw new Error("Failed to generate exam schedule. Please try again.");
    }
};