const errorMsg = '400 {"error":{"message":"Failed to call a function. Please adjust your prompt. See \'failed_generation\' for more details.","type":"invalid_request_error","code":"tool_use_failed","failed_generation":"<function=updateUserSettings [{\\"settings\\": {\\"theme\\": \\"red\\"}}]</function>"}}';

let rawError = {};
try {
    if (errorMsg.startsWith('400 ')) {
        rawError = JSON.parse(errorMsg.substring(4)).error;
    }
} catch (e) {
    console.log("Parse error:", e);
}

console.log("rawError:", rawError);
const failedGen = rawError.failed_generation;
const looseRegex = /<function=([^>\[\{\s]+)\s*([\[\{].*?[\]\}])\s*(?:<\/function>|>|$)/is;
const match = failedGen.match(looseRegex);
console.log("match:", match);
