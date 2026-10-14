/*
 * The .NET adapter: runs each case file through the base class library.
 *
 * - Usage: `dotnet run -- <case-file>...`, inside the `dotnet` Compose
 *   service.
 *
 * - Every call runs under `InvariantCulture`; `double.Parse` also gets a
 *   column per extra culture, since its answer follows the culture it's given.
 */

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

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
    /// Accept a dictionary first argument and a string second.
    /// </summary>
    private static bool IsDictionaryAndString(IReadOnlyList<object?> args) =>
        args[0] is Dictionary<string, object?> && args[1] is string;

    /// <summary>Accept only a string first argument.</summary>
    private static bool IsString(IReadOnlyList<object?> args) =>
        args[0] is string;

    /// <summary>Accept a string or `null` first argument.</summary>
    private static bool IsStringOrNull(IReadOnlyList<object?> args) =>
        args[0] is string or null;

    /// <summary>Run the case files named on the command line.</summary>
    private static void Main(string[] args)
    {
        // Nothing may fall back to the host's culture.
        CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
        CultureInfo.CurrentUICulture = CultureInfo.InvariantCulture;

        Codec.RunAdapter(paths: args, tools: Tools());
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
                ["safeParseInteger"] =
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
