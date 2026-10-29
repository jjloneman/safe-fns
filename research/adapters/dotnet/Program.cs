/*
 * The .NET adapter: runs each case file through the base class library.
 *
 * - Usage: `dotnet ResearchAdapter.dll <case-file>...`, the `dotnet` Compose
 *   service.
 *
 * - Every call runs under `InvariantCulture`; `double.Parse` also gets a
 *   column per extra culture, since its answer follows the culture it's given.
 */

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Numerics;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ResearchAdapter;

/// <summary>Lists the .NET probes and runs them.</summary>
internal static class Program
{
    /// <summary>
    /// The cultures that get their own `double.Parse` column.
    /// </summary>
    /// <remarks>
    /// Both use a decimal comma; they differ in the group separator (`.` and
    /// U+202F), which ICU supplies.
    /// </remarks>
    private static readonly string[] ExtraCultures = ["de-DE", "fr-FR"];

    /// <summary>The runtime that actually ran.</summary>
    private static readonly string Version = Environment.Version.ToString();

    /// <summary>
    /// Accept exactly two string arguments: a value and a base.
    /// </summary>
    private static bool AreTwoStrings(IReadOnlyList<object?> args) =>
        args is [string, string];

    /// <summary>
    /// Convert a parsed JSON element into the codec's BCL types, reading no
    /// `$` key as a tag; a repeated key keeps its last value.
    /// </summary>
    private static object? FromJson(JsonElement element) =>
        element.ValueKind switch
        {
            JsonValueKind.Array => element
                .EnumerateArray()
                .Select(FromJson)
                .ToList(),
            JsonValueKind.Null => null,
            JsonValueKind.Object => element
                .EnumerateObject()
                .Aggregate(
                    new Dictionary<string, object?>(),
                    (entriesByKey, property) =>
                    {
                        entriesByKey[property.Name] = FromJson(property.Value);

                        return entriesByKey;
                    }
                ),
            _ => Codec.DecodeScalar(element),
        };

    /// <summary>
    /// Accept a dictionary first argument and a string second.
    /// </summary>
    private static bool IsDictionaryAndString(IReadOnlyList<object?> args) =>
        args[0] is Dictionary<string, object?> && args[1] is string;

    /// <summary>
    /// Accept exactly one argument: an integer, or a finite number a cast to
    /// `long` truncates.
    /// </summary>
    private static bool IsMillis(IReadOnlyList<object?> args) =>
        args is [long] || (args is [double number] && double.IsFinite(number));

    /// <summary>Accept exactly one argument, a string.</summary>
    /// <summary>Accept a string and options holding only <c>locale</c>.</summary>
    private static bool IsStringWithLocale(IReadOnlyList<object?> args) =>
        args.Count == 2
        && args[0] is string
        && args[1] is Dictionary<string, object?> { Count: 1 } options
        && options.TryGetValue("locale", out var locale)
        && locale is string;

    /// <summary>Read the <c>locale</c> tag from a case's options.</summary>
    private static string LocaleOf(IReadOnlyList<object?> args) =>
        (string)((Dictionary<string, object?>)args[1]!)["locale"]!;

    private static bool IsLoneString(IReadOnlyList<object?> args) =>
        args is [string];

    /// <summary>Accept only a string first argument.</summary>
    private static bool IsString(IReadOnlyList<object?> args) =>
        args[0] is string;

    /// <summary>Accept a string or `null` first argument.</summary>
    private static bool IsStringOrNull(IReadOnlyList<object?> args) =>
        args[0] is string or null;

    /// <summary>
    /// The first argument as whole milliseconds, once `IsMillis` accepted it.
    /// </summary>
    private static long Millis(IReadOnlyList<object?> args) =>
        args[0] is long integer ? integer : (long)(double)args[0]!;

    /// <summary>Run the case files named on the command line.</summary>
    private static void Main(string[] args)
    {
        // Nothing may fall back to the host's culture.
        CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
        CultureInfo.CurrentUICulture = CultureInfo.InvariantCulture;

        Codec.RunAdapter(paths: args, tools: Tools());
    }

    /// <summary>
    /// Parse JSON text with `JsonDocument.Parse`, as BCL values.
    /// </summary>
    private static object? ParseJson(string text)
    {
        using var document = JsonDocument.Parse(text);

        return FromJson(document.RootElement);
    }

    /// <summary>
    /// The first argument as a string, once `IsString` accepted it.
    /// </summary>
    private static string Text(IReadOnlyList<object?> args) => (string)args[0]!;

