import * as XLSX from 'xlsx';
import { Task } from '../types';

// Helper to parse time strings like "09:00 - 11:00", "9:00 AM", "14:00", etc.
const parseTimeAndDuration = (timeStr: string): { time: string, durationMinutes: number } => {
    let time = '09:00';
    let durationMinutes = 60;
    
    if (!timeStr) return { time, durationMinutes };
    
    // Clean up string
    const cleanStr = timeStr.toLowerCase().replace(/\s+/g, '');
    
    // Check for range like 09:00-11:00 or 9am-11am
    const rangeMatch = cleanStr.match(/(\d{1,2}(?::\d{2})?[ap]m?)-(\d{1,2}(?::\d{2})?[ap]m?)/);
    
    const parseSingleTime = (t: string): { hours: number, minutes: number } => {
        let hours = 0;
        let minutes = 0;
        const isPM = t.includes('pm');
        const isAM = t.includes('am');
        const numStr = t.replace(/[a-z]/g, '');
        
        if (numStr.includes(':')) {
            const parts = numStr.split(':');
            hours = parseInt(parts[0], 10);
            minutes = parseInt(parts[1], 10);
        } else {
            hours = parseInt(numStr, 10);
        }
        
        if (isPM && hours < 12) hours += 12;
        if (isAM && hours === 12) hours = 0;
        
        return { hours, minutes };
    };
    
    if (rangeMatch) {
        const start = parseSingleTime(rangeMatch[1]);
        const end = parseSingleTime(rangeMatch[2]);
        
        time = `${start.hours.toString().padStart(2, '0')}:${start.minutes.toString().padStart(2, '0')}`;
        
        let endHours = end.hours;
        // Handle cases like 9:00-1:00 (assuming 1:00 is PM)
        if (endHours < start.hours && !rangeMatch[2].includes('am') && !rangeMatch[2].includes('pm')) {
            endHours += 12;
        }
        
        durationMinutes = (endHours * 60 + end.minutes) - (start.hours * 60 + start.minutes);
        if (durationMinutes <= 0) durationMinutes = 60; // fallback
    } else {
        // Single time
        const match = cleanStr.match(/(\d{1,2})(?::(\d{2}))?([ap]m)?/);
        if (match) {
            const parsed = parseSingleTime(match[0]);
            time = `${parsed.hours.toString().padStart(2, '0')}:${parsed.minutes.toString().padStart(2, '0')}`;
        }
    }
    
    return { time, durationMinutes };
};

