#!/Users/irasanchez/.nvm/versions/node/v18.1.0/bin/node

// @raycast.schemaVersion 1
// @raycast.title Publish Notes
// @raycast.icon 📝
// @raycast.mode compact
// @raycast.author Ira Sanchez
// @raycast.authorURL https://www.irasanchez.com

let fs = require("fs"),
  fse = require("fs-extra"),
  simpleGit = require("simple-git"),
  fm = require("front-matter"),
  path = require("path"),
  yaml = require("yaml"),
  stream = fs.createWriteStream("log.txt", { flags: "a" });

start();

// Functions are sorted alphabetically.

function catalogNote(path, title) {
  try {
    handleLog(`Adding ${title} to last at: ${path}`);
    fs.appendFileSync(path, `\n- [[${title}]]`);
    handleLog(`SUCCESS: Wrote to ${file}`, content);
  } catch (err) {
    handleError("Unable to catalog note", err);
  }
}
function copyDirectory(source, dest) {
  handleLog("Copying directory");
  fse.copySync(
    source,
    dest,
    {
      overwrite: true,
    },
    (err) => {
      if (err) {
        handleError("There was an error: ", err);
      } else {
        handleLog("Copying notes successful");
      }
    }
  );
}
function fileHadFrontmatter(data) {
  handleLog("Checking if file has frontmatter");
  return data[0] === "";
}
function formatDate(modifiedDateObject) {
  handleLog("Formatting date");
  return `${modifiedDateObject.getFullYear()}-${
    modifiedDateObject.getMonth() + 1
  }-${modifiedDateObject.getDate()}`;
}
async function gitAdd(git) {
  try {
    handleLog("Adding to git");
    let res = await git.add(".");
    handleLog("Added", res);
  } catch (e) {
    handleError("There was an error when adding to git", e);
  }
}
async function gitCommit(git) {
  try {
    handleLog("Committing to git");
    let res = await git.commit("Automated script updating notes");
    handleLog("Committed:", res);
  } catch (e) {
    handleLog("There was an error when committing", e);
  }
}
async function gitPush(git) {
  try {
    handleLog("Pushing to GitHub");
    let res = await git.push(["origin", "master"]);
    handleLog("Pushed", res);
  } catch (e) {
    handleLog("There was an error when pushing", e);
  }
}
function handleLog(message, data = null) {
  let messageToLog = `${message}${data ? ": " + JSON.stringify(data) : ""}\n`;
  stream.write(messageToLog);
  console.log(messageToLog);
}
function handleError(errorMessage, error) {
  let message = `ERROR - ${errorMessage}: ${error}`;
  handleLog(message);
}
function isNotCatalogued(data, title) {
  handleLog(`Checking if ${title} is listed in ${data}`);
  return !data.includes(title);
}
function isNotThisNote(title, check) {
  handleLog(
    `Checking if ${title} has ${check} to see if they're the same note`
  );
  return !title.includes(check);
}
function jsonToYaml(frontmatterAsJSON) {
  return yaml.stringify(frontmatterAsJSON, { blockQuote: false });
}
function noteHasType(type, check) {
  handleLog(`Checking if ${type} include ${check}`);
  return type.includes(check);
}
function processDirectory(source) {
  handleLog(`Processing directory: ${source}`);
  fs.readdir(source, function (err, files) {
    handleLog("reading files" + "\n");
    if (err) {
      handleError("Unable to scan directory: ", err);
    } else {
      handleLog("SUCCESS - Received files");
      processFilesPlural(files, source);
    }
  });
}
function processFileSingular(path, file) {
  handleLog(`Processing ${file}`);
  let data = fs.readFileSync(path, "utf8");
  let fileWithUpdatedFrontmatter = updateFrontmatter(data, path, file);
  writeToFile(path, file, fileWithUpdatedFrontmatter);
}
function processFilesPlural(files, source) {
  handleLog(`Processing all files in directory`);
  files.forEach(function (file) {
    processFileSingular(`${source}/${file}`, file);
  });
}
function processType(type, title) {
  handleLog(`Processing type for ${title}`);
  let readingNotesPath =
    "/Users/irasanchez/Library/Mobile Documents/iCloud~co~noteplan~NotePlan/Documents/Notes/_notes/Reading Notes.md";
  if (
    noteHasType(type, "Reading Notes") &&
    isNotThisNote(title, "Reading Notes")
  ) {
    syncType(readingNotesPath, title);
  }
}
function removeFrontmatter(data) {
  handleLog("Removing frontmatter");
  data.shift(); // remove empty string left behind from split
  data.shift();
}
function replaceFrontmatter(data, frontmatterAsJSON) {
  handleLog("Replacing frontmatter");
  data.unshift("---\n");
  data.unshift(jsonToYaml(frontmatterAsJSON));
  data.unshift("---\n");
}
async function start() {
  handleLog(
    `\n**********************\n**********************\n${new Date().toISOString()}\nBegin publishing notes\nGenerating Lists`
  );

  let source =
    "/Users/irasanchez/Library/Mobile Documents/iCloud~co~noteplan~NotePlan/Documents/Notes/_notes";
  let dest = "/Users/irasanchez/Developer/2020portfolio/_notes";
  let git = simpleGit(dest);

  processDirectory(source);
  copyDirectory(source, dest);
  await gitAdd(git);
  await gitCommit(git);
  await gitPush(git);
  // # FILES = $(grep -r -e "(.+?)(\.[^.]*$|$)" $SOURCE)
  stream.end();
}
function syncType(path, title) {
  handleLog(`Syncing type: ${path}, ${title}`);
  let data = fs.readFileSync(path, "utf8");
  if (isNotCatalogued(data, title)) {
    catalogNote(path, title);
  }
}
function updateFrontmatter(data, path, file) {
  handleLog("Updating frontmatter");
  let frontmatterAsJSON = fm(data).attributes;
  let modifiedDateObject = fs.statSync(path).mtime;
  let date = formatDate(modifiedDateObject);

  if (!frontmatterAsJSON.title || frontmatterAsJSON.title.includes(".md")) {
    frontmatterAsJSON.title = file.replace(".md", "");
  }
  if (!frontmatterAsJSON.updated) {
    frontmatterAsJSON.updated = date;
  }
  handleLog(
    `Finished making new frontmatter: ${JSON.stringify(frontmatterAsJSON)}`
  );
  data = data.split("---");

  if (
    frontmatterAsJSON.type &&
    frontmatterAsJSON.type.includes("Reading Notes")
  ) {
    processType(frontmatterAsJSON.type, frontmatterAsJSON.title);
  }
  if (fileHadFrontmatter(data)) {
    removeFrontmatter(data); // remove old frontmatter
  }
  replaceFrontmatter(data, frontmatterAsJSON);
  data = data.join("");
  handleLog(data);
  return data;
}
function writeToFile(path, file, content) {
  try {
    handleLog(`Writing to ${file}`);
    fs.writeFileSync(path, content);
    handleLog(`SUCCESS: Wrote to ${file}`, content);
  } catch (err) {
    handleError("Unable to update file", err);
  }
}
