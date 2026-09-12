# Multi-Device Dashboard - Windows Battery Reporter
# Usage: powershell.exe -ExecutionPolicy Bypass -File .\report_battery.ps1 -DashboardUrl "http://YOUR_SERVER_IP:8080" -DeviceId "windows-pc"

param(
    [string]$DashboardUrl = "http://localhost:8080",
    [string]$DeviceId = "$env:COMPUTERNAME".ToLower()
)

try {
    # Query battery details
    $battery = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if ($null -eq $battery) {
        # Desktop PC without battery
        $percentage = 100
        $isCharging = $true
        $powerSource = "AC Power (Desktop)"
        $health = "N/A"
    } else {
        $percentage = [int]$battery.EstimatedChargeRemaining
        # BatteryStatus: 2=Unknown/AC, 3=Fully Charged, 6..9=Charging
        $status = [int]$battery.BatteryStatus
        $isCharging = ($status -eq 6 -or $status -eq 7 -or $status -eq 8 -or $status -eq 9)
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

    Write-Host "Sending telemetry to $DashboardUrl/api/report..."
    Write-Host $payload

    $response = Invoke-RestMethod -Uri "$DashboardUrl/api/report" -Method Post -ContentType "application/json" -Body $payload
    Write-Host "Server response: $($response | ConvertTo-Json -Compress)"
}
catch {
    Write-Error "Failed to report battery status: $_"
}
