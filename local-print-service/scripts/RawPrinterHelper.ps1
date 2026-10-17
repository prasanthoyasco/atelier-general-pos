
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
