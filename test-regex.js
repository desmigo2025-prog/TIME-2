const string1 = `{\\n "text": "Hi Desmond! How are you doing today?",\\n "emotion": "happy",\\n "animation": "greeting",\\n "popup": false,\\n "priority": "low",\\n "suggestedAnswers": ["I'm good, thanks", "I need help with something"]\\n}`

let cleanJson = string1;
cleanJson = cleanJson.replace(/\\n/g, '');
console.log("Replaced:", cleanJson);
try {
  console.log(JSON.parse(cleanJson));
} catch(e) { console.error(e) }
