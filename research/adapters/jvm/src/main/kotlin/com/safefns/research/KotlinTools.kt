package com.safefns.research

/**
 * Kotlin's standard library.
 *
 * - Each probe takes only the receiver type its function is declared on, so a
 *   `String?` extension also takes `null`.
 */
object KotlinTools {
    /** The probes, keyed by function. */
    @JvmField
    val TOOL =
        Tool(
            functions =
                mapOf(
                    "isSafeEmpty" to
                        listOf(
                            Probe.nullable(
                                "collection.isNullOrEmpty()",
                                Collection::class.java,
                            ) { collection ->
                                collection.isNullOrEmpty()
                            },
                            Probe.nullable(
                                "map.isNullOrEmpty()",
                                Map::class.java,
                            ) { map ->
                                map.isNullOrEmpty()
                            },
                            Probe.nullable(
                                "string.isNullOrBlank()",
                                String::class.java,
                            ) { string ->
                                string.isNullOrBlank()
                            },
                            Probe.nullable(
                                "string.isNullOrEmpty()",
                                String::class.java,
                            ) { string ->
                                string.isNullOrEmpty()
                            },
                        ),
                    "safeObjectHasOwn" to
                        listOf(
                            Probe.binary("key in map", Map::class.java) {
                                map,
                                key ->
                                key in map
                            }
                        ),
                    "safeParseBoolean" to
                        listOf(
                            Probe.nullable(
                                "value.toBoolean()",
                                String::class.java,
                            ) { value ->
                                value.toBoolean()
                            },
                            Probe.typed(
                                "value.toBooleanStrict()",
                                String::class.java,
                            ) { value ->
                                value.toBooleanStrict()
                            },
                            Probe.typed(
                                "value.toBooleanStrictOrNull()",
                                String::class.java,
                            ) { value ->
                                value.toBooleanStrictOrNull()
                            },
                        ),
                    "safeParseInteger" to
                        listOf(
                            Probe.typed(
                                "value.toIntOrNull()",
                                String::class.java,
                            ) { value ->
                                value.toIntOrNull()
                            },
                            Probe.typed(
                                "value.toLongOrNull()",
                                String::class.java,
                            ) { value ->
                                value.toLongOrNull()
                            },
                        ),
                    "safeParseNumber" to
                        listOf(
                            Probe.typed(
                                "value.toDoubleOrNull()",
                                String::class.java,
                            ) { value ->
                                value.toDoubleOrNull()
                            }
                        ),
                    "safeParseString" to
                        listOf(
                            Probe.any("value.toString()") { value ->
                                value.toString()
                            },
                            Probe.typed("value.trim()", String::class.java) {
                                value ->
                                value.trim()
                            },
                        ),
                ),
            name = "Kotlin",
            tier = 2,
            version = KotlinVersion.CURRENT.toString(),
        )
}
