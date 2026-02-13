# FileFlux Agent Installation Script für Windows

param (
    [Parameter(Mandatory=$true)]
    [string]$Token,
    
    [Parameter(Mandatory=$true)]
    [string]$ServerUrl,
    
    [string]$AgentName = $env:COMPUTERNAME,
    
    [string]$InstallDir = "C:\Program Files\FileFlux-Agent"
)

# Funktionen
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    
    if ($args) {
        Write-Output $args
    }
    else {
        $input | Write-Output
    }
    
    $host.UI.RawUI.ForegroundColor = $fc
}

# Prüfe, ob das Skript als Administrator ausgeführt wird
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-ColorOutput Red "Dieses Skript muss als Administrator ausgeführt werden."
    exit 1
}

Write-ColorOutput Green "Starte Installation des FileFlux-Agenten..."

# Verzeichnisse erstellen
Write-Output "Erstelle Verzeichnisse..."
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\Config" | Out-Null
New-Item -ItemType Directory -Force -Path "C:\FileFlux\Data" | Out-Null
New-Item -ItemType Directory -Force -Path "C:\FileFlux\Logs" | Out-Null
New-Item -ItemType Directory -Force -Path "C:\FileFlux\Temp" | Out-Null

# Binary herunterladen
Write-Output "Lade Agent-Binary herunter..."
$downloadUrl = "https://download.fileflux.example.com/fileflux-agent-windows.exe"
Invoke-WebRequest -Uri $downloadUrl -OutFile "$InstallDir\fileflux-agent.exe"

# Konfigurationsdatei erstellen
Write-Output "Erstelle Konfigurationsdatei..."
$configContent = @"
agent:
  name: "$AgentName"
  type: "client"
  description: "Installiert via Windows-Installationsskript"

connection:
  server_url: "$ServerUrl"
  token: "$Token"
  heartbeat_interval: 60
  reconnect_attempts: 5
  reconnect_delay: 10

transfers:
  chunk_size: 8
  concurrent_transfers: 3
  compression: true
  temp_dir: "C:\\FileFlux\\Temp"
  base_dir: "C:\\FileFlux\\Data"

logging:
  level: "info"
  file: "C:\\FileFlux\\Logs\\fileflux-agent.log"
  max_size: 10
  max_backups: 3
  max_age: 7
"@

$configContent | Out-File -FilePath "$InstallDir\Config\config.yaml" -Encoding utf8

# NSSM (Non-Sucking Service Manager) herunterladen und installieren, falls noch nicht vorhanden
$nssmPath = "$InstallDir\nssm.exe"
if (-not (Test-Path $nssmPath)) {
    Write-Output "Lade NSSM herunter..."
    $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $nssmZip = "$env:TEMP\nssm.zip"
    Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip
    
    # Extrahiere nssm.exe
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($nssmZip)
    $nssmEntry = $zip.Entries | Where-Object { $_.FullName -like "*win64/nssm.exe" -or $_.FullName -like "*win32/nssm.exe" } | Select-Object -First 1
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($nssmEntry, $nssmPath, $true)
    $zip.Dispose()
    Remove-Item $nssmZip
}

# Service mit NSSM installieren
Write-Output "Installiere Windows-Service..."
& $nssmPath install FileFlux-Agent "$InstallDir\fileflux-agent.exe" "--config `"$InstallDir\Config\config.yaml`""
& $nssmPath set FileFlux-Agent DisplayName "FileFlux Agent"
& $nssmPath set FileFlux-Agent Description "FileFlux-Dateitransfer-Agent"
& $nssmPath set FileFlux-Agent Start SERVICE_AUTO_START
& $nssmPath set FileFlux-Agent AppDirectory "$InstallDir"
& $nssmPath set FileFlux-Agent AppStdout "C:\FileFlux\Logs\fileflux-agent-stdout.log"
& $nssmPath set FileFlux-Agent AppStderr "C:\FileFlux\Logs\fileflux-agent-stderr.log"

# Service starten
Start-Service FileFlux-Agent

# Installation prüfen
$service = Get-Service -Name FileFlux-Agent -ErrorAction SilentlyContinue
if ($service -and $service.Status -eq "Running") {
    Write-ColorOutput Green "FileFlux Agent wurde erfolgreich installiert und gestartet!"
    Write-Output "Agent-Name: $AgentName"
    Write-Output "Server-URL: $ServerUrl"
    Write-Output "Konfigurationsdatei: $InstallDir\Config\config.yaml"
    Write-Output "Log-Datei: C:\FileFlux\Logs\fileflux-agent.log"
    Write-ColorOutput Green "Service-Status: Aktiv"
} else {
    Write-ColorOutput Red "Installation abgeschlossen, aber der Service konnte nicht gestartet werden."
    Write-Output "Bitte überprüfen Sie die Log-Dateien."
} 