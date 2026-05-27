const fs = require("fs");
const path = require("path");

function loadCases(casesDir) {
  const files = fs
    .readdirSync(casesDir)
    .filter((name) => name.endsWith(".json"))
    .sort();

  return files.map((fileName) => {
    const fullPath = path.join(casesDir, fileName);
    const raw = fs.readFileSync(fullPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      fileName
    };
  });
}

module.exports = {
  loadCases
};
