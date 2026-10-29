<#
.SYNOPSIS
    The portable value format and adapter loop, for the PowerShell adapter.

.DESCRIPTION
    The twin of scripts/research/codec.ts; the codec case file checks that
    both decode and re-encode identically.

    - A JSON object decodes to an ordered hashtable and an array to an
      object[], as ConvertFrom-Json -AsHashtable gives them; date-like
      strings stay strings.

    - A $bigint decodes to PowerShell's own [bigint], which always re-encodes
      as one; an ordinary integer is an [long].

    - PowerShell unrolls an array written to the pipeline, so every function
      here that can return one returns it with the unary comma (return , $x),
      which survives being captured where Write-Output -NoEnumerate doesn't.
#>

Set-StrictMode -Version Latest

# The integer types that encode as a number, or as a bigint past 2**53 - 1.
$IntegerTypes = @(
    [byte], [int16], [int32], [int64], [sbyte], [uint16], [uint32], [uint64]
)

# The largest integer a JavaScript number holds exactly: 2**53 - 1.
$MaxSafeInteger = 9007199254740991

# The spellings $number accepts, each with its value.
$SpecialNumbers = @{
    '-0'        = [double]::NegativeZero
    '-Infinity' = [double]::NegativeInfinity
    'Infinity'  = [double]::PositiveInfinity
    'NaN'       = [double]::NaN
}

<# A value PowerShell has no type for: undefined, or a $js value. #>
class Unrepresentable {
    # The tag's payload, kept so the value re-encodes unchanged.
    [object] $Payload

    # The tag, such as $undefined.
    [string] $Tag
}

<#
.SYNOPSIS
    Convert each item of a list, keeping any array a converter returns whole.

.DESCRIPTION
    A pipeline would unroll an array item, so this collects into a list.
#>
function ConvertAll {
    param([System.Collections.IEnumerable] $Items, [scriptblock] $Converter)

    $converted = [System.Collections.Generic.List[object]]::new()

    foreach ($item in $Items) {
        $converted.Add((& $Converter $item))
    }

    return , $converted.ToArray()
}

<#
.SYNOPSIS
    Decode a plain object's values, into the OrderedHashtable that
    ConvertFrom-Json -AsHashtable builds.
#>
function ConvertFrom-EncodedEntry {
    param([System.Collections.IDictionary] $Entries)

    $decoded = [System.Management.Automation.OrderedHashtable]::new()

    foreach ($key in $Entries.Keys) {
        $decoded[$key] = ConvertFrom-EncodedValue $Entries[$key]
    }

    return $decoded
}

<#
.SYNOPSIS
    Decode one tagged object, given its tag and payload.

.DESCRIPTION
    Throws for an unknown tag or a payload the tag doesn't accept.
#>
function ConvertFrom-EncodedTag {
    param([AllowNull()] [object] $Payload, [string] $Tag)

    if ($Tag -ceq '$bigint' -and $Payload -is [string]) {
        if ($Payload -cnotmatch '\A-?[0-9]+\z') {
            throw "not an integer: $Payload"
        }

        return [bigint]::Parse(
            $Payload,
            [cultureinfo]::InvariantCulture
        )
    }

    if ($Tag -ceq '$js' -and $Payload -is [string]) {
        return [Unrepresentable]@{ Payload = $Payload; Tag = $Tag }
    }

    if ($Tag -ceq '$number' -and $Payload -is [string]) {
        if (-not $SpecialNumbers.ContainsKey($Payload)) {
            throw "not a special number: $Payload"
        }

        return $SpecialNumbers[$Payload]
    }

    if ($Tag -ceq '$object' -and $Payload -is [System.Collections.IDictionary]) {
        return ConvertFrom-EncodedEntry $Payload
    }

    if ($Tag -ceq '$undefined' -and $Payload -eq $true) {
        return [Unrepresentable]@{ Payload = $Payload; Tag = $Tag }
    }

    throw "unknown tag or bad payload: $Tag"
}

<#
.SYNOPSIS
    Decode a value from the portable format.

.DESCRIPTION
    Throws for a malformed tag, exactly where decodeValue throws.
#>
function ConvertFrom-EncodedValue {
    param([AllowNull()] [object] $Encoded)

    if ($Encoded -is [array]) {
        return , (
            ConvertAll -Items $Encoded -Converter ${function:ConvertFrom-EncodedValue}
        )
    }

    if ($Encoded -isnot [System.Collections.IDictionary]) {
        return $Encoded
    }

    $tags = @($Encoded.Keys | Where-Object { $_.StartsWith('$') })

    if ($tags.Count -eq 0) {
        return ConvertFrom-EncodedEntry $Encoded
    }

    if ($Encoded.Count -ne 1) {
        throw "a tag must be an object's only key: $($tags[0])"
    }

    return , (ConvertFrom-EncodedTag -Payload $Encoded[$tags[0]] -Tag $tags[0])
}

<#
.SYNOPSIS
    Encode a double, tagging the values JSON can't hold.
#>
function ConvertTo-EncodedDouble {
    param([double] $Value)

    if ([double]::IsNaN($Value)) {
        return [ordered]@{ '$number' = 'NaN' }
    }

    if ([double]::IsInfinity($Value)) {
        return [ordered]@{ '$number' = $Value -gt 0 ? 'Infinity' : '-Infinity' }
    }

    if ([double]::IsNegative($Value) -and $Value -eq 0) {
        return [ordered]@{ '$number' = '-0' }
    }

    return $Value
}

<#
.SYNOPSIS
    Encode a dictionary, wrapped in $object when a key could pass for a tag.
