package com.safefns.research;

import static java.util.Map.entry;

import java.math.BigInteger;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/** Java's standard library. */
final class JavaTools {

  /** The probes, keyed by function; also the codec round-trip. */
  static final Tool TOOL = new Tool(
    Map.ofEntries(
      entry("codec", List.of(Probe.codec())),
      entry(
        "decodeBase64",
        List.of(
          Probe.typed(
            "new String(Base64.getDecoder().decode(value), UTF_8)",
            String.class,
            value ->
              new String(
                Base64.getDecoder().decode(value),
                StandardCharsets.UTF_8
              )
          ),
          Probe.typed(
            "new String(Base64.getMimeDecoder().decode(value), UTF_8)",
            String.class,
            value ->
              new String(
                Base64.getMimeDecoder().decode(value),
                StandardCharsets.UTF_8
              )
          ),
          Probe.typed(
            "new String(Base64.getUrlDecoder().decode(value), UTF_8)",
            String.class,
            value ->
              new String(
                Base64.getUrlDecoder().decode(value),
                StandardCharsets.UTF_8
              )
          )
        )
      ),
      entry(
        "encodeBase64",
        List.of(
          Probe.typed(
            "Base64.getEncoder().encodeToString(value.getBytes(UTF_8))",
            String.class,
            value ->
              Base64.getEncoder().encodeToString(
                value.getBytes(StandardCharsets.UTF_8)
              )
          )
        )
      ),
      entry(
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
        )
      ),
      entry(
        "safeDateToIsoString",
        List.of(
          Probe.typed(
            "Instant.ofEpochMilli((long) value).toString()",
            Number.class,
            value -> Instant.ofEpochMilli(value.longValue()).toString()
          )
        )
      ),
      entry(
        "safeDecodeUriComponent",
        List.of(
          Probe.typed("URLDecoder.decode(value, UTF_8)", String.class, value ->
            URLDecoder.decode(value, StandardCharsets.UTF_8)
          )
        )
      ),
      entry(
        "safeEncodeUriComponent",
        List.of(
          Probe.typed("URLEncoder.encode(value, UTF_8)", String.class, value ->
            URLEncoder.encode(value, StandardCharsets.UTF_8)
          )
        )
      ),
      entry(
        "safeObjectHasOwn",
        List.of(
          Probe.binary("map.containsKey(key)", Map.class, Map::containsKey)
        )
      ),
      entry(
        "safeParseBigInt",
        List.of(
          Probe.typed("new BigInteger(value)", String.class, BigInteger::new)
        )
      ),
      entry(
        "safeParseBoolean",
        List.of(
          Probe.nullable(
            "Boolean.parseBoolean(value)",
            String.class,
            Boolean::parseBoolean
          )
        )
      ),
      entry(
        "safeParseDate",
        List.of(
          Probe.typed(
            "OffsetDateTime.parse(value).toInstant().toString()",
            String.class,
            value -> OffsetDateTime.parse(value).toInstant().toString()
          )
        )
      ),
      entry(
        "safeParseInt",
        List.of(
          Probe.typed(
            "Integer.parseInt(value)",
            String.class,
            Integer::parseInt
          ),
          Probe.typed("Long.parseLong(value)", String.class, Long::parseLong)
        )
      ),
      entry(
        "safeParseNumber",
        List.of(
          Probe.typed(
            "Double.parseDouble(value)",
            String.class,
            Double::parseDouble
          )
        )
      ),
      entry(
        "safeParseRegExp",
        List.of(
          new Probe(
            JavaTools::isLoneString,
            "Pattern.compile(value).pattern()",
            false,
            args -> Pattern.compile((String) args.get(0)).pattern()
          )
        )
      ),
      entry(
        "safeParseString",
        List.of(
          Probe.any("String.valueOf(value)", String::valueOf),
          Probe.any("String.valueOf(value).strip()", value ->
            String.valueOf(value).strip()
          )
        )
      ),
      entry(
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
