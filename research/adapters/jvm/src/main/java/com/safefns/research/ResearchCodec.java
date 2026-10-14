package com.safefns.research;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.nio.charset.CharacterCodingException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/**
 * The portable value format and adapter loop, for JVM adapters.
 *
 * <p>The twin of `scripts/research/codec.ts` and `research_codec.py`; the
 * `codec` case file checks that all three decode and re-encode identically.
 *
 * <ul>
 *   <li>A JSON integer decodes to a `Long` (a `BigInteger` past its range), a
 *       fraction to a `Double`, an array to a `List`, and an object to a
 *       `Map`.
 *   <li>`$bigint` decodes to a `BigInteger`, which always re-encodes as one.
 * </ul>
 */
public final class ResearchCodec {

  /**
   * The digits a `$bigint` payload may hold, with an optional minus sign.
   *
   * <p>ASCII only, like the TS twin; Java's `\d` is ASCII-only by default.
   */
  private static final Pattern BIGINT_PATTERN = Pattern.compile("-?\\d+");

  private static final JsonNodeFactory FACTORY = JsonNodeFactory.instance;

  private static final JsonMapper MAPPER = JsonMapper.builder().build();

  /**
   * The largest integer a JavaScript number holds exactly: 2^53 - 1.
   *
   * <p>A larger integer is encoded as `$bigint`, so the TS side never reads a
   * rounded number.
   */
  private static final long MAX_SAFE_INTEGER = (1L << 53) - 1;

  private ResearchCodec() {}

  /**
   * A value Java has no type for: `undefined`, or a `$js` value.
   *
   * @param payload the tag's payload, kept so the value re-encodes unchanged
   * @param tag the tag it was decoded from
   */
  public record Unrepresentable(JsonNode payload, String tag) {}

  /**
   * Report whether a decoded value holds anything Java can't express.
   *
   * @param value a decoded value
   * @return whether it, or anything inside it, is unrepresentable
   */
  static boolean containsUnrepresentable(final Object value) {
    if (value instanceof Unrepresentable) {
      return true;
    }

    if (value instanceof Collection<?> items) {
      return items.stream().anyMatch(ResearchCodec::containsUnrepresentable);
    }

    if (value instanceof Map<?, ?> entries) {
      return entries
        .values()
        .stream()
        .anyMatch(ResearchCodec::containsUnrepresentable);
    }

    return false;
  }

  /**
   * Decode a value from the portable format.
   *
   * @param encoded the encoded value
   * @return the decoded value
   * @throws IllegalArgumentException for a malformed tag, exactly where
   *     `decodeValue` throws
   */
  static Object decode(final JsonNode encoded) {
    if (encoded.isArray()) {
      // `toList`, not `Collectors.toList`: it keeps `null` items too.
      return encoded.valueStream().map(ResearchCodec::decode).toList();
    }

    if (!encoded.isObject()) {
      return decodeScalar(encoded);
    }

    final List<String> tags = encoded
      .propertyNames()
      .stream()
      .filter(key -> key.startsWith("$"))
      .toList();

    if (tags.isEmpty()) {
      return decodeEntries(encoded);
    }

    if (encoded.size() != 1) {
      throw new IllegalArgumentException(
        "a tag must be an object's only key: " + tags.get(0)
      );
    }

    return decodeTag(encoded.get(tags.get(0)), tags.get(0));
  }

  /**
   * Decode an object's entries, without reading its keys as tags.
   *
   * @param encoded an encoded object
   * @return a map of its decoded entries, in their original order
   */
  private static Map<String, Object> decodeEntries(final JsonNode encoded) {
    // Not `Collectors.toMap`, which rejects the `null` a JSON value can be.
    return encoded
      .propertyStream()
      .collect(
        LinkedHashMap::new,
        (entries, entry) ->
          entries.put(entry.getKey(), decode(entry.getValue())),
        Map::putAll
      );
  }

  /**
   * Decode a JSON scalar: a string, number, boolean, or `null`.
   *
   * @param encoded the scalar
   * @return its Java value
   */
  private static Object decodeScalar(final JsonNode encoded) {
    if (encoded.isString()) {
      return encoded.stringValue();
    }

    if (encoded.isBoolean()) {
      return encoded.booleanValue();
    }

    if (encoded.isIntegralNumber()) {
      return encoded.canConvertToLong()
        ? Long.valueOf(encoded.longValue())
        : encoded.bigIntegerValue();
    }

    if (encoded.isNumber()) {
      return encoded.doubleValue();
    }

    return null;
  }

