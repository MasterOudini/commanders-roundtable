' Runs the launcher .bat with NO console window (window style 0).
' The desktop shortcut targets this file, not the .bat, so starting the app
' doesn't flash a terminal. Anything that goes wrong is recorded in launch.log
' — that log is the only diagnostic you get here, which is why the launcher
' writes to it unconditionally.
Dim shell, fso, scriptDir
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName) & "\"
shell.Run """" & scriptDir & "start-commanders-roundtable.bat""", 0, False
