#!/usr/bin/env node

import { parseArgs } from "node:util";
import { install } from "../lib/install.mjs";
import { list } from "../lib/list.mjs";
import { search } from "../lib/search.mjs";
import { info } from "../lib/info.mjs";
import { getConfig } from "../lib/config.mjs";

const HELP = `
  ripple — AI Skill installer

  Usage:
    ripple install <skill-name>  Install a skill into the current project
    ripple list                  List available skills
    ripple search <query>        Search skills by keyword
    ripple info <skill-name>     Show skill details
    ripple config                Show current config

  Options:
    --server <url>   Ripple server URL (default: http://localhost:8000)
    --dir <path>     Target directory (default: ./.skills)
    --token <token>  Auth token for private skills
    -h, --help       Show this help
    -v, --version    Show version

  Examples:
    npx ripple install engineering-backend-architect
    npx ripple search "github"
    npx ripple list --server https://ripple.patpat.com
`;

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      server: { type: "string", default: "" },
      dir: { type: "string", default: "" },
      token: { type: "string", default: "" },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });

  if (values.version) {
    console.log("ripple-cli 0.1.0");
    process.exit(0);
  }

  const command = positionals[0];
  const args = positionals.slice(1);
  const config = getConfig(values);

  if (values.help || !command) {
    console.log(HELP);
    process.exit(0);
  }

  switch (command) {
    case "install":
    case "i":
      if (!args[0]) {
        console.error("Error: skill name required\nUsage: ripple install <skill-name>");
        process.exit(1);
      }
      await install(args[0], config);
      break;

    case "list":
    case "ls":
      await list(config);
      break;

    case "search":
    case "s":
      await search(args.join(" "), config);
      break;

    case "info":
      if (!args[0]) {
        console.error("Error: skill name required\nUsage: ripple info <skill-name>");
        process.exit(1);
      }
      await info(args[0], config);
      break;

    case "config":
      console.log(`Server : ${config.server}`);
      console.log(`Dir    : ${config.dir}`);
      console.log(`Token  : ${config.token ? "****" : "(none)"}`);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.log(HELP);
      process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
