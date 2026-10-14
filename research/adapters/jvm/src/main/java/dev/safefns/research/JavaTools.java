package dev.safefns.research;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/** Java's standard library. */
final class JavaTools {

  /** The probes, keyed by function; also the codec round-trip. */
  static final Tool TOOL = new Tool(
    Map.of(
      "codec",
      List.of(Probe.codec()),
      "isSafeEmpty",
      List.of(
        Probe.typed(
          "collection.isEmpty()",
          Collection.class,
          Collection::isEmpty
        ),
        Probe.typed("map.isEmpty()", Map.class, Map::isEmpty),
        Probe.typed("string.isBlank()", String.class, String::isBlank),
        Probe.typed("string.isEmpty()", String.class, String::isEmpty)
      ),
      "safeObjectHasOwn",
      List.of(
        Probe.binary("map.containsKey(key)", Map.class, Map::containsKey)
      ),
      "safeParseBoolean",
      List.of(
        Probe.nullable(
          "Boolean.parseBoolean(value)",
          String.class,
          Boolean::parseBoolean
        )
      ),
      "safeParseInteger",
      List.of(
        Probe.typed("Integer.parseInt(value)", String.class, Integer::parseInt),
        Probe.typed("Long.parseLong(value)", String.class, Long::parseLong)
      ),
      "safeParseNumber",
      List.of(
        Probe.typed(
          "Double.parseDouble(value)",
          String.class,
          Double::parseDouble
        )
      ),
      "safeParseString",
      List.of(
        Probe.any("String.valueOf(value)", String::valueOf),
        Probe.any("String.valueOf(value).strip()", value ->
          String.valueOf(value).strip()
        )
      )
    ),
    "Java",
    2,
    Runtime.version().toString()
  );

  private JavaTools() {}
}
