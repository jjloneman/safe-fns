package com.safefns.research;

import java.net.URI;
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
      ),
      "safeParseUrl",
      List.of(
        new Probe(
          JavaTools::isLoneString,
          "new URI(value).toString()",
          false,
          args -> new URI((String) args.get(0)).toString()
        ),
        new Probe(
          JavaTools::areTwoStrings,
          "new URI(base).resolve(value).toString()",
          false,
          args ->
            new URI((String) args.get(1))
              .resolve((String) args.get(0))
              .toString()
        )
      )
    ),
    "Java",
    2,
    Runtime.version().toString()
  );

  private JavaTools() {}

  /**
   * Accept exactly two string arguments: a value and a base.
   *
   * @param args the decoded arguments
   * @return whether both are strings
   */
  private static boolean areTwoStrings(final List<Object> args) {
    return (
      args.size() == 2 &&
      args.get(0) instanceof String &&
      args.get(1) instanceof String
    );
  }

  /**
   * Accept exactly one argument, a string.
   *
   * @param args the decoded arguments
   * @return whether it is a lone string
   */
  private static boolean isLoneString(final List<Object> args) {
    return args.size() == 1 && args.get(0) instanceof String;
  }
}
