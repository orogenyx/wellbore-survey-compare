# Installs Survey Compare on this PC: copies the offline page and its icon to
# %LOCALAPPDATA%\SurveyCompare and puts a "Survey Compare" shortcut on the desktop.
# No admin rights needed. Run it from the folder that holds "Survey Compare.html"
# (double-click "Install desktop shortcut.cmd", which calls this file).

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$page = Join-Path $here 'Survey Compare.html'
$icon = Join-Path $here 'survey-compare.ico'
foreach ($f in $page, $icon) { if (-not (Test-Path $f)) { throw "Missing $f. Run this from the folder that holds Survey Compare.html and survey-compare.ico." } }

$dest = Join-Path $env:LOCALAPPDATA 'SurveyCompare'
New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item $page (Join-Path $dest 'Survey Compare.html') -Force
Copy-Item $icon (Join-Path $dest 'survey-compare.ico') -Force
$localPage = Join-Path $dest 'Survey Compare.html'
$localIcon = Join-Path $dest 'survey-compare.ico'

# Shortcuts are written through IShellLink directly so the icon path is stored as a plain
# absolute path. Saving through WScript.Shell rewrites it as %USERPROFILE%\..., which
# Windows 11 then fails to expand and the shortcut shows a blank icon.
$src = @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
namespace SC {
  [ComImport, Guid("00021401-0000-0000-C000-000000000046")] public class ShellLink {}
  [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("000214F9-0000-0000-C000-000000000046")]
  public interface IShellLinkW {
    void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder f, int c, IntPtr pfd, int flags);
    void GetIDList(out IntPtr p); void SetIDList(IntPtr p);
    void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder f, int c); void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string s);
    void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder f, int c); void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string s);
    void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder f, int c); void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string s);
    void GetHotkey(out short h); void SetHotkey(short h); void GetShowCmd(out int s); void SetShowCmd(int s);
    void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder f, int c, out int i); void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string s, int i);
    void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string s, int r); void Resolve(IntPtr h, int f); void SetPath([MarshalAs(UnmanagedType.LPWStr)] string s);
  }
  [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("45e2b4ae-b1c3-11d0-b92f-00a0c90312e1")]
  public interface IShellLinkDataList {
    void AddDataBlock(IntPtr p); void CopyDataBlock(uint sig, out IntPtr p); void RemoveDataBlock(uint sig);
    void GetFlags(out uint f); void SetFlags(uint f);
  }
  public static class Maker {
    public static void Make(string lnk, string target, string workDir, string icon, string desc) {
      var link = (IShellLinkW)new ShellLink();
      link.SetPath(target); link.SetWorkingDirectory(workDir); link.SetDescription(desc); link.SetIconLocation(icon, 0);
      var dl = (IShellLinkDataList)link;
      try { dl.RemoveDataBlock(0xA0000007); } catch {}
      try { dl.RemoveDataBlock(0xA0000001); } catch {}
      uint flags; dl.GetFlags(out flags); dl.SetFlags(flags & ~0x00004000u & ~0x00000200u);
      ((IPersistFile)link).Save(lnk, true);
    }
  }
}
'@
Add-Type -TypeDefinition $src

$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop 'Survey Compare.lnk'
Remove-Item $lnk -Force -ErrorAction SilentlyContinue
[SC.Maker]::Make($lnk, $localPage, $dest, $localIcon, 'Survey Compare: MWD vs DD vs corrections survey QC')

Write-Host ''
Write-Host 'Survey Compare installed.'
Write-Host "  App copied to:    $dest"
Write-Host "  Shortcut created: $lnk"
Write-Host ''
Write-Host 'Double-click the Survey Compare icon on the desktop to open it. It works offline.'
Write-Host 'The same tool is online at https://orogenyx.github.io/wellbore-survey-compare/'
