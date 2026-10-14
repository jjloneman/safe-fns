<?php

/**
 * The portable value format and adapter loop, for the PHP adapter.
 *
 * - The twin of `scripts/research/codec.ts`; the `codec` case file checks
 *   that both decode and re-encode identically.
 *
 * - A JSON object decodes to `stdClass` and an array to a list, as
 *   `json_decode` gives them, so `{}` and `[]` stay apart.
 *
 * - A `$bigint` decodes to an `int` for a probe when it fits in one, and to
 *   `n/a` otherwise; only the codec probe gets a `JsBigInt`.
 *
 * - Calls run in PHP's default coercive mode, not `strict_types`.
 */

namespace ResearchCodec;

/** The digits a `$bigint` payload may hold, with an optional minus sign. */
const BIGINT_PATTERN = "/\A-?[0-9]+\z/";

/** The largest integer a JavaScript number holds exactly: 2**53 - 1. */
const MAX_SAFE_INTEGER = 9007199254740991;

/** A `$bigint` decoded for the codec probe, so it re-encodes as one. */
final class JsBigInt
{
    /** Keep the digits, so the value re-encodes unchanged. */
    public function __construct(public readonly string $digits) {}
}

/** One expression a tool offers for a function. */
final class Probe
{
    /**
     * Describe a probe.
     *
     * @param string $call The expression, as the table header shows it.
     * @param \Closure $run Runs the expression on one case's decoded
     *   arguments.
     * @param ?\Closure $accepts Whether the call can take these arguments at
     *   all (`n/a` otherwise), or null to accept anything.
     * @param bool $isCodec Whether this is the codec round-trip, which sees
     *   every value.
     */
    public function __construct(
        public readonly string $call,
        public readonly \Closure $run,
        public readonly ?\Closure $accepts = null,
        public readonly bool $isCodec = false,
    ) {}
}

/** A library or runtime, and its probes for each function. */
final class Tool
{
    /**
     * Describe a tool.
     *
     * @param array<string, list<Probe>> $functions Probes keyed by the
     *   function name in a case file.
     * @param string $name The display name.
     * @param int $tier The table tier.
     * @param string $version The version that actually ran.
     */
    public function __construct(
        public readonly array $functions,
        public readonly string $name,
        public readonly int $tier,
        public readonly string $version,
    ) {}
}

/** A value PHP has no type for: `undefined`, a `$js` value, or a bigint. */
final class Unrepresentable
{
    /** Keep the tag and payload, so the value re-encodes unchanged. */
    public function __construct(
        public readonly mixed $payload,
        public readonly string $tag,
    ) {}
}

/**
 * Spell an integer's digits as PHP prints the int: no leading zeros, no `-0`.
 *
 * - Comparing that spelling with `(string) (int)` tells an overflow apart
 *   from digits that merely aren't canonical.
 */
function canonicalDigits(string $digits): string
{
    $trimmed = preg_replace("/\A(-?)0+(?=[0-9])/", '$1', $digits);

    return $trimmed === "-0" ? "0" : $trimmed;
}

