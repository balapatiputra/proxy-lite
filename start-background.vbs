Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

nodeExe = "node"
If fso.FileExists("C:\Program Files\nodejs\node.exe") Then
    nodeExe = """C:\Program Files\nodejs\node.exe"""
End If

WshShell.Run nodeExe & " server/index.js", 0, False