export const parseExcelTimetable = async (file: File): Promise<Partial<Task>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Read as 2D array with raw: false to get formatted strings (especially for times/dates)
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
        const tasks: Partial<Task>[] = [];
        
        if (rows.length === 0) return resolve([]);

        console.log("Parsed Excel Rows:", rows);

        let isGrid = false;
        const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        // Check if it's a grid format
        let daysRowIndex = -1;
        let daysColIndex = -1;
        
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
            const row = rows[i];
            const rowStr = row.map(c => String(c).toLowerCase()).join(' ');
            const foundDays = daysOfWeek.filter(d => rowStr.includes(d));
            if (foundDays.length >= 3) {
                daysRowIndex = i;
                isGrid = true;
                break;
            }
        }
        
        if (!isGrid) {
            let foundDays = 0;
            for (let i = 0; i < rows.length; i++) {
                const cell = String(rows[i][0]).toLowerCase();
                if (daysOfWeek.some(d => cell.includes(d))) {
                    foundDays++;
                }
            }
            if (foundDays >= 3) {
                daysColIndex = 0;
                isGrid = true;
            }
        }

        if (isGrid) {
            if (daysRowIndex !== -1) {
                const daysRow = rows[daysRowIndex].map(c => String(c).toLowerCase());
                let timeColIndex = -1;
                
                for (let j = 0; j < daysRow.length; j++) {
                    if (daysRow[j].includes('time') || daysRow[j].includes('hour')) {
                        timeColIndex = j;
                        break;
                    }
                }
                
                if (timeColIndex === -1) {
                    for (let i = daysRowIndex + 1; i < rows.length; i++) {
                        for (let j = 0; j < rows[i].length; j++) {
                            if (String(rows[i][j]).match(/\d{1,2}:\d{2}/)) {
                                timeColIndex = j;
                                break;
                            }
                        }
                        if (timeColIndex !== -1) break;
                    }
                }
                
                if (timeColIndex === -1) timeColIndex = 0;
                
                for (let i = daysRowIndex + 1; i < rows.length; i++) {
                    const row = rows[i];
                    const timeStr = String(row[timeColIndex] || '').trim();
                    if (!timeStr) continue;
                    
                    for (let j = 0; j < row.length; j++) {
                        if (j === timeColIndex) continue;
                        
                        const dayStr = daysRow[j];
                        const matchedDay = daysOfWeek.find(d => dayStr.includes(d));
                        
                        if (matchedDay && row[j]) {
                            let title = String(row[j]).trim();
                            if (!title || title === '-') continue;
                            
                            let venue = '';
                            const venueMatch = title.match(/\((.*?)\)/);
                            if (venueMatch) {
                                venue = venueMatch[1];
                                title = title.replace(/\(.*?\)/, '').trim();
                            }
                            
                            const { time, durationMinutes } = parseTimeAndDuration(timeStr);
                            
                            tasks.push({
                                title,
                                day: matchedDay.charAt(0).toUpperCase() + matchedDay.slice(1),
                                time,
                                venue,
                                category: 'School',
                                durationMinutes,
                                confidenceScore: 1.0,
                                validationStatus: 'validated'
                            });
                        }
                    }
                }
            } else if (daysColIndex !== -1) {
                const timesRow = rows[0].map(c => String(c).toLowerCase());
                
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const dayStr = String(row[daysColIndex] || '').toLowerCase();
                    const matchedDay = daysOfWeek.find(d => dayStr.includes(d));
                    
                    if (matchedDay) {
                        for (let j = 0; j < row.length; j++) {
                            if (j === daysColIndex) continue;
                            
                            const timeStr = timesRow[j];
                            if (!timeStr || !timeStr.match(/\d/)) continue;
                            
                            let title = String(row[j]).trim();
                            if (!title || title === '-') continue;
                            
                            let venue = '';
                            const venueMatch = title.match(/\((.*?)\)/);
                            if (venueMatch) {
                                venue = venueMatch[1];
                                title = title.replace(/\(.*?\)/, '').trim();
                            }
                            
                            const { time, durationMinutes } = parseTimeAndDuration(timeStr);
                            
                            tasks.push({
                                title,
                                day: matchedDay.charAt(0).toUpperCase() + matchedDay.slice(1),
                                time,
                                venue,
                                category: 'School',
                                durationMinutes,
                                confidenceScore: 1.0,
                                validationStatus: 'validated'
                            });
                        }
                    }
                }
            }
        } else {
            let headerRowIndex = -1;
            for (let i = 0; i < Math.min(rows.length, 10); i++) {
                const row = rows[i].map(c => String(c).toLowerCase());
                if (row.some(c => c.includes('title') || c.includes('subject') || c.includes('activity') || c.includes('course')) &&
                    row.some(c => c.includes('day') || c.includes('date')) &&
                    row.some(c => c.includes('time') || c.includes('start'))) {
                    headerRowIndex = i;
                    break;
                }
            }
            
            if (headerRowIndex !== -1) {
                const headers = rows[headerRowIndex].map(c => String(c).toLowerCase());
                
                const titleIdx = headers.findIndex(h => h.includes('title') || h.includes('subject') || h.includes('activity') || h.includes('course'));
                const dayIdx = headers.findIndex(h => h.includes('day') || h.includes('date'));
                const timeIdx = headers.findIndex(h => h.includes('time') || h.includes('start'));
                const durationIdx = headers.findIndex(h => h.includes('duration') || h.includes('length'));
                const venueIdx = headers.findIndex(h => h.includes('venue') || h.includes('room') || h.includes('location'));
                
                for (let i = headerRowIndex + 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;
                    
                    const title = titleIdx !== -1 ? String(row[titleIdx] || '').trim() : '';
                    const dayRaw = dayIdx !== -1 ? String(row[dayIdx] || '').trim().toLowerCase() : '';
                    const time = timeIdx !== -1 ? String(row[timeIdx] || '').trim() : '';
                    const durationStr = durationIdx !== -1 ? String(row[durationIdx] || '').trim() : '';
                    const venue = venueIdx !== -1 ? String(row[venueIdx] || '').trim() : '';
                    
                    if (title && dayRaw && time) {
                        const matchedDay = daysOfWeek.find(d => dayRaw.includes(d)) || dayRaw;
                        const formattedDay = matchedDay.charAt(0).toUpperCase() + matchedDay.slice(1);
                        
                        let durationMinutes = 60;
                        let parsedTime = time;
                        
                        if (durationStr) {
                            const match = durationStr.match(/(\d+)/);
                            if (match) durationMinutes = parseInt(match[1], 10);
                            const parsed = parseTimeAndDuration(time);
                            parsedTime = parsed.time;
                        } else {
                            const parsed = parseTimeAndDuration(time);
                            parsedTime = parsed.time;
                            durationMinutes = parsed.durationMinutes;
                        }
                        
                        tasks.push({
                            title,
                            day: formattedDay,
                            time: parsedTime,
                            venue,
                            durationMinutes,
                            category: 'School',
                            confidenceScore: 1.0,
                            validationStatus: 'validated'
                        });
                    }
                }
            } else {
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length < 2) continue;
                    
                    let title = '';
                    let dayRaw = '';
                    let time = '';
                    let venue = '';
                    
                    for (let j = 0; j < row.length; j++) {
                        const cell = String(row[j] || '').trim();
                        if (!cell) continue;
                        
                        const lowerCell = cell.toLowerCase();
                        if (daysOfWeek.some(d => lowerCell === d)) {
                            dayRaw = cell;
                        } else if (cell.match(/\d{1,2}:\d{2}/)) {
                            time = cell;
                        } else if (lowerCell.includes('room') || lowerCell.includes('hall') || lowerCell.includes('lab')) {
                            venue = cell;
                        } else if (!title) {
                            title = cell;
                        } else if (!venue) {
                            venue = cell;
                        }
                    }
                    
                    if (title && dayRaw && time) {
                        const matchedDay = daysOfWeek.find(d => dayRaw.toLowerCase().includes(d)) || dayRaw;
                        const formattedDay = matchedDay.charAt(0).toUpperCase() + matchedDay.slice(1);
                        
                        const { time: parsedTime, durationMinutes } = parseTimeAndDuration(time);
                        
                        tasks.push({
                            title,
                            day: formattedDay,
                            time: parsedTime,
                            venue,
                            durationMinutes,
                            category: 'School',
                            confidenceScore: 1.0,
                            validationStatus: 'validated'
                        });
                    }
                }
            }
        }
        
        console.log("Extracted Tasks:", tasks);
        resolve(tasks);
      } catch (error) {
        console.error("Excel Parsing Error:", error);
        reject(new Error("Failed to parse Excel file. Please ensure it's a valid timetable format."));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

export const parseCSVTimetable = async (file: File): Promise<Partial<Task>[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const workbook = XLSX.read(text, { type: 'string' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Read as 2D array with raw: false
                const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
                const tasks: Partial<Task>[] = [];
                
                if (rows.length === 0) return resolve([]);

                console.log("Parsed CSV Rows:", rows);

                let isGrid = false;
                const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                
                // Check if it's a grid format
                let daysRowIndex = -1;
                let daysColIndex = -1;
                
                for (let i = 0; i < Math.min(rows.length, 10); i++) {
                    const row = rows[i];
                    const rowStr = row.map(c => String(c).toLowerCase()).join(' ');
                    const foundDays = daysOfWeek.filter(d => rowStr.includes(d));
                    if (foundDays.length >= 3) {
                        daysRowIndex = i;
                        isGrid = true;
                        break;
                    }
                }
                
                if (!isGrid) {
                    let foundDays = 0;
                    for (let i = 0; i < rows.length; i++) {
                        const cell = String(rows[i][0]).toLowerCase();
                        if (daysOfWeek.some(d => cell.includes(d))) {
                            foundDays++;
                        }
                    }
                    if (foundDays >= 3) {
                        daysColIndex = 0;
                        isGrid = true;
                    }
                }

                if (isGrid) {
                    if (daysRowIndex !== -1) {
                        const daysRow = rows[daysRowIndex].map(c => String(c).toLowerCase());
                        let timeColIndex = -1;
                        
                        for (let j = 0; j < daysRow.length; j++) {
                            if (daysRow[j].includes('time') || daysRow[j].includes('hour')) {
                                timeColIndex = j;
                                break;
                            }
                        }
                        
                        if (timeColIndex === -1) {
                            for (let i = daysRowIndex + 1; i < rows.length; i++) {
                                for (let j = 0; j < rows[i].length; j++) {
                                    if (String(rows[i][j]).match(/\d{1,2}:\d{2}/)) {
                                        timeColIndex = j;
                                        break;
                                    }
                                }
                                if (timeColIndex !== -1) break;
                            }
                        }
                        
                        if (timeColIndex === -1) timeColIndex = 0;
                        
                        for (let i = daysRowIndex + 1; i < rows.length; i++) {
                            const row = rows[i];
                            const timeStr = String(row[timeColIndex] || '').trim();
                            if (!timeStr) continue;
                            
                            for (let j = 0; j < row.length; j++) {
                                if (j === timeColIndex) continue;
                                
                                const dayStr = daysRow[j];
                                const matchedDay = daysOfWeek.find(d => dayStr.includes(d));
                                
                                if (matchedDay && row[j]) {
                                    let title = String(row[j]).trim();
                                    if (!title || title === '-') continue;
                                    
                                    let venue = '';
                                    const venueMatch = title.match(/\((.*?)\)/);
                                    if (venueMatch) {
                                        venue = venueMatch[1];
                                        title = title.replace(/\(.*?\)/, '').trim();
                                    }
                                    
                                    const { time, durationMinutes } = parseTimeAndDuration(timeStr);
                                    
                                    tasks.push({
                                        title,
                                        day: matchedDay.charAt(0).toUpperCase() + matchedDay.slice(1),
                                        time,
                                        venue,
                                        category: 'School',
                                        durationMinutes,
                                        confidenceScore: 1.0,
                                        validationStatus: 'validated'
                                    });
                                }
                            }
                        }
                    } else if (daysColIndex !== -1) {
                        const timesRow = rows[0].map(c => String(c).toLowerCase());
                        
                        for (let i = 1; i < rows.length; i++) {
                            const row = rows[i];
                            const dayStr = String(row[daysColIndex] || '').toLowerCase();
                            const matchedDay = daysOfWeek.find(d => dayStr.includes(d));
                            
                            if (matchedDay) {
                                for (let j = 0; j < row.length; j++) {
                                    if (j === daysColIndex) continue;
                                    
                                    const timeStr = timesRow[j];
                                    if (!timeStr || !timeStr.match(/\d/)) continue;
                                    
                                    let title = String(row[j]).trim();
                                    if (!title || title === '-') continue;
                                    
                                    let venue = '';
                                    const venueMatch = title.match(/\((.*?)\)/);
                                    if (venueMatch) {
                                        venue = venueMatch[1];
                                        title = title.replace(/\(.*?\)/, '').trim();
                                    }
                                    
                                    const { time, durationMinutes } = parseTimeAndDuration(timeStr);
                                    
                                    tasks.push({
                                        title,
                                        day: matchedDay.charAt(0).toUpperCase() + matchedDay.slice(1),
                                        time,
                                        venue,
                                        category: 'School',
                                        durationMinutes,
                                        confidenceScore: 1.0,
                                        validationStatus: 'validated'
                                    });
                                }
                            }
                        }
                    }
                } else {
                    let headerRowIndex = -1;
                    for (let i = 0; i < Math.min(rows.length, 10); i++) {
                        const row = rows[i].map(c => String(c).toLowerCase());
                        if (row.some(c => c.includes('title') || c.includes('subject') || c.includes('activity') || c.includes('course')) &&
                            row.some(c => c.includes('day') || c.includes('date')) &&
                            row.some(c => c.includes('time') || c.includes('start'))) {
                            headerRowIndex = i;
                            break;
                        }
                    }
                    
                    if (headerRowIndex !== -1) {
                        const headers = rows[headerRowIndex].map(c => String(c).toLowerCase());
                        
                        const titleIdx = headers.findIndex(h => h.includes('title') || h.includes('subject') || h.includes('activity') || h.includes('course'));
                        const dayIdx = headers.findIndex(h => h.includes('day') || h.includes('date'));
                        const timeIdx = headers.findIndex(h => h.includes('time') || h.includes('start'));
                        const durationIdx = headers.findIndex(h => h.includes('duration') || h.includes('length'));
                        const venueIdx = headers.findIndex(h => h.includes('venue') || h.includes('room') || h.includes('location'));
                        
                        for (let i = headerRowIndex + 1; i < rows.length; i++) {
                            const row = rows[i];
                            if (!row || row.length === 0) continue;
                            
                            const title = titleIdx !== -1 ? String(row[titleIdx] || '').trim() : '';
                            const dayRaw = dayIdx !== -1 ? String(row[dayIdx] || '').trim().toLowerCase() : '';
                            const time = timeIdx !== -1 ? String(row[timeIdx] || '').trim() : '';
                            const durationStr = durationIdx !== -1 ? String(row[durationIdx] || '').trim() : '';
                            const venue = venueIdx !== -1 ? String(row[venueIdx] || '').trim() : '';
                            
                            if (title && dayRaw && time) {
                                const matchedDay = daysOfWeek.find(d => dayRaw.includes(d)) || dayRaw;
                                const formattedDay = matchedDay.charAt(0).toUpperCase() + matchedDay.slice(1);
                                
                                let durationMinutes = 60;
                                let parsedTime = time;
                                
                                if (durationStr) {
                                    const match = durationStr.match(/(\d+)/);
                                    if (match) durationMinutes = parseInt(match[1], 10);
                                    const parsed = parseTimeAndDuration(time);
                                    parsedTime = parsed.time;
                                } else {
                                    const parsed = parseTimeAndDuration(time);
                                    parsedTime = parsed.time;
                                    durationMinutes = parsed.durationMinutes;
                                }
                                
                                tasks.push({
                                    title,
                                    day: formattedDay,
                                    time: parsedTime,
                                    venue,
                                    durationMinutes,
                                    category: 'School',
                                    confidenceScore: 1.0,
                                    validationStatus: 'validated'
                                });
                            }
                        }
                    } else {
                        for (let i = 0; i < rows.length; i++) {
                            const row = rows[i];
                            if (!row || row.length < 2) continue;
                            
                            let title = '';
                            let dayRaw = '';
                            let time = '';
                            let venue = '';
                            
                            for (let j = 0; j < row.length; j++) {
                                const cell = String(row[j] || '').trim();
                                if (!cell) continue;
                                
                                const lowerCell = cell.toLowerCase();
                                if (daysOfWeek.some(d => lowerCell === d)) {
                                    dayRaw = cell;
                                } else if (cell.match(/\d{1,2}:\d{2}/)) {
                                    time = cell;
                                } else if (lowerCell.includes('room') || lowerCell.includes('hall') || lowerCell.includes('lab')) {
                                    venue = cell;
                                } else if (!title) {
                                    title = cell;
                                } else if (!venue) {
                                    venue = cell;
                                }
                            }
                            
                            if (title && dayRaw && time) {
                                const matchedDay = daysOfWeek.find(d => dayRaw.toLowerCase().includes(d)) || dayRaw;
                                const formattedDay = matchedDay.charAt(0).toUpperCase() + matchedDay.slice(1);
                                
                                const { time: parsedTime, durationMinutes } = parseTimeAndDuration(time);
                                
                                tasks.push({
                                    title,
                                    day: formattedDay,
                                    time: parsedTime,
                                    venue,
                                    durationMinutes,
                                    category: 'School',
                                    confidenceScore: 1.0,
                                    validationStatus: 'validated'
                                });
                            }
                        }
                    }
                }
                
                console.log("Extracted CSV Tasks:", tasks);
                resolve(tasks);
            } catch (error) {
                console.error("CSV Parsing Error:", error);
                reject(new Error("Failed to parse CSV file. Please ensure it's a valid format."));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file, 'UTF-8');
    });
};
