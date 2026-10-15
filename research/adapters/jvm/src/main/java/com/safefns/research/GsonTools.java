package com.safefns.research;

import com.google.gson.Gson;
import java.util.List;
import java.util.Map;

/**
 * Gson, with a default `Gson`; reading into `Object` gives maps, lists, and
 * doubles, as a caller with no class to bind does.
 */
final class GsonTools {

  private static final Gson GSON = new Gson();

  /** The probes, keyed by function. */
  static final Tool TOOL = new Tool(
    Map.of(
      "safeJsonStringify",
      List.of(Probe.any("gson.toJson(value)", GSON::toJson)),
      "safeParseJson",
      List.of(
        Probe.typed("gson.fromJson(value, Object.class)", String.class, value ->
          GSON.fromJson(value, Object.class)
        )
      )
    ),
    "Gson",
    2,
    Versions.fromPom("com.google.code.gson", "gson")
  );

  private GsonTools() {}
}
