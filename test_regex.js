const str = `<function=navigateApp{"page": "home"}</function>`;
const looseRegex = /<function=([^>\[\{\s]+)\s*(.*?)(?:<\/function>)/is;
const match = str.match(looseRegex);
console.log(match);
