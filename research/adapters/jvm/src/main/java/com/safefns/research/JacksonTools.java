package com.safefns.research;

import java.util.List;
import java.util.Map;
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
    Map.of(
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
      ),
      "safeJsonStringify",
      List.of(
        Probe.any(
          "mapper.writeValueAsString(value)",
          MAPPER::writeValueAsString
        )
      ),
      "safeParseJson",
      List.of(
        Probe.typed(
          "mapper.readValue(value, Object.class)",
          String.class,
          value -> MAPPER.readValue(value, Object.class)
        )
      )
    ),
    "Jackson",
    2,
    Versions.fromPom("tools.jackson.core", "jackson-databind")
  );

  private JacksonTools() {}
}
