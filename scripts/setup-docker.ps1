param()
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot ".env"
function New-Secret {
    $bytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return ([System.BitConverter]::ToString($bytes)).Replace("-", "").ToLowerInvariant()
}
$existing = if (Test-Path -LiteralPath $envPath) { [System.IO.File]::ReadAllText($envPath) } else { "" }
$changed = $false
foreach ($key in @("WEBFLIX_POSTGRES_PASSWORD", "WEBFLIX_JWT_SECRET")) {
    if ($existing -notmatch "(?m)^$key=.+$") {
        $existing = [regex]::Replace($existing, "(?m)^$key=.*\r?\n?", "")
        $existing = $existing.TrimEnd() + [Environment]::NewLine + "$key=$(New-Secret)" + [Environment]::NewLine
        $changed = $true
    }
}
if ($changed) {
    [System.IO.File]::WriteAllText($envPath, $existing, (New-Object System.Text.UTF8Encoding($false)))
    Write-Output "Generated missing Docker credentials in the ignored .env file."
} else { Write-Output "Docker credentials already exist; left unchanged." }
Write-Output "Run: docker compose up --build -d"