/** Report whether a decoded value holds anything PHP can't express. */
function containsUnrepresentable(mixed $value): bool
{
    if ($value instanceof Unrepresentable) {
        return true;
    }

    if (is_array($value) || $value instanceof \stdClass) {
        foreach ((array) $value as $item) {
            if (containsUnrepresentable($item)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Decode a value from the portable format.
 *
 * @throws \InvalidArgumentException for a malformed tag, exactly where
 *   `decodeValue` throws.
 */
function decode(mixed $encoded, bool $isCodec): mixed
{
    if (is_array($encoded)) {
        return array_map(
            static fn(mixed $item): mixed => decode(
                encoded: $item,
                isCodec: $isCodec,
            ),
            $encoded,
        );
    }

    if (!($encoded instanceof \stdClass)) {
        return $encoded;
    }

    $entries = (array) $encoded;
    $tags = array_values(
        array_filter(
            array_keys($entries),
            static fn(int|string $key): bool => str_starts_with(
                (string) $key,
                '$',
            ),
        ),
    );

    if ($tags === []) {
        return decodeEntries(entries: $entries, isCodec: $isCodec);
    }

    if (count($entries) !== 1) {
        throw new \InvalidArgumentException(
            "a tag must be an object's only key: {$tags[0]}",
        );
    }

    return decodeTag(
        isCodec: $isCodec,
        payload: $entries[$tags[0]],
        tag: (string) $tags[0],
    );
}

/** Decode a plain object's values, keeping it a `stdClass`. */
function decodeEntries(array $entries, bool $isCodec): \stdClass
{
    return (object) array_map(
        static fn(mixed $item): mixed => decode(
            encoded: $item,
            isCodec: $isCodec,
        ),
        $entries,
    );
}

/**
 * Decode one tagged object, given its tag and payload.
 *
 * @throws \InvalidArgumentException for an unknown tag or a payload the tag
 *   doesn't accept.
 */
function decodeTag(bool $isCodec, mixed $payload, string $tag): mixed
{
    if ($tag === '$bigint' && is_string($payload)) {
        if (preg_match(BIGINT_PATTERN, $payload) !== 1) {
            throw new \InvalidArgumentException("not an integer: {$payload}");
        }

        if ($isCodec) {
            return new JsBigInt($payload);
        }

        $digits = canonicalDigits($payload);
        $integer = (int) $digits;

        return (string) $integer === $digits
            ? $integer
            : new Unrepresentable(payload: $payload, tag: $tag);
    }

    if ($tag === '$js' && is_string($payload)) {
        return new Unrepresentable(payload: $payload, tag: $tag);
    }

    if ($tag === '$number' && is_string($payload)) {
        return match ($payload) {
            "-0" => -0.0,
            "-Infinity" => -INF,
            "Infinity" => INF,
            "NaN" => NAN,
            default => throw new \InvalidArgumentException(
                "not a special number: {$payload}",
            ),
        };
    }

    if ($tag === '$object' && $payload instanceof \stdClass) {
        return decodeEntries(entries: (array) $payload, isCodec: $isCodec);
    }

    if ($tag === '$undefined' && $payload === true) {
        return new Unrepresentable(payload: $payload, tag: $tag);
    }

    throw new \InvalidArgumentException("unknown tag or bad payload: {$tag}");
}

/**
 * Encode a value into the portable format.
 *
 * - A list encodes as an array, and any other PHP array as an object.
 *
 * - Anything the format has no tag for is described by `$repr`, which never
 *   decodes.
 */
function encode(mixed $value): mixed
{
    if ($value instanceof Unrepresentable) {
        return (object) [$value->tag => $value->payload];
    }

    if ($value instanceof JsBigInt) {
        return (object) ['$bigint' => $value->digits];
    }

    if (is_bool($value) || is_string($value) || $value === null) {
        return $value;
    }

    if (is_int($value)) {
        return abs($value) > MAX_SAFE_INTEGER
            ? (object) ['$bigint' => (string) $value]
            : $value;
    }

    if (is_float($value)) {
        return encodeFloat($value);
    }

    if (is_array($value) && array_is_list($value)) {
        return array_map(encode(...), $value);
    }

    if (is_array($value) || $value instanceof \stdClass) {
        return encodeEntries((array) $value);
    }

    return (object) ['$repr' => get_debug_type($value)];
}

/** Encode an object's entries, in `$object` when a key could pass for a tag. */
function encodeEntries(array $entries): \stdClass
{
    $encoded = (object) array_map(encode(...), $entries);

    foreach (array_keys($entries) as $key) {
        if (str_starts_with((string) $key, '$')) {
            return (object) ['$object' => $encoded];
        }
    }

    return $encoded;
}

/** Encode a float, tagging the values JSON can't hold. */
function encodeFloat(float $value): mixed
{
    if (is_nan($value)) {
        return (object) ['$number' => "NaN"];
    }

    if (is_infinite($value)) {
        return (object) ['$number' => $value > 0 ? "Infinity" : "-Infinity"];
    }

    if ($value === 0.0 && fdiv(1, $value) < 0) {
        return (object) ['$number' => "-0"];
    }

    return $value;
}

/**
 * Run the case files named on the command line and print the columns.
 *
 * - A warning or deprecation is PHP's diagnostic, not a failure: the call
 *   still returns, so it's silenced rather than reported.
 *
 * @param list<Tool> $tools
 */
function runAdapter(array $tools): void
{
    set_error_handler(static fn(): bool => true);

    $columns = [];
    $locale = setlocale(LC_ALL, "");

    foreach (array_slice($GLOBALS["argv"], 1) as $path) {
        $caseFile = json_decode(
            file_get_contents($path),
            flags: JSON_THROW_ON_ERROR,
        );

        foreach ($tools as $tool) {
            foreach ($tool->functions[$caseFile->function] ?? [] as $probe) {
                $columns[] = [
                    "call" => $probe->call,
                    "function" => $caseFile->function,
                    "locale" => $locale,
                    "name" => $tool->name,
                    "outcomes" => array_map(
                        static fn(\stdClass $case): array => runProbe(
                            args: $case->args,
                            probe: $probe,
                        ),
                        $caseFile->cases,
                    ),
                    "tier" => $tool->tier,
                    "version" => $tool->version,
                ];
            }
        }
    }

    echo json_encode(
        ["columns" => $columns],
        JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION,
    );
}

/** Run one probe on one case's encoded arguments. */
function runProbe(array $args, Probe $probe): array
{
    $decoded = array_map(
        static fn(mixed $arg): mixed => decode(
            encoded: $arg,
            isCodec: $probe->isCodec,
        ),
        $args,
    );

    if (!$probe->isCodec && containsUnrepresentable($decoded)) {
        return ["kind" => "n/a"];
    }

    if ($probe->accepts !== null && !($probe->accepts)(...$decoded)) {
        return ["kind" => "n/a"];
    }

    try {
        return [
            "kind" => "value",
            "value" => encode(($probe->run)(...$decoded)),
        ];
    } catch (\Throwable $error) {
        // Every failure is a result, never a crash.
        return ["error" => get_class($error), "kind" => "error"];
    }
}
