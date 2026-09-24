const fs = require("fs");
if (!fs.existsSync("/tmp/guest.html")) {
  console.log("No /tmp/guest.html");
  process.exit(0);
}
const text = fs.readFileSync("/tmp/guest.html", "utf-8");

console.log("Includes download.aspx:", text.includes("download.aspx"));
console.log("Includes downloadUrl:", text.includes("downloadUrl"));
console.log("Includes access_token:", text.includes("access_token"));
console.log("Includes Sheet1:", text.includes("Sheet1"));
console.log("Includes _spPageContextInfo:", text.includes("_spPageContextInfo"));

// Check for _spPageContextInfo
const spMatch = text.match(/var _spPageContextInfo\s*=\s*(\{.*?\});/s);
if (spMatch) {
  try {
    const info = JSON.parse(spMatch[1]);
    console.log("spPageContextInfo keys:", Object.keys(info));
    console.log("siteAbsoluteUrl:", info.siteAbsoluteUrl);
    console.log("webAbsoluteUrl:", info.webAbsoluteUrl);
    console.log("serverRequestPath:", info.serverRequestPath);
    console.log("listId:", info.listId);
  } catch (e) {
    console.log("spPageContextInfo parse error:", e.message);
  }
}

// Find any Wac / Excel embedding configuration
const scripts = text.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
for (let s of scripts) {
  if (s.includes("WacFrame") || s.includes("fileGetUrl") || s.includes("DownloadUrl") || s.includes("itemUrl") || s.includes("FileRef")) {
    console.log("Found script snippet:", s.substring(0, 300));
  }
}
