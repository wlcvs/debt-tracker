// Starts/stops the local Ollama server as a plain background process,
// replacing the systemd user unit this used to run under. Usage:
//   node scripts/ollama.mjs start|stop|status
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const HOME = homedir();
const OLLAMA_BIN = path.join(HOME, ".local/ollama/bin/ollama");
const PID_FILE = path.join(import.meta.dirname, ".ollama.pid");

function readPid() {
  if (!existsSync(PID_FILE)) return null;
  const pid = Number(readFileSync(PID_FILE, "utf8").trim());
  return Number.isInteger(pid) ? pid : null;
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function start() {
  const existing = readPid();
  if (existing && isAlive(existing)) {
    console.log(`Already running (pid ${existing}).`);
    return;
  }

  const child = spawn(OLLAMA_BIN, ["serve"], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      OLLAMA_HOST: "127.0.0.1:11434",
      OLLAMA_MODELS: path.join(HOME, ".local/ollama/models"),
      LD_LIBRARY_PATH: path.join(HOME, ".local/ollama/lib/ollama"),
    },
  });
  child.unref();
  writeFileSync(PID_FILE, String(child.pid));
  console.log(`Started (pid ${child.pid}).`);
}

function stop() {
  const pid = readPid();
  if (!pid || !isAlive(pid)) {
    console.log("Not running.");
    if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
    return;
  }
  process.kill(pid, "SIGTERM");
  unlinkSync(PID_FILE);
  console.log(`Stopped (pid ${pid}).`);
}

function status() {
  const pid = readPid();
  if (pid && isAlive(pid)) {
    console.log(`Running (pid ${pid}).`);
  } else {
    console.log("Not running.");
  }
}

const cmd = process.argv[2];
if (cmd === "start") start();
else if (cmd === "stop") stop();
else if (cmd === "status") status();
else {
  console.error("Usage: node scripts/ollama.mjs start|stop|status");
  process.exit(1);
}