  /**
   * Decode a `$number` payload.
   *
   * @param spelling `NaN`, `-0`, `Infinity`, or `-Infinity`
   * @return the double it names
   * @throws IllegalArgumentException for any other spelling
   */
  private static Double decodeSpecialNumber(final String spelling) {
    return switch (spelling) {
      case "-0" -> -0.0;
      case "-Infinity" -> Double.NEGATIVE_INFINITY;
      case "Infinity" -> Double.POSITIVE_INFINITY;
      case "NaN" -> Double.NaN;
      default -> throw new IllegalArgumentException(
        "not a special number: " + spelling
      );
    };
  }

  /**
   * Decode one tagged object, given its payload and tag.
   *
   * @param payload the tag's payload
   * @param tag the tag
   * @return the decoded value
   * @throws IllegalArgumentException for an unknown tag or a payload the tag
   *     doesn't accept
   */
  private static Object decodeTag(final JsonNode payload, final String tag) {
    if (tag.equals("$bigint") && payload.isString()) {
      if (!BIGINT_PATTERN.matcher(payload.stringValue()).matches()) {
        throw new IllegalArgumentException(
          "not an integer: " + payload.stringValue()
        );
      }

      return new BigInteger(payload.stringValue());
    }

    if (tag.equals("$js") && payload.isString()) {
      return new Unrepresentable(payload, tag);
    }

    if (tag.equals("$number") && payload.isString()) {
      return decodeSpecialNumber(payload.stringValue());
    }

    if (tag.equals("$object") && payload.isObject()) {
      return decodeEntries(payload);
    }

    if (
      tag.equals("$undefined") && payload.isBoolean() && payload.asBoolean()
    ) {
      return new Unrepresentable(payload, tag);
    }

    throw new IllegalArgumentException("unknown tag or bad payload: " + tag);
  }

  /**
   * Name a value the format can't spell, for `$repr`.
   *
   * <ul>
   *   <li>A `BigDecimal` keeps its digits and scale (`BigDecimal(1.50)`),
   *       since they are the point of returning one.
   *   <li>Anything else is named by its class.
   * </ul>
   *
   * @param value the value
   * @return its description
   */
  private static String describe(final Object value) {
    if (value instanceof BigDecimal decimal) {
      return "BigDecimal(" + decimal.toPlainString() + ")";
    }

    return value.getClass().getSimpleName();
  }

  /**
   * Encode a value into the portable format.
   *
   * <p>Anything the format has no tag for is described by `$repr`, which never
   * decodes.
   *
   * @param value any value a call returned
   * @return its encoding
   */
  static JsonNode encode(final Object value) {
    return switch (value) {
      case null -> FACTORY.nullNode();
      case Unrepresentable unrepresentable -> tagged(
        unrepresentable.tag(),
        unrepresentable.payload()
      );
      case Boolean bool -> FACTORY.booleanNode(bool);
      case CharSequence text -> FACTORY.stringNode(text.toString());
      case Character character -> FACTORY.stringNode(character.toString());
      case BigInteger bigint -> tagged(
        "$bigint",
        FACTORY.stringNode(bigint.toString())
      );
      case Byte number -> encodeLong(number);
      case Integer number -> encodeLong(number);
      case Long number -> encodeLong(number);
      case Short number -> encodeLong(number);
      case Double number -> encodeDouble(number);
      case Float number -> encodeDouble(number);
      case Collection<?> items -> encodeItems(items);
      case Map<?, ?> entries -> encodeEntries(entries);
      default -> tagged("$repr", FACTORY.stringNode(describe(value)));
    };
  }

  /**
   * Encode a double, tagging the values JSON can't hold.
   *
   * @param value the number
   * @return its encoding
   */
  private static JsonNode encodeDouble(final double value) {
    if (Double.isNaN(value)) {
      return tagged("$number", FACTORY.stringNode("NaN"));
    }

    if (Double.isInfinite(value)) {
      return tagged(
        "$number",
        FACTORY.stringNode(value > 0 ? "Infinity" : "-Infinity")
      );
    }

    if (value == 0 && Double.doubleToRawLongBits(value) != 0) {
      return tagged("$number", FACTORY.stringNode("-0"));
    }

    return FACTORY.numberNode(value);
  }

  /**
   * Encode a map, wrapped in `$object` when a key could pass for a tag.
   *
   * @param entries the map; a non-string key is described by `$repr`
   * @return its encoding
   */
  private static JsonNode encodeEntries(final Map<?, ?> entries) {
    if (!entries.keySet().stream().allMatch(String.class::isInstance)) {
      return tagged("$repr", FACTORY.stringNode(describe(entries)));
    }

    final ObjectNode encoded = entries
      .entrySet()
      .stream()
      .collect(
        FACTORY::objectNode,
        (node, entry) ->
          node.set((String) entry.getKey(), encode(entry.getValue())),
        ObjectNode::setAll
      );

    if (
      encoded
        .propertyNames()
        .stream()
        .anyMatch(key -> key.startsWith("$"))
    ) {
      return tagged("$object", encoded);
    }

    return encoded;
  }

