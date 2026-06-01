#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import open from "open";
import config from "../widget.config.js";

const { widgetName, uploadScript, file, server } = config;

console.log(widgetName, uploadScript, file, server);

const fileUrl = `fmp://${server}/${file}?script=${uploadScript}&param=`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const thePath = path.join(__dirname, "../", "dist", "index.html");
const params = { widgetName, thePath };
const url = fileUrl + encodeURIComponent(JSON.stringify(params));
open(url);