    /// <summary>List the probes, one tool per culture.</summary>
    private static List<Tool> Tools()
    {
        var invariant = CultureInfo.InvariantCulture;

        var invariantTool = new Tool(
            Functions: new Dictionary<string, IReadOnlyList<Probe>>
            {
                ["codec"] =
                [
                    new(
                        Accepts: Codec.AcceptsAny,
                        Call: "value",
                        Run: args => args[0]
                    ),
                ],
                ["decodeBase64"] =
                [
                    new(
                        Accepts: IsString,
                        Call: "Encoding.UTF8.GetString(Convert.FromBase64String(value))",
                        Run: args =>
                            Encoding.UTF8.GetString(
                                Convert.FromBase64String(Text(args))
                            )
                    ),
                    new(
                        Accepts: IsString,
                        Call: "new UTF8Encoding(false, true).GetString(Convert.FromBase64String(value))",
                        Run: args =>
                            new UTF8Encoding(false, true).GetString(
                                Convert.FromBase64String(Text(args))
                            )
                    ),
                ],
                ["encodeBase64"] =
                [
                    new(
                        Accepts: IsString,
                        Call: "Convert.ToBase64String(Encoding.UTF8.GetBytes(value))",
                        Run: args =>
                            Convert.ToBase64String(
                                Encoding.UTF8.GetBytes(Text(args))
                            )
                    ),
                ],
                ["isSafeEmpty"] =
                [
                    new(
                        Accepts: IsStringOrNull,
                        Call: "string.IsNullOrEmpty(value)",
                        Run: args => string.IsNullOrEmpty((string?)args[0])
                    ),
                    new(
                        Accepts: IsStringOrNull,
                        Call: "string.IsNullOrWhiteSpace(value)",
                        Run: args => string.IsNullOrWhiteSpace((string?)args[0])
                    ),
                ],
                ["lowerFirst"] =
                [
                    new(
                        Accepts: IsLoneString,
                        Call: "value.Length == 0 ? value : char.ToLowerInvariant(value[0]) + value[1..]",
                        Run: args =>
                            Text(args).Length == 0
                                ? Text(args)
                                : char.ToLowerInvariant(Text(args)[0])
                                    + Text(args)[1..]
                    ),
                    new(
                        Accepts: IsStringWithLocale,
                        Call: "value.Length == 0 ? value : char.ToLower(value[0], CultureInfo.GetCultureInfo(locale)) + value[1..]",
                        Run: args =>
                            Text(args).Length == 0
                                ? Text(args)
                                : char.ToLower(
                                    Text(args)[0],
                                    CultureInfo.GetCultureInfo(LocaleOf(args))
                                ) + Text(args)[1..]
                    ),
                ],
                ["safeDateToIsoString"] =
                [
                    new(
                        Accepts: IsMillis,
                        Call: "DateTimeOffset.FromUnixTimeMilliseconds((long)value).ToString(\"o\", InvariantCulture)",
                        Run: args =>
                            DateTimeOffset
                                .FromUnixTimeMilliseconds(Millis(args))
                                .ToString("o", invariant)
                    ),
                ],
                ["safeDecodeUriComponent"] =
                [
                    new(
                        Accepts: IsString,
                        Call: "Uri.UnescapeDataString(value)",
                        Run: args => Uri.UnescapeDataString(Text(args))
                    ),
                    new(
                        Accepts: IsString,
                        Call: "WebUtility.UrlDecode(value)",
                        Run: args => WebUtility.UrlDecode(Text(args))
                    ),
                ],
                ["safeEncodeUriComponent"] =
                [
                    new(
                        Accepts: IsString,
                        Call: "Uri.EscapeDataString(value)",
                        Run: args => Uri.EscapeDataString(Text(args))
                    ),
                    new(
                        Accepts: IsString,
                        Call: "WebUtility.UrlEncode(value)",
                        Run: args => WebUtility.UrlEncode(Text(args))
                    ),
                ],
                ["safeJsonStringify"] =
                [
                    new(
                        Accepts: Codec.AcceptsAny,
                        Call: "JsonSerializer.Serialize(value)",
                        Run: args => JsonSerializer.Serialize(args[0])
                    ),
                ],
                ["safeObjectHasOwn"] =
                [
                    new(
                        Accepts: IsDictionaryAndString,
                        Call: "dictionary.ContainsKey(key)",
                        Run: args =>
                            ((Dictionary<string, object?>)args[0]!).ContainsKey(
                                (string)args[1]!
                            )
                    ),
                ],
                ["safeParseBigInt"] =
                [
                    new(
                        Accepts: IsString,
                        Call: "BigInteger.Parse(value, InvariantCulture)",
                        Run: args => BigInteger.Parse(Text(args), invariant)
                    ),
                ],
                ["safeParseBoolean"] =
                [
                    new(
                        Accepts: IsString,
                        Call: "bool.Parse(value)",
                        Run: args => bool.Parse(Text(args))
                    ),
                    new(
                        Accepts: Codec.AcceptsAny,
                        Call: "Convert.ToBoolean(value, InvariantCulture)",
                        Run: args => Convert.ToBoolean(args[0], invariant)
                    ),
                ],
                ["safeParseDate"] =
                [
                    new(
                        Accepts: IsString,
                        Call: "DateTimeOffset.Parse(value, InvariantCulture).UtcDateTime.ToString(\"o\", InvariantCulture)",
                        Run: args =>
                            DateTimeOffset
                                .Parse(Text(args), invariant)
                                .UtcDateTime.ToString("o", invariant)
                    ),
                ],
                ["safeParseInt"] =
                [
                    new(
                        Accepts: IsString,
                        Call: "int.Parse(value, InvariantCulture)",
                        Run: args => int.Parse(Text(args), invariant)
                    ),
                    new(
                        Accepts: IsString,
                        Call: "long.Parse(value, InvariantCulture)",
                        Run: args => long.Parse(Text(args), invariant)
                    ),
                    new(
                        Accepts: Codec.AcceptsAny,
                        Call: "Convert.ToInt64(value, InvariantCulture)",
                        Run: args => Convert.ToInt64(args[0], invariant)
                    ),
                ],
                ["safeParseJson"] =
                [
                    new(
                        Accepts: IsString,
                        Call: "JsonDocument.Parse(value)",
                        Run: args => ParseJson(Text(args))
                    ),
                ],
                ["safeParseNumber"] =
                [
                    new(
                        Accepts: IsString,
                        Call: "double.Parse(value, InvariantCulture)",
                        Run: args => double.Parse(Text(args), invariant)
                    ),
                    new(
                        Accepts: Codec.AcceptsAny,
                        Call: "Convert.ToDouble(value, InvariantCulture)",
                        Run: args => Convert.ToDouble(args[0], invariant)
                    ),
                ],
                ["safeParseRegExp"] =
                [
                    new(
                        Accepts: IsLoneString,
                        Call: "new Regex(value).ToString()",
                        Run: args => new Regex(Text(args)).ToString()
                    ),
                ],
                ["safeParseString"] =
                [
                    new(
                        Accepts: Codec.AcceptsAny,
                        Call: "Convert.ToString(value, InvariantCulture)",
                        Run: args => Convert.ToString(args[0], invariant)
                    ),
                    new(
                        Accepts: IsString,
                        Call: "value.Trim()",
                        Run: args => Text(args).Trim()
                    ),
                ],
                ["safeParseUrl"] =
                [
                    new(
                        Accepts: IsLoneString,
                        Call: "Uri.TryCreate(value, UriKind.Absolute, out var uri) ? uri.AbsoluteUri : null",
                        Run: args =>
                            Uri.TryCreate(
                                Text(args),
                                UriKind.Absolute,
                                out var uri
                            )
                                ? uri.AbsoluteUri
                                : null
                    ),
                    new(
                        Accepts: AreTwoStrings,
                        Call: "Uri.TryCreate(new Uri(base), value, out var uri) ? uri.AbsoluteUri : null",
                        Run: args =>
                            Uri.TryCreate(
                                new Uri((string)args[1]!),
                                Text(args),
                                out var uri
                            )
                                ? uri.AbsoluteUri
                                : null
                    ),
                ],
                ["toBasicAscii"] =
                [
                    new(
                        Accepts: IsString,
                        Call: "string.Concat(value.Normalize(FormD).Where(c => GetUnicodeCategory(c) != NonSpacingMark))",
                        Run: args =>
                            string.Concat(
                                Text(args)
                                    .Normalize(NormalizationForm.FormD)
                                    .Where(c =>
                                        CharUnicodeInfo.GetUnicodeCategory(c)
                                        != UnicodeCategory.NonSpacingMark
                                    )
                            )
                    ),
                    new(
                        Accepts: IsString,
                        Call: "Encoding.ASCII.GetString(Encoding.ASCII.GetBytes(value))",
                        Run: args =>
                            Encoding.ASCII.GetString(
                                Encoding.ASCII.GetBytes(Text(args))
                            )
                    ),
                ],
                ["trimBlank"] =
                [
                    new(
                        Accepts: IsString,
                        Call: "value.Trim()",
                        Run: args => Text(args).Trim()
                    ),
                ],
                ["upperFirst"] =
                [
                    new(
                        Accepts: IsLoneString,
                        Call: "value.Length == 0 ? value : char.ToUpperInvariant(value[0]) + value[1..]",
                        Run: args =>
                            Text(args).Length == 0
                                ? Text(args)
                                : char.ToUpperInvariant(Text(args)[0])
                                    + Text(args)[1..]
                    ),
                    new(
                        Accepts: IsStringWithLocale,
                        Call: "value.Length == 0 ? value : char.ToUpper(value[0], CultureInfo.GetCultureInfo(locale)) + value[1..]",
                        Run: args =>
                            Text(args).Length == 0
                                ? Text(args)
                                : char.ToUpper(
                                    Text(args)[0],
                                    CultureInfo.GetCultureInfo(LocaleOf(args))
                                ) + Text(args)[1..]
                    ),
                ],
            },
            Locale: "invariant",
            Name: ".NET",
            Tier: 2,
            Version: Version
        );

        var cultureTools = ExtraCultures.Select(name =>
        {
            var culture = CultureInfo.GetCultureInfo(name);

            return new Tool(
                Functions: new Dictionary<string, IReadOnlyList<Probe>>
                {
                    ["safeParseNumber"] =
                    [
                        new(
                            Accepts: IsString,
                            Call: $"double.Parse(value, \"{name}\")",
                            Run: args => double.Parse(Text(args), culture)
                        ),
                    ],
                },
                Locale: name,
                Name: ".NET",
                Tier: 2,
                Version: Version
            );
        });

        return [invariantTool, .. cultureTools];
    }
}
