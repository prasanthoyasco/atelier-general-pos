import { execFile, exec } from "child_process";
import fs from "fs/promises";
import fsSync from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import BaseAdapter from "./BaseAdapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.join(__dirname, "../../scripts");
const RAW_SCRIPT_PATH = path.join(SCRIPTS_DIR, "RawPrinterHelper.ps1");

const rawPrinterScriptContent = String.raw`
param(
  [Parameter(Mandatory=$true)][string]$PrinterName,
  [Parameter(Mandatory=$true)][string]$DataPath
)

if (-not ([System.Management.Automation.PSTypeName]'RawPrinterHelper').Type) {
  Add-Type -TypeDefinition @"
  using System;
  using System.Runtime.InteropServices;

  public class RawPrinterHelper
  {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
      [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
      [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
      [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, Int32 dwCount, out Int32 dwWritten);

    public static void SendBytesToPrinter(string printerName, byte[] bytes)
    {
      IntPtr hPrinter;
      DOCINFOA di = new DOCINFOA();
      di.pDocName = "Atelier Thermal Document";
      di.pDataType = "RAW";

      if (!OpenPrinter(printerName.Normalize(), out hPrinter, IntPtr.Zero)) {
        throw new Exception("Unable to open printer: " + printerName + ". Verify printer is plugged in and online.");
      }

      try {
        if (!StartDocPrinter(hPrinter, 1, di)) throw new Exception("Unable to start print document.");
        if (!StartPagePrinter(hPrinter)) throw new Exception("Unable to start print page.");
        int written;
        if (!WritePrinter(hPrinter, bytes, bytes.Length, out written)) throw new Exception("Unable to write raw bytes to spooler.");
        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
      }
      finally {
        ClosePrinter(hPrinter);
      }
    }
  }
"@
}

[byte[]]$bytes = [System.IO.File]::ReadAllBytes($DataPath)
[RawPrinterHelper]::SendBytesToPrinter($PrinterName, $bytes)
`;

// Ensure scripts directory and file are created once
try {
  if (!fsSync.existsSync(SCRIPTS_DIR)) {
    fsSync.mkdirSync(SCRIPTS_DIR, { recursive: true });
  }
  fsSync.writeFileSync(RAW_SCRIPT_PATH, rawPrinterScriptContent, "utf8");
} catch (e) {
  // Silent fallback
}

const runPowerShell = (args, timeout = 25000) =>
  new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      args,
      { windowsHide: true, timeout },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || stdout || error.message));
          return;
        }
        resolve(stdout);
      }
    );
  });

export class OSSpoolerAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config);
    this.printerName = config.target || config.printerName || "";
  }

  /**
   * Enumerate installed OS printers
   */
  static async listPrinters() {
    if (process.platform === "win32") {
      try {
        const output = await runPowerShell(
          [
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_Printer | Select-Object Name,Default,PortName,PrinterStatus,WorkOffline | ConvertTo-Json -Compress",
          ],
          15000
        );

        const parsed = JSON.parse(output || "[]");
        return (Array.isArray(parsed) ? parsed : [parsed]).map((printer) => ({
          name: printer.Name,
          default: Boolean(printer.Default),
          port: printer.PortName || "Unknown",
          offline: Boolean(printer.WorkOffline),
          connection_type: "os_spooler",
        }));
      } catch (err) {
        console.error("Failed to enumerate Windows printers:", err.message);
        return [];
      }
    } else {
      // Unix / macOS / CUPS fallback
      return new Promise((resolve) => {
        exec("lpstat -a", (err, stdout) => {
          if (err) return resolve([]);
          const list = stdout
            .split("\n")
            .filter(Boolean)
            .map((line) => {
              const name = line.split(" ")[0];
              return { name, default: false, connection_type: "os_spooler" };
            });
          resolve(list);
        });
      });
    }
  }

  async testConnection() {
    if (!this.printerName) {
      return { ok: false, error: "Printer name is required." };
    }

    const printers = await OSSpoolerAdapter.listPrinters();
    const matched = printers.find(
      (p) => p.name.toLowerCase() === this.printerName.toLowerCase()
    );

    if (!matched) {
      return {
        ok: false,
        error: `Printer "${this.printerName}" was not found in installed system printers. Check Windows Devices & Printers.`,
      };
    }

    if (matched.offline) {
      return {
        ok: false,
        error: `Printer "${this.printerName}" is currently marked OFFLINE in Windows. Check USB cable and power.`,
      };
    }

    return {
      ok: true,
      message: `System printer "${this.printerName}" is installed and online.`,
    };
  }

  async sendRaw(data, options = {}) {
    const printer = this.printerName || options.printerName;
    if (!printer) {
      throw new Error("Printer name is required for OS Spooler printing.");
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "atelier-print-"));
    const dataPath = path.join(tempDir, "print_job.bin");

    try {
      const buffer = Buffer.isBuffer(data)
        ? data
        : Buffer.from(String(data), "utf8");

      await fs.writeFile(dataPath, buffer);

      if (process.platform === "win32") {
        await runPowerShell(
          [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            RAW_SCRIPT_PATH,
            "-PrinterName",
            printer,
            "-DataPath",
            dataPath,
          ],
          20000
        );

        return {
          ok: true,
          writtenBytes: buffer.length,
          confirmed: false, // Spooler accepted job; physical completion is asynchronous
          message: `Job submitted to Windows Spooler for "${printer}".`,
        };
      } else {
        // Unix / macOS CUPS fallback
        await new Promise((resolve, reject) => {
          exec(`lpr -P "${printer}" -l "${dataPath}"`, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message));
            resolve();
          });
        });

        return {
          ok: true,
          writtenBytes: buffer.length,
          confirmed: false,
          message: `Job submitted to CUPS printer "${printer}".`,
        };
      }
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  getCapabilities() {
    return {
      supportsCut: true,
      supportsDrawer: true,
      supportsQr: false,
      supportsStatusCheck: true,
      supportsNetwork: false,
      supportsSpooler: true,
    };
  }
}

export default OSSpoolerAdapter;
