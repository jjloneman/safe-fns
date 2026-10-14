<#
.SYNOPSIS
    Format, or check, every PowerShell file under a directory.

.DESCRIPTION
    Runs PSScriptAnalyzer's Invoke-Formatter with the one-true-brace-style
    preset. With -Check it rewrites nothing, names each file that would
    change, and exits 1 if any would.

.PARAMETER Check
    Report drift instead of rewriting files.

.PARAMETER Path
    The directory to search for .ps1 and .psm1 files.
#>
param(
    [switch] $Check,

    [Parameter(Mandatory)]
    [string] $Path
)

$ErrorActionPreference = 'Stop'

$drifted = @(
    Get-ChildItem -Path $Path -Recurse -Include '*.ps1', '*.psm1' |
        Where-Object {
            $original = Get-Content -LiteralPath $_.FullName -Raw
            $formatted = Invoke-Formatter -ScriptDefinition $original `
                -Settings CodeFormattingOTBS

            if ($formatted -ceq $original) {
                return $false
            }

            if (-not $Check) {
                Set-Content -LiteralPath $_.FullName -Value $formatted -NoNewline
            }

            return $true
        }
)

foreach ($file in $drifted) {
    Write-Output "[psscriptanalyzer] $($Check ? 'unformatted' : 'formatted'): $($file.Name)"
}

if ($Check -and $drifted.Count -gt 0) {
    exit 1
}
