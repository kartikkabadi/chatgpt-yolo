const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Commands = require("../command-viability.js");
const Routing = require("../command-ui-routing.js");

const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
