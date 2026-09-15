# ==========================================================================
# Statuser — Windows Battery Reporter
# Reports battery, CPU, and RAM telemetry to your Statuser dashboard.
#
# Usage:
#   .\report_battery.ps1 -DashboardUrl "http://YOUR_SERVER:8080" [-DeviceId "my-pc"] [-UserId "user_abc"]
#   .\report_battery.ps1 -DashboardUrl "http://YOUR_SERVER:8080" -Install
#   .\report_battery.ps1 -Uninstall
#
# Examples:
#   .\report_battery.ps1 -DashboardUrl "http://localhost:8080"
#   .\report_battery.ps1 -DashboardUrl "http://localhost:8080" -DeviceId "work-laptop" -UserId "user_abc123"
#   .\report_battery.ps1 -DashboardUrl "http://localhost:8080" -Install
#   .\report_battery.ps1 -Uninstall
# ==========================================================================

param(
    [string]$DashboardUrl = "http://localhost:8080",
    [string]$DeviceId = "$env:COMPUTERNAME".ToLower(),
    [string]$UserId = "",
    [switch]$Install,
    [switch]$Uninstall
)

$TaskName = "StatuserBatteryReport"
$ScriptPath = $MyInvocation.MyCommand.Path

# ── Uninstall ────────────────────────────────────────────────────────────

if ($Uninstall) {
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
        Write-Host "✓ Uninstalled Statuser scheduled task."
    }
    catch {
        Write-Host "No Statuser scheduled task found to remove."
    }
    exit 0
}

# ── Install (Scheduled Task) ─────────────────────────────────────────────

if ($Install) {
    if (-not $DashboardUrl -or $DashboardUrl -eq "http://localhost:8080") {
        Write-Host "Note: Using default URL http://localhost:8080. Pass -DashboardUrl to change."
    }

    $arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptPath`" -DashboardUrl `"$DashboardUrl`" -DeviceId `"$DeviceId`""
    if ($UserId) {
        $arguments += " -UserId `"$UserId`""
    }

    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

    # Remove existing task if any
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Statuser: Reports battery telemetry every 5 minutes"

    Write-Host "✓ Statuser scheduled task installed!"
    Write-Host "  Reporting every 5 minutes to: $DashboardUrl"
    Write-Host "  Device ID: $DeviceId"
    if ($UserId) { Write-Host "  User ID: $UserId" }
    Write-Host ""
    Write-Host "  To uninstall: .\report_battery.ps1 -Uninstall"
    exit 0
}

# ── Report battery telemetry ─────────────────────────────────────────────

try {
    # Query battery details
    $battery = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1

    if ($null -eq $battery) {
        # Desktop PC without battery
        $percentage = 100
        $isCharging = $true
        $powerSource = "AC Power (Desktop)"
        $health = "N/A (Desktop)"
    } else {
        $percentage = [int]$battery.EstimatedChargeRemaining
        # BatteryStatus: 1=Discharging, 2=AC, 3=Fully Charged, 6..9=Charging
        $status = [int]$battery.BatteryStatus
        $isCharging = ($status -eq 6 -or $status -eq 7 -or $status -eq 8 -or $status -eq 9 -or $status -eq 2)
        $powerSource = if ($status -eq 1) { "Battery" } else { "AC Power" }
        $health = "Good"
    }

    # Query system telemetry
    $computer = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue
    $model = "$($computer.Manufacturer) $($computer.Model)"
    $deviceName = $env:COMPUTERNAME

    $cpu = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Measure-Object -Property LoadPercentage -Average
    $cpuUsage = if ($cpu.Average) { [math]::Round($cpu.Average, 1) } else { 0 }

    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue
    $totalRam = $os.TotalVisibleMemorySize
    $freeRam = $os.FreePhysicalMemory
    $ramUsage = if ($totalRam -gt 0) { [math]::Round((($totalRam - $freeRam) / $totalRam) * 100, 1) } else { 0 }

    $payload = @{
        device_id     = $DeviceId
        name          = $deviceName
        platform      = "windows"
        model         = $model
        battery_level = $percentage
        is_charging   = $isCharging
        power_source  = $powerSource
        battery_health= $health
        cpu_usage     = $cpuUsage
        ram_usage     = $ramUsage
    } | ConvertTo-Json -Compress

    $headers = @{ "Content-Type" = "application/json" }
    if ($UserId) {
        $headers["X-User-Id"] = $UserId
    }

    Write-Host "Reporting to $DashboardUrl/api/report..."
    $response = Invoke-RestMethod -Uri "$DashboardUrl/api/report" -Method Post -Headers $headers -Body $payload
    Write-Host "✓ Reported: $deviceName ($model) — ${percentage}%"
}
catch {
    Write-Error "Failed to report battery status: $_"
}
