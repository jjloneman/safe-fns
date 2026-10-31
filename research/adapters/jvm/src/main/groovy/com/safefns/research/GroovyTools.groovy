package com.safefns.research

import groovy.transform.CompileDynamic

/**
 * Groovy's GDK methods and Groovy truth.
 *
 * `@CompileDynamic`, not `@CompileStatic`, since dispatch at run time is what
 * these probes measure: every probe takes any value, and a type with no such
 * method reports `MissingMethodException`.
 */
@CompileDynamic
final class GroovyTools {

    /** The probes, keyed by function. */
    static final Tool TOOL = new Tool(
        [
            deepMerge: [
                Probe.mapPair('defaults + overrides') { Map defaults, Map overrides ->
                    defaults + overrides
                },
            ],
            isDeepEqual: [
                Probe.anyBinary('a == b') { Object a, Object b -> a == b }.pair(),
            ],
            isSafeEmpty: [
                Probe.any('!value') { Object value -> !value },
            ],
            keyBy: [
                Probe.listKey('items.collectEntries { item -> [(item[key]): item] }') { List items, String key ->
                    items.collectEntries { item -> [(item[key]): item] }
                },
            ],
            lowerFirst: [
                Probe.typed('value.uncapitalize()', String) { String value -> value.uncapitalize() }.alone(),
            ],
            range: [
                Probe.intRange('(start..<end).step(step)') { int start, int end, int step ->
                    (start..<end).step(step)
                },
            ],
            safeObjectHasOwn: [
                Probe.anyBinary('key in obj') { Object obj, Object key ->
                    key in obj
                },
            ],
            safeParseBigInt: [
                Probe.any('value as BigInteger') { Object value ->
                    value as BigInteger
                },
                Probe.any('value.toBigInteger()') { Object value ->
                    value.toBigInteger()
                },
            ],
            safeParseBoolean: [
                Probe.any('value as boolean') { Object value -> value as boolean },
                Probe.any('value.toBoolean()') { Object value -> value.toBoolean() },
            ],
            safeParseInt: [
                Probe.any('value as Integer') { Object value -> value as Integer },
                Probe.any('value.toInteger()') { Object value -> value.toInteger() },
            ],
            safeParseNumber: [
                Probe.any('value as Double') { Object value -> value as Double },
                Probe.any('value.toBigDecimal()') { Object value ->
                    value.toBigDecimal()
                },
                Probe.any('value.toDouble()') { Object value -> value.toDouble() },
            ],
            safeParseString: [
                Probe.any('"$value"') { Object value -> "$value" },
                Probe.any('value.toString()') { Object value -> value.toString() },
            ],
            upperFirst: [
                Probe.typed('value.capitalize()', String) { String value -> value.capitalize() }.alone(),
            ],
        ],
        'Groovy',
        2,
        GroovySystem.version
    )

    private GroovyTools() { }

}
