/*
 * The portable value format and adapter loop, for the .NET adapter.
 *
 * - The twin of `scripts/research/codec.ts` and `research_codec.py`; the
 *   `codec` case file checks that every twin decodes and re-encodes
 *   identically.
 *
 * - A case decodes into the closest BCL type: `string`, `bool`, `null`,
 *   `long` for an integer, `double` for anything else numeric, `BigInteger`
 *   for a `$bigint`, `List<object?>`, and `Dictionary<string, object?>`.
 */

using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Numerics;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace ResearchAdapter;

/// <summary>One expression a tool offers for a function.</summary>
/// <param name="Accepts">
/// Whether the call can take these arguments at all; `n/a` otherwise.
/// </param>
/// <param name="Call">The expression, as the table header shows it.</param>
/// <param name="Run">
/// Runs the expression on one case's decoded arguments.
/// </param>
internal sealed record Probe(
    Func<IReadOnlyList<object?>, bool> Accepts,
    string Call,
    Func<IReadOnlyList<object?>, object?> Run
);

/// <summary>A library or runtime, and its probes for each function.</summary>
/// <param name="Functions">
/// The probes, keyed by the function name in a case file.
/// </param>
/// <param name="Locale">The culture its calls run under.</param>
/// <param name="Name">The display name.</param>
/// <param name="Tier">The table tier.</param>
/// <param name="Version">The version that actually ran.</param>
internal sealed record Tool(
    IReadOnlyDictionary<string, IReadOnlyList<Probe>> Functions,
    string Locale,
    string Name,
    int Tier,
    string Version
);

/// <summary>
/// A value .NET has no type for: `undefined` or a `$js` value.
/// </summary>
internal sealed class Unrepresentable
{
    /// <summary>The one instance; the value carries nothing.</summary>
    public static readonly Unrepresentable Instance = new();

    private Unrepresentable() { }
}

/// <summary>Decodes and encodes values, and runs an adapter.</summary>
internal static partial class Codec
{
    /// <summary>
    /// The largest integer a JavaScript number holds exactly: 2^53 - 1.
    /// </summary>
    private const long MaxSafeInteger = (1L << 53) - 1;

    /// <summary>The spellings `$number` accepts, each with its value.</summary>
    private static readonly Dictionary<string, double> SpecialNumbers = new()
    {
        ["-0"] = -0.0,
        ["-Infinity"] = double.NegativeInfinity,
        ["Infinity"] = double.PositiveInfinity,
        ["NaN"] = double.NaN,
    };

    /// <summary>Accept any arguments.</summary>
    public static bool AcceptsAny(IReadOnlyList<object?> args) => true;

    /// <summary>Run the case files and print the columns to stdout.</summary>
    public static void RunAdapter(
        IReadOnlyList<string> paths,
        IReadOnlyList<Tool> tools
    )
    {
        var columns = new JsonArray(
            paths
                .SelectMany(path => RunCaseFile(path: path, tools: tools))
                .ToArray()
        );

        Console.Out.Write(
            new JsonObject { ["columns"] = columns }.ToJsonString()
        );
    }

    /// <summary>The digits a `$bigint` payload may hold, ASCII only.</summary>
    /// <remarks>
    /// `\z`, not `$`, which would also match before a trailing newline.
    /// </remarks>
    [GeneratedRegex(@"^-?[0-9]+\z")]
    private static partial Regex BigIntPattern();

    /// <summary>
    /// Report whether a value holds anything .NET can't express.
    /// </summary>
    private static bool ContainsUnrepresentable(object? value) =>
        value switch
        {
            Unrepresentable => true,
            List<object?> items => items.Any(ContainsUnrepresentable),
            Dictionary<string, object?> entries => entries.Values.Any(
                ContainsUnrepresentable
            ),
            _ => false,
        };

    /// <summary>Decode a value from the portable format.</summary>
    /// <exception cref="FormatException">
    /// For a malformed tag, exactly where `decodeValue` throws.
    /// </exception>
    private static object? Decode(JsonNode? encoded) =>
        encoded switch
        {
            null => null,
            JsonArray items => items.Select(Decode).ToList(),
            JsonObject entries => DecodeObject(entries),
            _ => DecodeScalar(encoded.GetValue<JsonElement>()),
        };

    /// <summary>Decode every value of an object, keeping its keys.</summary>
    private static Dictionary<string, object?> DecodeEntries(
        JsonObject entries
    ) => entries.ToDictionary(entry => entry.Key, entry => Decode(entry.Value));

    /// <summary>Decode a plain object, or the one tag it holds.</summary>
    private static object? DecodeObject(JsonObject entries)
    {
        var tag = entries
            .Select(entry => entry.Key)
            .FirstOrDefault(key => key.StartsWith('$'));

        if (tag is null)
        {
            return DecodeEntries(entries);
        }

        if (entries.Count != 1)
        {
            throw new FormatException(
                $"a tag must be an object's only key: {tag}"
            );
        }

        return DecodeTag(payload: entries[tag], tag: tag);
    }

    /// <summary>
    /// Decode a JSON scalar, reading a number as a `long` when it has no
    /// fraction or exponent, as Python does.
    /// </summary>
    /// <remarks>
    /// An integer past `long` becomes a `BigInteger`, which re-encodes as
    /// `$bigint`, as a Python int that large does.
    /// </remarks>
    internal static object? DecodeScalar(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Number)
        {
            return element.ValueKind switch
            {
                JsonValueKind.False => false,
                JsonValueKind.True => true,
                _ => element.GetString(),
            };
        }

        var rawText = element.GetRawText();

        if (rawText.AsSpan().ContainsAny(".eE"))
        {
            return element.GetDouble();
        }

