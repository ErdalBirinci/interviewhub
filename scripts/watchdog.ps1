# InterviewHub PowerShell watchdog.
#
# Neden powershell? Bu makinede node.exe surecleri bazen
# disaridan (kaynagi belirsiz) sonlandiriliyor; node
# tabanli watchdog da birlikte ölüyordu. powershell.exe
# olan watchdog hayatta kalir ve sunucu ölürse otomatik
# olarak yeniden baslatir.
#
# Kullanim:
#   npm run start:watch
#   (veya dogrudan) powershell -ExecutionPolicy Bypass -NoProfile -File scripts\watchdog.ps1
#
# Kurallar:
#  - temiz kapanis (kod 0) -> yeniden baslatma yok
#  - port zaten kullaniliyor -> cikis (baska bir sunucu ayakta)
#  - diger hatalar -> 60 sn penceresinde en fazla 10 deneme, artan bekleme
#
# Sunucu ciktisi server/.data/server.log (stdout) ve
# server/.data/server.err.log (stderr) dosyalarina eklenir.

param(
  [string]$NodePath = ""
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$scriptsDir = $PSScriptRoot
$root = Split-Path -Parent $scriptsDir
$serverDir = Join-Path $root "server"
$entry = Join-Path $serverDir "dist\server.mjs"
$dataDir = Join-Path $serverDir ".data"

# Olay dinleyicilerinden (farkli runspace) ulasilabilmesi icin global.
$global:ihLogFile = Join-Path $dataDir "server.log"
$global:ihErrFile = Join-Path $dataDir "server.err.log"
$global:ihPort = 4000

if (-not $NodePath) {
  $NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
}
if (-not $NodePath -or -not (Test-Path $NodePath)) {
  $NodePath = "C:\Program Files\nodejs\node.exe"
}
if (-not (Test-Path $NodePath)) {
  Write-Host "[watch] node bulunamadi: $NodePath"
  exit 1
}
if (-not (Test-Path $entry)) {
  Write-Host "[watch] server/dist/server.mjs yok. Once derleyin: npm run build"
  exit 1
}
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null

function Write-Log {
  param([string]$Message)
  $line = "{0} [watch] {1}" -f (Get-Date -Format "dd.MM.yyyy HH:mm:ss"), $Message
  Write-Host $line
  try { Add-Content -Path $global:ihLogFile -Value $line -Encoding UTF8 } catch {}
}

function Test-PortInUse {
  param([int]$Port)
  try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", $Port)
    $tcp.Close()
    return $true
  } catch {
    return $false
  }
}

# Sunucuyu baslatir; stdout/stderr akislarini asenkron dosyaya ekler.
$global:serverProcess = $null
function Start-Server {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $NodePath
  $psi.Arguments = "`"$entry`""
  $psi.WorkingDirectory = $serverDir
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true

  $global:serverProcess = New-Object System.Diagnostics.Process
  $global:serverProcess.StartInfo = $psi
  $global:serverProcess.EnableRaisingEvents = $true
  $global:serverProcess.Start() | Out-Null

  Register-ObjectEvent -InputObject $global:serverProcess -EventName OutputDataReceived -Action {
    if ($Event.SourceEventArgs.Data) {
      try { Add-Content -Path $global:ihLogFile -Value $Event.SourceEventArgs.Data -Encoding UTF8 } catch {}
    }
  } | Out-Null
  Register-ObjectEvent -InputObject $global:serverProcess -EventName ErrorDataReceived -Action {
    if ($Event.SourceEventArgs.Data) {
      try { Add-Content -Path $global:ihErrFile -Value $Event.SourceEventArgs.Data -Encoding UTF8 } catch {}
    }
  } | Out-Null

  $global:serverProcess.BeginOutputReadLine()
  $global:serverProcess.BeginErrorReadLine()
}

Write-Log "watchdog baslatildi (node: $NodePath, port: $global:ihPort)"

$restarts = @()
while ($true) {
  if (Test-PortInUse $global:ihPort) {
    Write-Log "$global:ihPort portu zaten kullaniliyor (baska bir sunucu ayakta) - cikiliyor"
    exit 0
  }

  Start-Server
  $global:serverProcess.WaitForExit()
  $code = $global:serverProcess.ExitCode

  if ($code -eq 0) {
    Write-Log "sunucu temiz sekilde kapandi"
    exit 0
  }

  $now = Get-Date
  $restarts = @($restarts | Where-Object { ($now - $_).TotalSeconds -lt 60 })
  if ($restarts.Count -ge 10) {
    Write-Log "60 sn icinde 10 deneme de tutmadi - kapatiliyor"
    exit 1
  }
  $restarts += $now
  $delay = [Math]::Min(0.5 * $restarts.Count, 5)
  Write-Log "sunucu beklenmedik sekilde kapandi (kod=$code) - ${delay}s sonra yeniden baslatiliyor ($($restarts.Count)/10)"
  Start-Sleep -Seconds $delay
}
