package com.safefns.research;

import static java.util.Map.entry;

import com.google.common.base.CaseFormat;
import com.google.common.base.CharMatcher;
import com.google.common.base.Strings;
import com.google.common.net.UrlEscapers;
import com.google.common.primitives.Doubles;
import com.google.common.primitives.Ints;
import com.google.common.primitives.Longs;
import java.util.List;
import java.util.Map;

/** Google Guava. */
final class GuavaTools {

  /** The probes, keyed by function. */
  static final Tool TOOL = new Tool(
    Map.ofEntries(
      entry(
        "camelCase",
        List.of(
          Probe.typed(
            "CaseFormat.UPPER_CAMEL.to(CaseFormat.LOWER_CAMEL, value)",
            String.class,
            value -> CaseFormat.UPPER_CAMEL.to(CaseFormat.LOWER_CAMEL, value)
          ).alone()
        )
      ),
      entry(
        "constantCase",
        List.of(
          Probe.typed(
            "CaseFormat.LOWER_CAMEL.to(CaseFormat.UPPER_UNDERSCORE, value)",
            String.class,
            value ->
              CaseFormat.LOWER_CAMEL.to(CaseFormat.UPPER_UNDERSCORE, value)
          ).alone()
        )
      ),
      entry(
        "isSafeEmpty",
        List.of(
          Probe.nullable(
            "Strings.isNullOrEmpty(value)",
            String.class,
            Strings::isNullOrEmpty
          )
        )
      ),
      entry(
        "kebabCase",
        List.of(
          Probe.typed(
            "CaseFormat.LOWER_CAMEL.to(CaseFormat.LOWER_HYPHEN, value)",
            String.class,
            value -> CaseFormat.LOWER_CAMEL.to(CaseFormat.LOWER_HYPHEN, value)
          ).alone()
        )
      ),
      entry(
        "pascalCase",
        List.of(
          Probe.typed(
            "CaseFormat.LOWER_CAMEL.to(CaseFormat.UPPER_CAMEL, value)",
            String.class,
            value -> CaseFormat.LOWER_CAMEL.to(CaseFormat.UPPER_CAMEL, value)
          ).alone()
        )
      ),
      entry(
        "safeEncodeUriComponent",
        List.of(
          Probe.typed(
            "UrlEscapers.urlPathSegmentEscaper().escape(value)",
            String.class,
            value -> UrlEscapers.urlPathSegmentEscaper().escape(value)
          ),
          Probe.typed(
            "UrlEscapers.urlFormParameterEscaper().escape(value)",
            String.class,
            value -> UrlEscapers.urlFormParameterEscaper().escape(value)
          )
        )
      ),
      entry(
        "safeParseInt",
        List.of(
          Probe.typed("Ints.tryParse(value)", String.class, Ints::tryParse),
          Probe.typed("Longs.tryParse(value)", String.class, Longs::tryParse)
        )
      ),
      entry(
        "safeParseNumber",
        List.of(
          Probe.typed(
            "Doubles.tryParse(value)",
            String.class,
            Doubles::tryParse
          )
        )
      ),
      entry(
        "safeParseString",
        List.of(
          Probe.nullable(
            "Strings.nullToEmpty(value)",
            String.class,
            Strings::nullToEmpty
          )
        )
      ),
      entry(
        "snakeCase",
        List.of(
          Probe.typed(
            "CaseFormat.LOWER_CAMEL.to(CaseFormat.LOWER_UNDERSCORE, value)",
            String.class,
            value ->
              CaseFormat.LOWER_CAMEL.to(CaseFormat.LOWER_UNDERSCORE, value)
          ).alone()
        )
      ),
      entry(
        "trimBlank",
        List.of(
          Probe.typed(
            "CharMatcher.whitespace().trimFrom(value)",
            String.class,
            value -> CharMatcher.whitespace().trimFrom(value)
          )
        )
      )
    ),
    "Guava",
    2,
    Versions.fromPom("com.google.guava", "guava")
  );

  private GuavaTools() {}
}
