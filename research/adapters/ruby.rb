# frozen_string_literal: true

# The Ruby adapter: runs each case file through Ruby's core methods and
# Rails' ActiveModel types.
#
# Usage: `ruby ruby.rb <case-file>...`, inside the `ruby` Compose service.
# ActiveModel comes from `research/docker/ruby/Gemfile.lock`, without the
# rest of Rails; it brings ActiveSupport, whose `blank?` is Rails' emptiness.

require "active_model"
require "active_support/core_ext/object/blank"
require "json"
require "uri"

require_relative "research_codec"

# The probes Ruby and Rails offer, keyed by tool.
module RubyAdapter
  # Accepts exactly two strings: a value and a base.
  ARE_TWO_STRINGS = ->(*args) { args.length == 2 && args.all?(String) }

  # Accepts exactly one argument, a string.
  IS_LONE_STRING = ->(*args) { args.length == 1 && args.first.is_a?(String) }

  # Accepts only a string first argument.
  IS_STRING = ->(value, *) { value.is_a?(String) }

  # Returns each value unchanged, for the `codec` round-trip check.
  CODEC_PROBE =
    ResearchCodec.probe(call: "value", is_codec: true, run: ->(value) { value })

  # Rails' ActiveModel types and ActiveSupport's `blank?`.
  RAILS =
    ResearchCodec::Tool.new(
      functions: {
        "isSafeEmpty" => [
          ResearchCodec.probe(
            call: "value.blank?",
            run: ->(value) { value.blank? }
          )
        ],
        "safeParseBoolean" => [
          ResearchCodec.probe(
            call: "ActiveModel::Type::Boolean.new.cast(value)",
            run: ->(value) { ActiveModel::Type::Boolean.new.cast(value) }
          )
        ],
        "safeParseInteger" => [
          ResearchCodec.probe(
            call: "ActiveModel::Type::Integer.new.cast(value)",
            run: ->(value) { ActiveModel::Type::Integer.new.cast(value) }
          )
        ],
        "safeParseNumber" => [
          ResearchCodec.probe(
            call: "ActiveModel::Type::Float.new.cast(value)",
            run: ->(value) { ActiveModel::Type::Float.new.cast(value) }
          )
        ],
        "safeParseString" => [
          ResearchCodec.probe(
            call: "ActiveModel::Type::String.new.cast(value)",
            run: ->(value) { ActiveModel::Type::String.new.cast(value) }
          )
        ]
      }.freeze,
      name: "Rails (ActiveModel)",
      tier: 4,
      version: ActiveModel.version.to_s
    )

  # Ruby's core methods.
  RUBY =
    ResearchCodec::Tool.new(
      functions: {
        "codec" => [CODEC_PROBE],
        "isPlainObject" => [
          ResearchCodec.probe(
            call: "value.instance_of?(Hash)",
            run: ->(value) { value.instance_of?(Hash) }
          )
        ],
        "isSafeEmpty" => [
          ResearchCodec.probe(
            call: "value.empty?",
            run: ->(value) { value.empty? }
          )
        ],
        "safeJsonStringify" => [
          ResearchCodec.probe(
            call: "JSON.generate(value)",
            run: ->(value) { JSON.generate(value) }
          )
        ],
        "safeObjectHasOwn" => [
          ResearchCodec.probe(
            call: "object.key?(key)",
            run: ->(object, key) { object.key?(key) }
          )
        ],
        "safeParseInteger" => [
          ResearchCodec.probe(
            call: "Integer(value)",
            run: ->(value) { Integer(value) }
          ),
          ResearchCodec.probe(call: "value.to_i", run: ->(value) { value.to_i })
        ],
        "safeParseJson" => [
          ResearchCodec.probe(
            accepts: IS_STRING,
            call: "JSON.parse(value)",
            run: ->(value) { JSON.parse(value) }
          )
        ],
        "safeParseNumber" => [
          ResearchCodec.probe(
            call: "Float(value)",
            run: ->(value) { Float(value) }
          ),
          ResearchCodec.probe(call: "value.to_f", run: ->(value) { value.to_f })
        ],
        "safeParseString" => [
          ResearchCodec.probe(
            call: "value.to_s",
            run: ->(value) { value.to_s }
          ),
          ResearchCodec.probe(
            call: "value.to_s.strip",
            run: ->(value) { value.to_s.strip }
          )
        ],
        "safeParseUrl" => [
          ResearchCodec.probe(
            accepts: IS_LONE_STRING,
            call: "URI.parse(value).to_s",
            run: ->(value) { URI.parse(value).to_s }
          ),
          ResearchCodec.probe(
            accepts: ARE_TWO_STRINGS,
            call: "URI.join(base, value).to_s",
            run: ->(value, base) { URI.join(base, value).to_s }
          )
        ]
      }.freeze,
      name: "Ruby",
      tier: 4,
      version: RUBY_VERSION
    )
end

ResearchCodec.run_adapter(tools: [RubyAdapter::RAILS, RubyAdapter::RUBY])