#>
function ConvertTo-EncodedEntry {
    param([System.Collections.IDictionary] $Entries)

    $encoded = [ordered]@{}

    foreach ($key in $Entries.Keys) {
        if ($key -isnot [string]) {
            return [ordered]@{ '$repr' = $Entries.GetType().Name }
        }

        $encoded[$key] = ConvertTo-EncodedValue $Entries[$key]
    }

    if (@($encoded.Keys | Where-Object { $_.StartsWith('$') }).Count -gt 0) {
        return [ordered]@{ '$object' = $encoded }
    }

    return $encoded
}

<#
.SYNOPSIS
    Encode a value into the portable format.

.DESCRIPTION
    Anything the format has no tag for is described by $repr, which never
    decodes.
#>
function ConvertTo-EncodedValue {
    param([AllowNull()] [object] $Value)

    if ($null -eq $Value -or $Value -is [bool] -or $Value -is [string]) {
        return $Value
    }

    if ($Value -is [Unrepresentable]) {
        return [ordered]@{ $Value.Tag = $Value.Payload }
    }

    if ($Value -is [bigint]) {
        return [ordered]@{ '$bigint' = $Value.ToString() }
    }

    if ($IntegerTypes | Where-Object { $Value -is $_ }) {
        if ([bigint]::Abs($Value) -gt $MaxSafeInteger) {
            return [ordered]@{ '$bigint' = $Value.ToString() }
        }

        return [long] $Value
    }

    if ($Value -is [double] -or $Value -is [single] -or $Value -is [decimal]) {
        return ConvertTo-EncodedDouble ([double] $Value)
    }

    if ($Value -is [System.Collections.IDictionary]) {
        return ConvertTo-EncodedEntry $Value
    }

    if ($Value -is [array] -or $Value -is [System.Collections.IList]) {
        return , (
            ConvertAll -Items $Value -Converter ${function:ConvertTo-EncodedValue}
        )
    }

    return [ordered]@{ '$repr' = $Value.GetType().Name }
}

<#
.SYNOPSIS
    Name what a probe threw.

.DESCRIPTION
    PowerShell wraps a .NET method's exception in MethodInvocationException;
    the outcome names the .NET exception inside it.
#>
function Get-ErrorName {
    param([System.Management.Automation.ErrorRecord] $ErrorRecord)

    $exception = $ErrorRecord.Exception

    if (
        $exception -is [System.Management.Automation.MethodInvocationException] -and
        $null -ne $exception.InnerException
    ) {
        $exception = $exception.InnerException
    }

    return $exception.GetType().Name
}

<#
.SYNOPSIS
    Run the case files named on the command line and print the columns.

.PARAMETER Paths
    The case files.

.PARAMETER Tools
    Each tool: a hashtable with Functions (probes keyed by function name),
    Name, Tier, Version, and optionally Locale, the culture its calls name
    (the process's own culture otherwise). A probe is a hashtable with Call, Run (a script
    block), and optionally IsCodec and Accepts (a script block over the decoded arguments;
    a case it rejects is n/a).
#>
function Invoke-Adapter {
    param([string[]] $Paths, [hashtable[]] $Tools)

    $cultureName = (Get-Culture).Name
    $processLocale = $cultureName -eq '' ? 'invariant' : $cultureName

    $columns = foreach ($path in $Paths) {
        $caseFile = Get-Content -LiteralPath $path -Raw -Encoding utf8 |
            ConvertFrom-Json -AsHashtable -DateKind String -Depth 100

        foreach ($tool in $Tools) {
            foreach ($probe in @($tool.Functions[$caseFile.function])) {
                if ($null -eq $probe) {
                    continue
                }

                [ordered]@{
                    call     = $probe.Call
                    function = $caseFile.function
                    locale   = $tool['Locale'] ?? $processLocale
                    name     = $tool.Name
                    outcomes = [object[]] @($caseFile.cases | ForEach-Object {
                            Invoke-Probe -Arguments $_.args -Probe $probe
                        })
                    tier     = $tool.Tier
                    version  = $tool.Version
                }
            }
        }
    }

    [ordered]@{ columns = [object[]] @($columns) } |
        ConvertTo-Json -Compress -Depth 100 -EscapeHandling EscapeNonAscii
}

<#
.SYNOPSIS
    Run one probe on one case's encoded arguments.
#>
function Invoke-Probe {
    param([object[]] $Arguments, [hashtable] $Probe)

    $decoded = ConvertAll -Items $Arguments `
        -Converter ${function:ConvertFrom-EncodedValue}

    if (
        -not $Probe['IsCodec'] -and
        @($decoded | Where-Object { Test-Unrepresentable $_ }).Count -gt 0
    ) {
        return [ordered]@{ kind = 'n/a' }
    }

    if ($Probe['Accepts'] -and -not (& $Probe.Accepts @decoded)) {
        return [ordered]@{ kind = 'n/a' }
    }

    try {
        $result = & $Probe.Run @decoded

        return [ordered]@{
            kind  = 'value'
            value = ConvertTo-EncodedValue $result
        }
    } catch {
        # Every failure is a result, never a crash.
        return [ordered]@{ error = Get-ErrorName $_; kind = 'error' }
    }
}

<#
.SYNOPSIS
    Report whether a decoded value holds anything PowerShell can't express.
#>
function Test-Unrepresentable {
    param([AllowNull()] [object] $Value)

    if ($Value -is [Unrepresentable]) {
        return $true
    }

    if ($Value -is [System.Collections.IDictionary]) {
        return @($Value.Values | Where-Object { Test-Unrepresentable $_ }).Count -gt 0
    }

    if ($Value -is [array]) {
        return @($Value | Where-Object { Test-Unrepresentable $_ }).Count -gt 0
    }

    return $false
}

Export-ModuleMember -Function Invoke-Adapter
