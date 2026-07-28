# Creates a desktop shortcut to the Commander's Roundtable DEV launcher
# (always-latest code, per workspace policy). Run once:
#   powershell -ExecutionPolicy Bypass -File create-shortcut.ps1
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktop = [Environment]::GetFolderPath('Desktop')
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut((Join-Path $desktop "Commander's Roundtable.lnk"))
$sc.TargetPath = Join-Path $here 'start-commanders-roundtable.vbs'
$sc.WorkingDirectory = $here
$sc.IconLocation = (Join-Path $here 'build\icon.ico') + ',0'
$sc.Description = "Commander's Roundtable - play Commander online with friends (dev mode, always latest)"
$sc.Save()
Write-Host "Desktop shortcut created: $((Join-Path $desktop "Commander's Roundtable.lnk"))"