        if (element.TryGetInt64(out var integer))
        {
            return integer;
        }

        return BigInteger.Parse(rawText, CultureInfo.InvariantCulture);
    }

    /// <summary>Decode one tagged object, given its tag and payload.</summary>
    private static object? DecodeTag(JsonNode? payload, string tag)
    {
        var text =
            payload?.GetValueKind() == JsonValueKind.String
                ? payload.GetValue<string>()
                : null;

        switch (tag)
        {
            case "$bigint" when text is not null:
                if (!BigIntPattern().IsMatch(text))
                {
                    throw new FormatException($"not an integer: {text}");
                }

                return BigInteger.Parse(text, CultureInfo.InvariantCulture);
            case "$js" when text is not null:
                return Unrepresentable.Instance;
            case "$number" when text is not null:
                return SpecialNumbers.TryGetValue(text, out var number)
                    ? number
                    : throw new FormatException(
                        $"not a special number: {text}"
                    );
            case "$object" when payload is JsonObject entries:
                return DecodeEntries(entries);
            case "$undefined"
                when payload?.GetValueKind() == JsonValueKind.True:
                return Unrepresentable.Instance;
            default:
                throw new FormatException($"unknown tag or bad payload: {tag}");
        }
    }

    /// <summary>
    /// Encode a value into the portable format; anything the format has no
    /// tag for is described by `$repr`, which never decodes.
    /// </summary>
    private static JsonNode? Encode(object? value) =>
        value switch
        {
            null => null,
            bool flag => flag,
            string text => text,
            BigInteger integer => Tagged(
                payload: integer.ToString(CultureInfo.InvariantCulture),
                tag: "$bigint"
            ),
            double number => EncodeDouble(number),
            int integer => EncodeInteger(integer),
            long integer => EncodeInteger(integer),
            List<object?> items => new JsonArray(
                items.Select(Encode).ToArray()
            ),
            Dictionary<string, object?> entries => EncodeEntries(entries),
            _ => Tagged(payload: value.GetType().Name, tag: "$repr"),
        };

    /// <summary>
    /// Encode a double, tagging the values JSON can't hold.
    /// </summary>
    private static JsonNode EncodeDouble(double number)
    {
        if (double.IsNaN(number))
        {
            return Tagged(payload: "NaN", tag: "$number");
        }

        if (double.IsInfinity(number))
        {
            var sign = number > 0 ? "Infinity" : "-Infinity";

            return Tagged(payload: sign, tag: "$number");
        }

        if (number == 0 && double.IsNegative(number))
        {
            return Tagged(payload: "-0", tag: "$number");
        }

        return number;
    }

    /// <summary>
    /// Encode a dictionary, wrapped in `$object` when a key could pass for a
    /// tag.
    /// </summary>
    private static JsonObject EncodeEntries(Dictionary<string, object?> entries)
    {
        var encoded = new JsonObject();

        foreach (var (key, item) in entries)
        {
            encoded[key] = Encode(item);
        }

        if (entries.Keys.Any(key => key.StartsWith('$')))
        {
            return new JsonObject { ["$object"] = encoded };
        }

        return encoded;
    }

    /// <summary>
    /// Encode an integer, as a bigint once a JavaScript number would lose it.
    /// </summary>
    private static JsonNode EncodeInteger(long integer)
    {
        if (integer > MaxSafeInteger || integer < -MaxSafeInteger)
        {
            return Tagged(
                payload: integer.ToString(CultureInfo.InvariantCulture),
                tag: "$bigint"
            );
        }

        return integer;
    }

    /// <summary>Read and parse one case file.</summary>
    private static JsonNode ReadCaseFile(string path)
    {
        try
        {
            return JsonNode.Parse(File.ReadAllText(path))!;
        }
        catch (JsonException error)
        {
            throw new InvalidDataException($"{path} isn't valid JSON", error);
        }
    }

    /// <summary>Run every tool's probes over one case file.</summary>
    private static IEnumerable<JsonNode> RunCaseFile(
        string path,
        IReadOnlyList<Tool> tools
    )
    {
        var caseFile = ReadCaseFile(path);
        var function = caseFile["function"]!.GetValue<string>();
        var cases = caseFile["cases"]!.AsArray();

        return tools.SelectMany(tool =>
            tool.Functions.GetValueOrDefault(function, [])
                .Select(probe => new JsonObject
                {
                    ["call"] = probe.Call,
                    ["function"] = function,
                    ["locale"] = tool.Locale,
                    ["name"] = tool.Name,
                    ["outcomes"] = new JsonArray(
                        cases
                            .Select(testCase =>
                                RunProbe(
                                    args: testCase!["args"]!.AsArray(),
                                    probe: probe
                                )
                            )
                            .ToArray()
                    ),
                    ["tier"] = tool.Tier,
                    ["version"] = tool.Version,
                })
        );
    }

    /// <summary>Run one probe on one case's encoded arguments.</summary>
    private static JsonObject RunProbe(JsonArray args, Probe probe)
    {
        var decoded = args.Select(Decode).ToList();

        if (decoded.Any(ContainsUnrepresentable) || !probe.Accepts(decoded))
        {
            return new JsonObject { ["kind"] = "n/a" };
        }

        try
        {
            return new JsonObject
            {
                ["kind"] = "value",
                ["value"] = Encode(probe.Run(decoded)),
            };
        }
#pragma warning disable CA1031 // Every failure is a result, never a crash.
        catch (Exception error)
#pragma warning restore CA1031
        {
            return new JsonObject
            {
                ["error"] = error.GetType().Name,
                ["kind"] = "error",
            };
        }
    }

    /// <summary>Build a single-key tagged object.</summary>
    private static JsonObject Tagged(string payload, string tag) =>
        new() { [tag] = payload };
}
