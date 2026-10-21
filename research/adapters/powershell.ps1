<#
.SYNOPSIS
    The PowerShell adapter: runs each case file through PowerShell's casts
    and the .NET methods it calls.

.DESCRIPTION
    Usage: pwsh -File powershell.ps1 <case-file>..., inside the powershell
    Compose service. Each probe is a script block whose parameters are the
    case's arguments.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'research_codec.psm1')

$powerShell = @{
    Functions = @{
        codec            = @(
            @{
                Call    = 'value'
                IsCodec = $true
                Run     = { param($value) , $value }
            }
        )
        isPlainObject    = @(
            @{ Call = '$value -is [hashtable]'; Run = { param($value) $value -is [hashtable] } }
        )
        isSafeEmpty      = @(
            @{ Call = '-not $value'; Run = { param($value) -not $value } }
        )
        safeObjectHasOwn = @(
            @{
                Call = '$object.ContainsKey($key)'
                Run  = { param($object, $key) $object.ContainsKey($key) }
            }
        )
        safeParseBoolean = @(
            @{ Call = '[bool]$value'; Run = { param($value) [bool]$value } }
            @{ Call = '[bool]::Parse($value)'; Run = { param($value) [bool]::Parse($value) } }
            @{
                Call = '[System.Convert]::ToBoolean($value)'
                Run  = { param($value) [System.Convert]::ToBoolean($value) }
            }
        )
        safeParseInt     = @(
            @{ Call = '[int]$value'; Run = { param($value) [int]$value } }
            @{ Call = '[int]::Parse($value)'; Run = { param($value) [int]::Parse($value) } }
            @{ Call = '$value -as [int]'; Run = { param($value) $value -as [int] } }
        )
        safeParseNumber  = @(
            @{ Call = '[double]$value'; Run = { param($value) [double]$value } }
            @{
                Call = '[double]::Parse($value)'
                Run  = { param($value) [double]::Parse($value) }
            }
            @{ Call = '$value -as [double]'; Run = { param($value) $value -as [double] } }
        )
        safeParseString  = @(
            @{ Call = '[string]$value'; Run = { param($value) [string]$value } }
            @{
                Call = '([string]$value).Trim()'
                Run  = { param($value) ([string]$value).Trim() }
            }
        )
    }
    Name      = 'PowerShell'
    Tier      = 4
    Version   = $PSVersionTable.PSVersion.ToString()
}

<#
.SYNOPSIS
    Describe [double]::Parse under one named culture, as its own tool, since a
    column reports one locale.
#>
function New-CultureTool {
    param([string] $Culture)

    return @{
        Functions = @{
            safeParseNumber = @(
                @{
                    Call = "[double]::Parse(`$value, [cultureinfo]'$Culture')"
                    Run  = {
                        param($value)
                        [double]::Parse($value, [cultureinfo]$Culture)
                    }.GetNewClosure()
                }
            )
        }
        Locale    = $Culture
        Name      = 'PowerShell'
        Tier      = 4
        Version   = $PSVersionTable.PSVersion.ToString()
    }
}

Invoke-Adapter -Paths $args -Tools @(
    $powerShell
    New-CultureTool -Culture 'de-DE'
    New-CultureTool -Culture 'fr-FR'
)
