/*
 * The C++ probes, exported with C linkage so `c.py` can call them through
 * `ctypes`.
 *
 * - Each probe parses a NUL-terminated string and stores the result in `out`,
 *   or copies the name of what went wrong into `error`.
 *
 * - A probe returns 0 on success and 1 on failure.
 */
#include <charconv>
#include <cstdint>
#include <cstring>
#include <stdexcept>
#include <string>
#include <system_error>

namespace {

/** Copy a failure's name into the caller's buffer, NUL-terminated. */
int fail(const char *name, char *error, std::size_t error_size) {
  std::strncpy(error, name, error_size - 1);
  error[error_size - 1] = '\0';

  return 1;
}

/** Name the `std::errc` that `std::from_chars` reports. */
const char *from_chars_error(std::errc code) {
  if (code == std::errc::result_out_of_range) {
    return "std::errc::result_out_of_range";
  }

  return "std::errc::invalid_argument";
}

/**
 * Parse with `std::from_chars`, over the whole string.
 *
 * - Trailing text is ignored, as `from_chars` ignores it.
 */
template <typename T>
int from_chars_probe(const char *text, T *out, char *error,
                     std::size_t error_size) {
  const char *last = text + std::strlen(text);
  const auto [pointer, code] = std::from_chars(text, last, *out);

  if (code != std::errc{}) {
    return fail(from_chars_error(code), error, error_size);
  }

  return 0;
}

/** Run a `std::sto*` call, naming the exception it throws. */
template <typename T, typename Parse>
int sto_probe(Parse parse, const char *text, T *out, char *error,
              std::size_t error_size) {
  try {
    *out = parse(std::string(text));

    return 0;
  } catch (const std::invalid_argument &) {
    return fail("std::invalid_argument", error, error_size);
  } catch (const std::out_of_range &) {
    return fail("std::out_of_range", error, error_size);
  }
}

} // namespace

extern "C" {

/** `std::from_chars(first, last, double&)`. */
int probe_from_chars_double(const char *text, double *out, char *error,
                            std::size_t error_size) {
  return from_chars_probe(text, out, error, error_size);
}

/** `std::from_chars(first, last, std::int64_t&)`. */
int probe_from_chars_int64(const char *text, std::int64_t *out, char *error,
                           std::size_t error_size) {
  return from_chars_probe(text, out, error, error_size);
}

/** `std::stod(value)`. */
int probe_stod(const char *text, double *out, char *error,
               std::size_t error_size) {
  return sto_probe([](const std::string &value) { return std::stod(value); },
                   text, out, error, error_size);
}

/** `std::stoi(value)`, widened to `int64_t` for the caller. */
int probe_stoi(const char *text, std::int64_t *out, char *error,
               std::size_t error_size) {
  return sto_probe(
      [](const std::string &value) {
        return static_cast<std::int64_t>(std::stoi(value));
      },
      text, out, error, error_size);
}
}
