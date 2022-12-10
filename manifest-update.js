const fs = require("fs-extra");

const transformManifest = (fileName) => {
  const path = "./build/manifest.json";
  fileName = "/static/css/" + fileName;

  const json = fs.readJSONSync(path);
  if (!json) throw Error("Could not find json file");

  json.web_accessible_resources[0].resources[0] = fileName;

  // write back in manifest.json
  fs.writeJSONSync(path, json);
};

const transformJs = (fileName, inputFilePath) => {
  const contentJs = fs.readFileSync(inputFilePath);

  fileName = "/static/css/" + fileName;

  // replace '__REPLACE_ON_BUILD__' with the filename
  const newContentJs = contentJs
    .toString()
    .replaceAll("__REPLACE_ON_BUILD__", fileName);

  fs.writeFileSync(inputFilePath, newContentJs);
};

const getCssFileName = () => {
  const files = fs.readdirSync("./build/static/css");
  let filename = files.find((file) => file.endsWith(".css"));

  if (!filename) throw Error("Could not find css file");

  return filename;
};

const runner = () => {
  const fileName = getCssFileName();

  console.log("📦 Found file: " + fileName);

  console.log("🛠 Transforming files...");

  transformManifest(fileName);
  transformJs(fileName, "./build/static/js/content.js");

  console.log("✅ Transformed files!");
};

runner();
