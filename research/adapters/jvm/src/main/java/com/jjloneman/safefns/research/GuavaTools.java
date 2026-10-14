package com.jjloneman.safefns.research;

import com.google.common.base.Strings;
import com.google.common.primitives.Doubles;
import com.google.common.primitives.Ints;
import com.google.common.primitives.Longs;
import java.util.List;
import java.util.Map;

/** Google Guava. */
final class GuavaTools {

  /** The probes, keyed by function. */
  static final Tool TOOL = new Tool(
    Map.of(
      "isSafeEmpty",
      List.of(
        Probe.nullable(
          "Strings.isNullOrEmpty(value)",
          String.class,
          Strings::isNullOrEmpty
        )
      ),
      "safeParseInteger",
      List.of(
        Probe.typed("Ints.tryParse(value)", String.class, Ints::tryParse),
        Probe.typed("Longs.tryParse(value)", String.class, Longs::tryParse)
      ),
      "safeParseNumber",
      List.of(
        Probe.typed("Doubles.tryParse(value)", String.class, Doubles::tryParse)
      ),
      "safeParseString",
      List.of(
        Probe.nullable(
          "Strings.nullToEmpty(value)",
          String.class,
          Strings::nullToEmpty
        )
      )
    ),
    "Guava",
    2,
    Versions.fromPom("com.google.guava", "guava")
  );

  private GuavaTools() {}
}
