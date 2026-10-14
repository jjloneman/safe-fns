package com.jjloneman.safefns.research;

import java.util.List;

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
}
