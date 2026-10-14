# frozen_string_literal: true

# The portable value format and adapter loop, for the Ruby adapter.
#
# - The twin of `scripts/research/codec.ts`; the `codec` case file checks that
#   both decode and re-encode identically.
#
# - A `$bigint` decodes to a plain Integer for a probe, so Ruby sees its own
#   type; only the codec probe gets a `JsBigInt`, which re-encodes as a tag.

require "delegate"
require "json"

module ResearchCodec
  # The digits a `$bigint` payload may hold, with an optional minus sign.
  BIGINT_PATTERN = /\A-?[0-9]+\z/

  # The largest integer a JavaScript number holds exactly: 2**53 - 1.
  MAX_SAFE_INTEGER = (2**53) - 1

  # The spellings `$number` accepts, each with its value.
  SPECIAL_NUMBERS = {
    "-0" => -0.0,
    "-Infinity" => -Float::INFINITY,
    "Infinity" => Float::INFINITY,
    "NaN" => Float::NAN
  }.freeze

  # An Integer decoded from `$bigint` for the codec probe, so it re-encodes
  # as one.
  class JsBigInt < SimpleDelegator
  end

  # One expression a tool offers for a function.
  #
  # - `accepts`: whether the call can take these arguments at all (`n/a`
  #   otherwise), or nil to accept anything.
  # - `call`: the expression, as the table header shows it.
  # - `is_codec`: whether this is the codec round-trip, which sees every value.
  # - `run`: runs the expression on one case's decoded arguments.
  Probe = Data.define(:accepts, :call, :is_codec, :run)

  # A library or runtime, and its probes for each function.
  #
  # - `functions`: probes keyed by the function name in a case file.
  # - `name`: the display name.
  # - `tier`: the table tier.
  # - `version`: the version that actually ran.
  Tool = Data.define(:functions, :name, :tier, :version)

  # A value Ruby has no type for: `undefined`, or a `$js` value.
  Unrepresentable = Data.define(:payload, :tag)

  module_function

  # Report whether a decoded value holds anything Ruby can't express.
  def contains_unrepresentable?(value)
    case value
    when Unrepresentable
      true
    when Array
      value.any? { |item| contains_unrepresentable?(item) }
    when Hash
      value.each_value.any? { |item| contains_unrepresentable?(item) }
    else
      false
    end
  end

  # Report the locale the process runs under, as the environment sets it.
  def current_locale
    ENV.fetch("LC_ALL") { ENV.fetch("LANG", "C") }
  end

  # Decode a value from the portable format.
  #
  # Raises ArgumentError for a malformed tag, exactly where `decodeValue`
  # throws.
  def decode(encoded, is_codec:)
    case encoded
    when Array
      encoded.map { |item| decode(item, is_codec:) }
    when Hash
      decode_object(encoded, is_codec:)
    else
      encoded
    end
  end

  # Decode a JSON object: a tag, or a plain object whose values are decoded.
  def decode_object(encoded, is_codec:)
    tags = encoded.keys.select { |key| key.start_with?("$") }

    if tags.empty?
      return encoded.transform_values { |item| decode(item, is_codec:) }
    end

    if encoded.size != 1
      raise ArgumentError, "a tag must be an object's only key: #{tags.first}"
    end

    decode_tag(is_codec:, payload: encoded[tags.first], tag: tags.first)
  end

  # Decode one tagged object, given its tag and payload.
  #
  # Raises ArgumentError for an unknown tag or a payload the tag doesn't
  # accept.
  def decode_tag(is_codec:, payload:, tag:)
    if tag == "$bigint" && payload.is_a?(String)
      unless BIGINT_PATTERN.match?(payload)
        raise ArgumentError, "not an integer: #{payload}"
      end

      return(
        is_codec ? JsBigInt.new(Integer(payload, 10)) : Integer(payload, 10)
      )
    end

    if tag == "$js" && payload.is_a?(String)
      return Unrepresentable.new(payload:, tag:)
    end

    if tag == "$number" && payload.is_a?(String)
      unless SPECIAL_NUMBERS.key?(payload)
        raise ArgumentError, "not a special number: #{payload}"
      end

      return SPECIAL_NUMBERS[payload]
    end

    if tag == "$object" && payload.is_a?(Hash)
      return payload.transform_values { |item| decode(item, is_codec:) }
    end

    if tag == "$undefined" && payload == true
      return Unrepresentable.new(payload:, tag:)
    end

    raise ArgumentError, "unknown tag or bad payload: #{tag}"
  end

  # Encode a value into the portable format.
  #
  # Anything the format has no tag for is described by `$repr`, which never
  # decodes.
  def encode(value)
    case value
    when Unrepresentable
      { value.tag => value.payload }
    when JsBigInt
      { "$bigint" => value.__getobj__.to_s }
    when true, false, nil, String
      value
    when Integer
      encode_int(value)
    when Float
      encode_float(value)
    when Array
      value.map { |item| encode(item) }
    when Hash
      encode_hash(value)
    else
      { "$repr" => value.class.name }
    end
  end

  # Encode a Float, tagging the values JSON can't hold.
  def encode_float(value)
    return { "$number" => "NaN" } if value.nan?

    if value.infinite?
      return { "$number" => value.positive? ? "Infinity" : "-Infinity" }
    end

    return { "$number" => "-0" } if value.zero? && (1.0 / value).negative?

    value
  end

  # Encode a Hash, wrapped in `$object` when a key could pass for a tag.
  def encode_hash(value)
    return { "$repr" => value.class.name } unless value.keys.all?(String)

    encoded = value.transform_values { |item| encode(item) }

    if encoded.keys.any? { |key| key.start_with?("$") }
      { "$object" => encoded }
    else
      encoded
    end
  end

  # Encode an Integer, as a bigint once a JavaScript number would lose it.
  def encode_int(value)
    value.abs > MAX_SAFE_INTEGER ? { "$bigint" => value.to_s } : value
  end

  # Build a probe; `accepts` defaults to accepting anything.
  def probe(call:, run:, accepts: nil, is_codec: false)
    Probe.new(accepts:, call:, is_codec:, run:)
  end

  # Run the case files named on the command line and print the columns.
  def run_adapter(tools:)
    locale = current_locale

    columns =
      ARGV.flat_map do |path|
        case_file = JSON.parse(File.read(path, encoding: "UTF-8"))
        function = case_file["function"]

        tools.flat_map do |tool|
          tool
            .functions
            .fetch(function, [])
            .map do |probe|
              {
                "call" => probe.call,
                "function" => function,
                "locale" => locale,
                "name" => tool.name,
                "outcomes" =>
                  case_file["cases"].map do |test_case|
                    run_probe(args: test_case["args"], probe:)
                  end,
                "tier" => tool.tier,
                "version" => tool.version
              }
            end
        end
      end

    $stdout.write(JSON.generate({ "columns" => columns }))
  end

  # Run one probe on one case's encoded arguments.
  def run_probe(args:, probe:)
    decoded = args.map { |arg| decode(arg, is_codec: probe.is_codec) }

    if !probe.is_codec && decoded.any? { |arg| contains_unrepresentable?(arg) }
      return { "kind" => "n/a" }
    end

    return { "kind" => "n/a" } if probe.accepts && !probe.accepts.call(*decoded)

    begin
      { "kind" => "value", "value" => encode(probe.run.call(*decoded)) }
    rescue StandardError => error # every failure is a result, never a crash
      { "error" => error.class.name, "kind" => "error" }
    end
  end
end
