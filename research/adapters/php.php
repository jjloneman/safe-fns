<?php

/**
 * The PHP adapter: runs each case file through PHP's built-in functions.
 *
 * Usage: `php php.php <case-file>...`, inside the `php` Compose service.
 */

require __DIR__ . "/research_codec.php";

use ResearchCodec\Probe;
use ResearchCodec\Tool;

use function ResearchCodec\runAdapter;

runAdapter([
    new Tool(
        functions: [
            "codec" => [
                new Probe(
                    call: "value",
                    isCodec: true,
                    run: static fn(mixed $value): mixed => $value,
                ),
            ],
            "isPlainObject" => [
                new Probe(
                    call: '$value instanceof stdClass',
                    run: static fn(mixed $value): bool => $value instanceof
                        stdClass,
                ),
            ],
            "isSafeEmpty" => [
                new Probe(
                    call: 'empty($value)',
                    run: static fn(mixed $value): bool => empty($value),
                ),
            ],
            "safeJsonStringify" => [
                new Probe(
                    call: 'json_encode($value, JSON_THROW_ON_ERROR)',
                    run: static fn(mixed $value): string => json_encode(
                        $value,
                        JSON_THROW_ON_ERROR,
                    ),
                ),
            ],
            "safeObjectHasOwn" => [
                new Probe(
                    call: 'property_exists($object, $key)',
                    run: static fn(
                        mixed $object,
                        mixed $key,
                    ): bool => property_exists($object, $key),
                ),
            ],
            "safeParseBoolean" => [
                new Probe(
                    call: 'filter_var($value, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE)',
                    run: static fn(mixed $value): ?bool => filter_var(
                        $value,
                        FILTER_VALIDATE_BOOL,
                        FILTER_NULL_ON_FAILURE,
                    ),
                ),
                new Probe(
                    call: '(bool) $value',
                    run: static fn(mixed $value): bool => (bool) $value,
                ),
            ],
            "safeParseInteger" => [
                new Probe(
                    call: 'intval($value)',
                    run: static fn(mixed $value): int => intval($value),
                ),
                new Probe(
                    call: 'filter_var($value, FILTER_VALIDATE_INT)',
                    run: static fn(mixed $value): mixed => filter_var(
                        $value,
                        FILTER_VALIDATE_INT,
                    ),
                ),
            ],
            "safeParseJson" => [
                new Probe(
                    call: 'json_decode($value, flags: JSON_THROW_ON_ERROR)',
                    run: static fn(string $value): mixed => json_decode(
                        $value,
                        flags: JSON_THROW_ON_ERROR,
                    ),
                    accepts: static fn(mixed ...$args): bool => is_string(
                        $args[0],
                    ),
                ),
            ],
            "safeParseNumber" => [
                new Probe(
                    call: 'floatval($value)',
                    run: static fn(mixed $value): float => floatval($value),
                ),
                new Probe(
                    call: 'filter_var($value, FILTER_VALIDATE_FLOAT)',
                    run: static fn(mixed $value): mixed => filter_var(
                        $value,
                        FILTER_VALIDATE_FLOAT,
                    ),
                ),
            ],
            "safeParseString" => [
                new Probe(
                    call: 'strval($value)',
                    run: static fn(mixed $value): string => strval($value),
                ),
                new Probe(
                    call: 'trim(strval($value))',
                    run: static fn(mixed $value): string => trim(
                        strval($value),
                    ),
                ),
            ],
            "safeParseUrl" => [
                new Probe(
                    call: 'parse_url($value)',
                    run: static fn(string $value): array|false => parse_url(
                        $value,
                    ),
                    accepts: static fn(mixed ...$args): bool => count($args) ===
                        1 && is_string($args[0]),
                ),
            ],
        ],
        name: "PHP",
        tier: 4,
        version: PHP_VERSION,
    ),
]);
