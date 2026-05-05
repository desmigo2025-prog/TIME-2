const msgs = [
    '<function=navigateApp={"page": "home"}</function>',
    '<function=navigateApp{"page": "home"}</function>',
    '<function=navigateApp{\\"page\\": \\"home\\"}</function>'
];
const looseRegex = /<function=([^>\[\{\s=]+)=?\s*(.*?)(?:<\/function>)/is;
msgs.forEach(str => {
    const match = str.match(looseRegex);
    if (match) {
        let clean = match[2];
        if (clean.includes('\\"')) clean = clean.replace(/\\"/g, '"');
        console.log(`Func: ${match[1]}, JSON: ${clean}`);
    }
});
