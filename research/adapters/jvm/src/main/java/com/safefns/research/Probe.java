package com.safefns.research;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * One expression a tool offers for a function.
 *
 * @param accepts whether the call can take these arguments at all; `n/a`
 *     otherwise
 * @param call the expression, as the table header shows it
 * @param isCodec whether this is the codec round-trip, which sees every value
 * @param run runs the expression on one case's decoded arguments
 */
public record Probe(Accepts accepts, String call, boolean isCodec, Call run) {
  /**
   * The most items an `int` range probe builds; a longer span is `n/a`, since
   * every JVM range call builds its whole list.
   */
  private static final long MAX_RANGE_LENGTH = 10_000;

  /**
   * This probe, restricted to cases with exactly one argument, for a call that
   * has no way to take a case's options.
   *
   * @return the restricted probe
   */
  public Probe alone() {
    return new Probe(
      args -> args.size() == 1 && accepts.test(args),
      call,
      isCodec,
      run
    );
  }

  /**
   * This probe, restricted to cases with exactly two arguments, for a call on
   * two values that has no way to take a case's options.
   *
   * @return the restricted probe
   */
  public Probe pair() {
    return new Probe(
      args -> args.size() == 2 && accepts.test(args),
      call,
      isCodec,
      run
    );
  }

  /** Decides whether a call can take one case's decoded arguments. */
  @FunctionalInterface
  public interface Accepts {
    /**
     * Check one case's arguments.
     *
     * @param args the decoded arguments
     * @return whether the call can take them
     */
    boolean test(List<Object> args);
  }

  /** Runs a call on a case's two arguments, the first narrowed to a type. */
  @FunctionalInterface
  public interface BinaryCall<T> {
    /**
     * Run the call.
     *
     * @param first the first argument, already narrowed
     * @param second the second argument
     * @return what the call returned
     * @throws Exception whatever the call throws, recorded as an outcome
     */
    Object run(T first, Object second) throws Exception;
  }

  /** Runs a call on one case's decoded arguments. */
  @FunctionalInterface
  public interface Call {
    /**
     * Run the call.
     *
     * @param args the decoded arguments
     * @return what the call returned
     * @throws Exception whatever the call throws, recorded as an outcome
     */
    Object run(List<Object> args) throws Exception;
  }

  /** Runs a call on a range's start, end, and step. */
  @FunctionalInterface
  public interface IntRangeCall {
    /**
     * Run the call.
     *
     * @param start the first value
     * @param end the end, excluded or not as the call decides
     * @param step the step, 1 when the case gives none
     * @return the call's result
     * @throws Exception whatever the call throws
     */
    Object run(int start, int end, int step) throws Exception;
  }

  /** Runs a call on a list and a property name. */
  @FunctionalInterface
  public interface ListKeyCall {
    /**
     * Run the call.
     *
     * @param items the list
     * @param key the property name
     * @return the call's result
     * @throws Exception whatever the call throws
     */
    Object run(List<?> items, String key) throws Exception;
  }

  /** Runs a call on two maps. */
  @FunctionalInterface
  public interface MapPairCall {
    /**
     * Run the call.
     *
     * @param first the first map
     * @param second the second map
     * @return the call's result
     * @throws Exception whatever the call throws
     */
    Object run(Map<?, ?> first, Map<?, ?> second) throws Exception;
  }

  /** Runs a call on a case's only argument, narrowed to a type. */
  @FunctionalInterface
  public interface UnaryCall<T> {
    /**
     * Run the call.
     *
     * @param value the argument, already narrowed
     * @return what the call returned
     * @throws Exception whatever the call throws, recorded as an outcome
     */
    Object run(T value) throws Exception;
  }

  /**
   * A call that takes any first argument, including `null`.
   *
   * @param call the expression, as the table header shows it
   * @param run runs the expression
   * @return the probe
   */
  public static Probe any(final String call, final UnaryCall<Object> run) {
    return new Probe(args -> true, call, false, args -> run.run(args.get(0)));
  }

  /**
   * A call on two arguments that takes any first argument, including `null`.
   *
   * @param call the expression, as the table header shows it
   * @param run runs the expression
   * @return the probe
   */
  public static Probe anyBinary(
    final String call,
    final BinaryCall<Object> run
  ) {
    return new Probe(args -> true, call, false, args ->
      run.run(args.get(0), args.get(1))
    );
  }

  /**
   * A call on two arguments whose first must be of one type.
   *
   * @param call the expression, as the table header shows it
   * @param type the type the first argument must have
   * @param run runs the expression
   * @param <T> the first argument's type
   * @return the probe
   */
  public static <T> Probe binary(
    final String call,
    final Class<T> type,
    final BinaryCall<T> run
  ) {
    return new Probe(args -> type.isInstance(args.get(0)), call, false, args ->
      run.run(type.cast(args.get(0)), args.get(1))
    );
  }

  /**
   * The codec round-trip, which returns each value unchanged.
   *
   * @return the probe
   */
  public static Probe codec() {
    return new Probe(args -> true, "value", true, args -> args.get(0));
  }

