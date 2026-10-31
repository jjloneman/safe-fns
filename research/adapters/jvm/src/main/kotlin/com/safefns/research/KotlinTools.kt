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
                    "deepMerge" to
                        listOf(
                            Probe.mapPair("defaults + overrides") {
                                defaults,
                                overrides ->
                                defaults + overrides
                            }
                        ),
                    "isDeepEqual" to
                        listOf(
                            Probe.anyBinary("a == b") { a, b -> a == b }.pair()
                        ),
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
                    "keyBy" to
                        listOf(
                            Probe.listKey("items.associateBy { it[key] }") {
                                items,
                                key ->
                                items.associateBy { (it as Map<*, *>)[key] }
                            }
                        ),
                    "lowerFirst" to
                        listOf(
                            Probe.typed(
                                    "value.replaceFirstChar { it.lowercase() }",
                                    String::class.java,
                                ) { value ->
                                    value.replaceFirstChar { it.lowercase() }
                                }
                                .alone()
                        ),
                    "range" to
                        listOf(
                            Probe.intRange(
                                "(start until end step step).toList()"
                            ) { start, end, step ->
                                (start until end step step).toList()
                            }
                        ),
                    "safeObjectHasOwn" to
                        listOf(
                            Probe.binary("key in map", Map::class.java) {
                                map,
                                key ->
                                key in map
                            }
                        ),
                    "safeParseBigInt" to
                        listOf(
                            Probe.typed(
                                "value.toBigIntegerOrNull()",
                                String::class.java,
                            ) { value ->
                                value.toBigIntegerOrNull()
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
                    "safeParseInt" to
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
                    "trimBlank" to
                        listOf(
                            Probe.typed("value.trim()", String::class.java) {
                                value ->
                                value.trim()
                            }
                        ),
                    "upperFirst" to
                        listOf(
                            Probe.typed(
                                    "value.replaceFirstChar { it.titlecase() }",
                                    String::class.java,
                                ) { value ->
                                    value.replaceFirstChar { it.titlecase() }
                                }
                                .alone(),
                            Probe.typed(
                                    "value.replaceFirstChar { it.uppercase() }",
                                    String::class.java,
                                ) { value ->
                                    value.replaceFirstChar { it.uppercase() }
                                }
                                .alone(),
                        ),
                ),
            name = "Kotlin",
            tier = 2,
            version = KotlinVersion.CURRENT.toString(),
        )
}
