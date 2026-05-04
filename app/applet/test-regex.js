const failedGen = '<function=suggestTimetable({"planSummary": "A personalized study plan for CS courses", "tasks": [{"title": "Algorithms", "day": "Monday", "time": "09:00", "durationMinutes": 90, "venue": "CS Lab"}, {"title": "Data Structures", "day": "Tuesday", "time": "10:00", "durationMinutes": 90, "venue": "CS Lab"}, {"title": "Computer Systems", "day": "Wednesday", "time": "11:00", "durationMinutes": 90, "venue": "CS Lab"}]})</function>';

const looseRegex = /<function=([^>\[\{\s]+)\s*(.*?)(?:<\/function>)/is;
const match = failedGen.match(looseRegex);

if (match) {
    console.log('Match 1:', match[1]);
    console.log('Match 2:', match[2]);
    const funcName = match[1].replace(/["'()]/g, '').trim();
    let jsonString = match[2].trim();
    console.log('JSON STR 1:', jsonString);
    if (jsonString.endsWith(')')) jsonString = jsonString.slice(0, -1).trim();
    if (jsonString.endsWith('>')) jsonString = jsonString.slice(0, -1).trim();
    
    if (jsonString.startsWith('(')) jsonString = jsonString.slice(1).trim();

    console.log('JSON STR:', jsonString);
    try {
        console.log('Parsed:', JSON.parse(jsonString));
    } catch(e) {
        console.log('Parse error:', e.message);
    }
} else {
    console.log('No match');
}
