Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c node build/web-launcher.js", 0, False
