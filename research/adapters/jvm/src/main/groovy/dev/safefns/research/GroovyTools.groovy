package dev.safefns.research

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
            isSafeEmpty: [
                Probe.any('!value') { Object value -> !value },
            ],
            safeObjectHasOwn: [
                Probe.anyBinary('key in obj') { Object obj, Object key ->
                    key in obj
                },
            ],
            safeParseBoolean: [
                Probe.any('value as boolean') { Object value -> value as boolean },
                Probe.any('value.toBoolean()') { Object value -> value.toBoolean() },
            ],
            safeParseInteger: [
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
        ],
        'Groovy',
        2,
        GroovySystem.version
    )

    private GroovyTools() { }

}
