/**
 * Watchdog launchers.
 *
 * Windows'ta powershell tabanli watchdog calisir: bu cevrede
 * node.exe surecleri bazen disaridan sonlandirildiginde,
 * node tabanli watchdog da birlikte ölür; powershell.exe
 * watchdog hayatta kalir ve sunucuyu yeniden baslatir.
 * Diger platformlarda node tabanli watchdog (serve.mjs) kullanilir.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === "win32";

const [command, args] = isWindows
  ? [
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(here, "watchdog.ps1"),
      ],
    ]
  : [process.execPath, [path.join(here, "serve.mjs")]];

const child = spawn(command, args, {
  cwd: path.resolve(here, ".."),
  stdio: "inherit",
});

child.on("error", (err) => {
  console.error("watchdog baslatilamadi:", err.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
