<#
    Sharvi Vendor Portal — Install SAP Middleware as a Windows Service
    ------------------------------------------------------------------
    Wraps NSSM (https://nssm.cc) to register C:\sharvi\middleware\server.js
    as the "SharviSapMiddleware" Windows Service, with auto-start and log files.

    Prerequisites:
      1. Node.js LTS installed at  C:\Program Files\nodejs\node.exe
      2. nssm.exe placed at        C:\Tools\nssm\nssm.exe
      3. Middleware files copied to C:\sharvi\middleware  (including .env)

    Run from an elevated PowerShell:
      powershell -ExecutionPolicy Bypass -File .\install-windows-service.ps1
#>

[CmdletBinding()]
param(
    [string]$ServiceName  = "SharviSapMiddleware",
    [string]$NodeExe      = "C:\Program Files\nodejs\node.exe",
    [string]$NssmExe      = "C:\Tools\nssm\nssm.exe",
    [string]$AppDirectory = "C:\sharvi\middleware",
    [string]$ScriptPath   = "C:\sharvi\middleware\server.js"
)

$ErrorActionPreference = "Stop"

function Assert-Path($path, $label) {
    if (-not (Test-Path $path)) {
        throw "$label not found at: $path"
    }
}

Assert-Path $NodeExe      "Node.js executable"
Assert-Path $NssmExe      "NSSM executable"
Assert-Path $AppDirectory "Middleware directory"
Assert-Path $ScriptPath   "server.js"

$logDir = Join-Path $AppDirectory "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

# Remove any prior installation (ignore errors if it doesn't exist)
& $NssmExe stop   $ServiceName  2>$null | Out-Null
& $NssmExe remove $ServiceName confirm 2>$null | Out-Null

Write-Host "Installing service '$ServiceName'..." -ForegroundColor Cyan
& $NssmExe install $ServiceName $NodeExe $ScriptPath
& $NssmExe set $ServiceName AppDirectory   $AppDirectory
& $NssmExe set $ServiceName AppStdout      (Join-Path $logDir "out.log")
& $NssmExe set $ServiceName AppStderr      (Join-Path $logDir "err.log")
& $NssmExe set $ServiceName AppRotateFiles 1
& $NssmExe set $ServiceName AppRotateBytes 10485760    # 10 MB
& $NssmExe set $ServiceName Start          SERVICE_AUTO_START
& $NssmExe set $ServiceName AppExit Default Restart
& $NssmExe set $ServiceName Description "Sharvi Vendor Portal — SAP S/4HANA middleware (forwards Lovable Cloud requests to the internal SAP Business Partner API)."

Write-Host "Starting service..." -ForegroundColor Cyan
& $NssmExe start $ServiceName

Write-Host ""
Write-Host "Done. Verify with:" -ForegroundColor Green
Write-Host "    Get-Service $ServiceName"
Write-Host "    curl http://localhost:3002/health"
Write-Host ""
Write-Host "Logs:" -ForegroundColor Green
Write-Host "    $logDir\out.log"
Write-Host "    $logDir\err.log"