  /**
   * A call on an `int` range: `[start, end]`, or `[start, end, { step }]` with
   * a nonzero step, spanning at most `MAX_RANGE_LENGTH` items; other cases,
   * including any that don't fit an `int`, are `n/a`.
   *
   * @param call the expression, as the table header shows it
   * @param run runs the expression
   * @return the probe
   */
  public static Probe intRange(final String call, final IntRangeCall run) {
    return new Probe(
      args ->
        (args.size() == 2 || args.size() == 3) &&
        isInt(args.get(0)) &&
        isInt(args.get(1)) &&
        (args.size() == 2 || isStepOptions(args.get(2))) &&
        isShortSpan(args),
      call,
      false,
      args ->
        run.run(
          ((Long) args.get(0)).intValue(),
          ((Long) args.get(1)).intValue(),
          args.size() == 2
            ? 1
            : ((Long) ((Map<?, ?>) args.get(2)).get("step")).intValue()
        )
    );
  }

  /**
   * A call on a list and a property name, and no options; other cases are
   * `n/a`.
   *
   * @param call the expression, as the table header shows it
   * @param run runs the expression
   * @return the probe
   */
  public static Probe listKey(final String call, final ListKeyCall run) {
    return new Probe(
      args ->
        args.size() == 2 &&
        args.get(0) instanceof List<?> &&
        args.get(1) instanceof String,
      call,
      false,
      args -> spellMap(run.run((List<?>) args.get(0), (String) args.get(1)))
    );
  }

  /**
   * A call on exactly two maps and no options; other cases are `n/a`.
   *
   * @param call the expression, as the table header shows it
   * @param run runs the expression
   * @return the probe
   */
  public static Probe mapPair(final String call, final MapPairCall run) {
    return new Probe(
      args ->
        args.size() == 2 &&
        args.get(0) instanceof Map<?, ?> &&
        args.get(1) instanceof Map<?, ?>,
      call,
      false,
      args -> run.run((Map<?, ?>) args.get(0), (Map<?, ?>) args.get(1))
    );
  }

  /**
   * A call whose only argument must be of one type, or `null` where the
   * signature takes a nullable one.
   *
   * @param call the expression, as the table header shows it
   * @param type the type the argument must have
   * @param run runs the expression
   * @param <T> the argument's type
   * @return the probe
   */
  public static <T> Probe nullable(
    final String call,
    final Class<T> type,
    final UnaryCall<T> run
  ) {
    return new Probe(
      args -> args.get(0) == null || type.isInstance(args.get(0)),
      call,
      false,
      args -> run.run(type.cast(args.get(0)))
    );
  }

  /**
   * A call whose only argument must be a non-null value of one type.
   *
   * @param call the expression, as the table header shows it
   * @param type the type the argument must have
   * @param run runs the expression
   * @param <T> the argument's type
   * @return the probe
   */
  public static <T> Probe typed(
    final String call,
    final Class<T> type,
    final UnaryCall<T> run
  ) {
    return new Probe(args -> type.isInstance(args.get(0)), call, false, args ->
      run.run(type.cast(args.get(0)))
    );
  }

  /**
   * Whether a decoded value is an integer that fits an `int`.
   *
   * @param value the decoded value
   * @return whether it is a `Long` in `int` range
   */
  private static boolean isInt(final Object value) {
    return (
      value instanceof final Long number &&
      number >= Integer.MIN_VALUE &&
      number <= Integer.MAX_VALUE
    );
  }

  /**
   * Whether an accepted `int` range case spans at most `MAX_RANGE_LENGTH`
   * items, counting either way.
   *
   * @param args the case's arguments, already checked by `intRange`
   * @return whether the span is short enough to build
   */
  private static boolean isShortSpan(final List<Object> args) {
    final long start = (Long) args.get(0);
    final long end = (Long) args.get(1);
    final long step =
      args.size() == 2 ? 1 : (Long) ((Map<?, ?>) args.get(2)).get("step");

    return Math.abs(end - start) / Math.abs(step) <= MAX_RANGE_LENGTH;
  }

  /**
   * Whether a decoded value is options holding only a nonzero `int` step.
   *
   * @param value the decoded value
   * @return whether it is `{ step }` with such a step
   */
  private static boolean isStepOptions(final Object value) {
    return (
      value instanceof final Map<?, ?> options &&
      options.size() == 1 &&
      isInt(options.get("step")) &&
      (Long) options.get("step") != 0
    );
  }

  /**
   * Spell a map with a non-string key as `{ "Map": [[key, value]] }`.
   *
   * <p>The codec writes only string keys, so such a map would show as its
   * type; the Node adapter spells a JavaScript `Map` the same way.
   *
   * @param result a call's result
   * @return the result, with such a map spelled out
   */
  private static Object spellMap(final Object result) {
    if (
      !(result instanceof final Map<?, ?> map) ||
      map
        .keySet()
        .stream()
        .allMatch(key -> key instanceof String)
    ) {
      return result;
    }

    final List<List<Object>> entries = new ArrayList<>();

    for (final Map.Entry<?, ?> entry : map.entrySet()) {
      entries.add(Arrays.asList(entry.getKey(), entry.getValue()));
    }

    return Map.of("Map", entries);
  }
}
