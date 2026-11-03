package com.safefns.research;

import static java.util.Map.entry;

import java.util.List;
import java.util.Map;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.SerializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Jackson's `databind`, with a default `JsonMapper`; reading into `Object`
 * gives maps, lists, and boxed numbers, as a caller with no class to bind does.
 */
final class JacksonTools {

  private static final JsonMapper MAPPER = JsonMapper.builder().build();

  private static final JsonMapper SORTING_MAPPER = JsonMapper.builder()
    .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
    .build();

  /** The probes, keyed by function. */
  static final Tool TOOL = new Tool(
    Map.ofEntries(
      entry(
        "camelCase",
        List.of(
          Probe.typed(
            "PropertyNamingStrategies.LOWER_CAMEL_CASE" +
              ".nameForField(null, null, value)",
            String.class,
            value ->
              PropertyNamingStrategies.LOWER_CAMEL_CASE.nameForField(
                null,
                null,
                value
              )
          ).alone()
        )
      ),
      entry(
        "constantCase",
        List.of(
          Probe.typed(
            "PropertyNamingStrategies.UPPER_SNAKE_CASE" +
              ".nameForField(null, null, value)",
            String.class,
            value ->
              PropertyNamingStrategies.UPPER_SNAKE_CASE.nameForField(
                null,
                null,
                value
              )
          ).alone()
        )
      ),
      entry(
        "deepSortObject",
        List.of(
          Probe.typed(
            "sortingMapper.writeValueAsString(mapper.readValue(value, " +
              "Object.class))",
            String.class,
            value ->
              SORTING_MAPPER.writeValueAsString(
                MAPPER.readValue(value, Object.class)
              )
          )
        )
      ),
      entry(
        "dotCase",
        List.of(
          Probe.typed(
            "PropertyNamingStrategies.LOWER_DOT_CASE" +
              ".nameForField(null, null, value)",
            String.class,
            value ->
              PropertyNamingStrategies.LOWER_DOT_CASE.nameForField(
                null,
                null,
                value
              )
          ).alone()
        )
      ),
      entry(
        "flatCase",
        List.of(
          Probe.typed(
            "PropertyNamingStrategies.LOWER_CASE" +
              ".nameForField(null, null, value)",
            String.class,
            value ->
              PropertyNamingStrategies.LOWER_CASE.nameForField(
                null,
                null,
                value
              )
          ).alone()
        )
      ),
      entry(
        "kebabCase",
        List.of(
          Probe.typed(
            "PropertyNamingStrategies.KEBAB_CASE" +
              ".nameForField(null, null, value)",
            String.class,
            value ->
              PropertyNamingStrategies.KEBAB_CASE.nameForField(
                null,
                null,
                value
              )
          ).alone()
        )
      ),
      entry(
        "pascalCase",
        List.of(
          Probe.typed(
            "PropertyNamingStrategies.UPPER_CAMEL_CASE" +
              ".nameForField(null, null, value)",
            String.class,
            value ->
              PropertyNamingStrategies.UPPER_CAMEL_CASE.nameForField(
                null,
                null,
                value
              )
          ).alone()
        )
      ),
      entry(
        "safeJsonStringify",
        List.of(
          Probe.any(
            "mapper.writeValueAsString(value)",
            MAPPER::writeValueAsString
          )
        )
      ),
      entry(
        "safeParseJson",
        List.of(
          Probe.typed(
            "mapper.readValue(value, Object.class)",
            String.class,
            value -> MAPPER.readValue(value, Object.class)
          )
        )
      ),
      entry(
        "snakeCase",
        List.of(
          Probe.typed(
            "PropertyNamingStrategies.SNAKE_CASE" +
              ".nameForField(null, null, value)",
            String.class,
            value ->
              PropertyNamingStrategies.SNAKE_CASE.nameForField(
                null,
                null,
                value
              )
          ).alone()
        )
      )
    ),
    "Jackson",
    2,
    Versions.fromPom("tools.jackson.core", "jackson-databind")
  );

  private JacksonTools() {}
}