  /**
   * Encode a collection as an array, in iteration order.
   *
   * @param items the collection
   * @return its encoding
   */
  private static JsonNode encodeItems(final Collection<?> items) {
    return FACTORY.arrayNode().addAll(
      items.stream().map(ResearchCodec::encode).toList()
    );
  }

  /**
   * Encode an integer, as a bigint once a JavaScript number would lose it.
   *
   * @param value the number
   * @return its encoding
   */
  private static JsonNode encodeLong(final long value) {
    // Not `Math.abs`, which overflows for `Long.MIN_VALUE`.
    if (value > MAX_SAFE_INTEGER || value < -MAX_SAFE_INTEGER) {
      return tagged("$bigint", FACTORY.stringNode(Long.toString(value)));
    }

    return FACTORY.numberNode(value);
  }

  /**
   * Read and parse one case file.
   *
   * <p>An unreadable file isn't wrapped as a JSON error: its `IOException`
   * already names it.
   *
   * @param path the file's path
   * @return its parsed JSON
   * @throws IllegalArgumentException naming the file when it isn't UTF-8 JSON
   * @throws UncheckedIOException when the file can't be read
   */
  private static JsonNode readCaseFile(final String path) {
    final String text;

    try {
      text = Files.readString(Path.of(path));
    } catch (final CharacterCodingException error) {
      throw new IllegalArgumentException(path + " isn't valid JSON", error);
    } catch (final IOException error) {
      throw new UncheckedIOException(error);
    }

    try {
      return MAPPER.readTree(text);
    } catch (final JacksonException error) {
      throw new IllegalArgumentException(path + " isn't valid JSON", error);
    }
  }

  /**
   * Run the case files named on the command line and print the columns.
   *
   * @param paths the case files' paths
   * @param tools every tool this adapter runs
   */
  public static void runAdapter(
    final List<String> paths,
    final List<Tool> tools
  ) {
    final String locale = Locale.getDefault().toLanguageTag();

    final List<ObjectNode> columns = paths
      .stream()
      .map(ResearchCodec::readCaseFile)
      .flatMap(caseFile -> runCaseFile(caseFile, tools, locale))
      .toList();

    final ObjectNode output = FACTORY.objectNode();
    output.set("columns", FACTORY.arrayNode().addAll(columns));
    System.out.print(MAPPER.writeValueAsString(output));
  }

  /**
   * Run every probe the tools offer for one case file's function.
   *
   * @param caseFile the parsed case file
   * @param tools every tool this adapter runs
   * @param locale the locale the JVM runs under, reported with each column
   * @return one column per probe
   */
  private static Stream<ObjectNode> runCaseFile(
    final JsonNode caseFile,
    final List<Tool> tools,
    final String locale
  ) {
    final String function = caseFile.get("function").stringValue();

    return tools.stream().flatMap(tool ->
      tool
        .functions()
        .getOrDefault(function, List.of())
        .stream()
        .map(probe -> {
          final List<ObjectNode> outcomes = caseFile
            .get("cases")
            .valueStream()
            .map(testCase -> runProbe(testCase.get("args"), probe))
            .toList();

          final ObjectNode column = FACTORY.objectNode()
            .put("call", probe.call())
            .put("function", function)
            .put("locale", locale)
            .put("name", tool.name())
            .put("tier", tool.tier())
            .put("version", tool.version());

          column.set("outcomes", FACTORY.arrayNode().addAll(outcomes));

          return column;
        })
    );
  }

  /**
   * Run one probe on one case's encoded arguments.
   *
   * @param args the case's encoded arguments
   * @param probe the probe
   * @return the outcome: `value`, `error`, or `n/a`
   */
  private static ObjectNode runProbe(final JsonNode args, final Probe probe) {
    final List<Object> decoded = args
      .valueStream()
      .map(ResearchCodec::decode)
      .toList();

    final ObjectNode outcome = FACTORY.objectNode();

    if (
      (!probe.isCodec() &&
        decoded.stream().anyMatch(ResearchCodec::containsUnrepresentable)) ||
      !probe.accepts().test(decoded)
    ) {
      return outcome.put("kind", "n/a");
    }

    try {
      final Object value = probe.run().run(decoded);

      return outcome.put("kind", "value").set("value", encode(value));
    } catch (final Exception error) {
      // Every failure is a result, never a crash.
      return outcome
        .put("error", error.getClass().getSimpleName())
        .put("kind", "error");
    }
  }

  /**
   * Build a single-key tagged object.
   *
   * @param tag the tag
   * @param payload its payload
   * @return the tagged object
   */
  private static ObjectNode tagged(final String tag, final JsonNode payload) {
    final ObjectNode node = FACTORY.objectNode();
    node.set(tag, payload);

    return node;
  }
}
