"""The C / C++ adapter: runs each string case through glibc and libstdc++.

Usage: `python3 c.py <case-file>...`, inside the `c` Compose service.

- glibc's functions are called directly through `ctypes`.

- libstdc++'s are called through `cxx_probes.cpp`, compiled at startup with
  the image's own g++, so they run against the libstdc++ it ships.

- Only a string without NUL reaches C, encoded as UTF-8; anything else is
  `n/a`.

- A call that could also report through an `end` pointer or `errno` reports
  only its return value, as the call text's `NULL` shows.
"""

from __future__ import annotations

import ctypes
import subprocess
from collections.abc import Callable
from pathlib import Path

from research_codec import Probe, Tool, ToolError, run_adapter

CXX_LIBRARY_PATH = Path("/tmp/cxx_probes.so")
"""Where the C++ probes are compiled; the repo is mounted read-only."""

CXX_SOURCE_PATH = Path(__file__).with_name("cxx_probes.cpp")
"""The C++ probes' source, beside this adapter."""

ERROR_SIZE = 64
"""The room each C++ probe has to name its failure."""

LIBC = ctypes.CDLL("libc.so.6")
"""glibc, the C library the image links against."""


def accepts_c_string(value: object, *_rest: object) -> bool:
    """Accept a string C can hold: one without NUL."""
    return isinstance(value, str) and "\0" not in value


def c_function(
    *,
    call: str,
    extra_args: tuple[object, ...],
    function: Callable[..., object],
) -> Probe:
    """Build a probe for a glibc function that takes the string first.

    `extra_args` follow it: `(None, 10)` for `strtol(value, NULL, 10)`.
    """

    def run(value: str) -> object:
        """Call the function on the UTF-8 bytes of the value."""
        return function(value.encode(), *extra_args)

    return {"accepts": accepts_c_string, "call": call, "run": run}


def compile_cxx_probes() -> ctypes.CDLL:
    """Compile the C++ probes and load them.

    Raises:
        subprocess.CalledProcessError: when g++ fails, with its diagnostics
            on stderr.
    """
    subprocess.run(
        [
            "g++",
            "-std=c++20",
            "-O2",
            "-shared",
            "-fPIC",
            "-o",
            str(CXX_LIBRARY_PATH),
            str(CXX_SOURCE_PATH),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
    )

    return ctypes.CDLL(str(CXX_LIBRARY_PATH))


def configure_libc() -> None:
    """Declare the glibc functions' signatures, so `ctypes` converts them."""
    LIBC.atof.argtypes = [ctypes.c_char_p]
    LIBC.atof.restype = ctypes.c_double
    LIBC.atoi.argtypes = [ctypes.c_char_p]
    LIBC.atoi.restype = ctypes.c_int
    LIBC.strtod.argtypes = [ctypes.c_char_p, ctypes.c_void_p]
    LIBC.strtod.restype = ctypes.c_double
    LIBC.strtol.argtypes = [ctypes.c_char_p, ctypes.c_void_p, ctypes.c_int]
    LIBC.strtol.restype = ctypes.c_long


def cxx_function(
    *, call: str, function: Callable[..., int], result_type: type
) -> Probe:
    """Build a probe for a C++ probe exported by `cxx_probes.cpp`.

    Raises (from the probe):
        ToolError: naming the exception or `std::errc` the call reported.
    """

    def run(value: str) -> object:
        """Call the probe, and return its result or raise its failure."""
        result = result_type()
        error = ctypes.create_string_buffer(ERROR_SIZE)

        if function(value.encode(), ctypes.byref(result), error, ERROR_SIZE):
            raise ToolError(error.value.decode())

        return result.value

    return {"accepts": accepts_c_string, "call": call, "run": run}


def glibc_version() -> str:
    """Report glibc's Debian package version, which names any Debian patch."""
    return subprocess.run(
        ["dpkg-query", "--show", "--showformat=${Version}", "libc6"],
        capture_output=True,
        check=True,
        text=True,
    ).stdout


def gxx_version() -> str:
    """Report the g++ (and so libstdc++) version the probes compiled with."""
    return subprocess.run(
        ["g++", "-dumpfullversion"],
        capture_output=True,
        check=True,
        text=True,
    ).stdout.strip()


def tools() -> list[Tool]:
    """Compile the C++ probes, then list glibc's and libstdc++'s probes."""
    configure_libc()
    cxx = compile_cxx_probes()

    return [
        {
            "functions": {
                "safeParseInteger": [
                    c_function(
                        call="atoi(value)", extra_args=(), function=LIBC.atoi
                    ),
                    c_function(
                        call="strtol(value, NULL, 10)",
                        extra_args=(None, 10),
                        function=LIBC.strtol,
                    ),
                ],
                "safeParseNumber": [
                    c_function(
                        call="atof(value)", extra_args=(), function=LIBC.atof
                    ),
                    c_function(
                        call="strtod(value, NULL)",
                        extra_args=(None,),
                        function=LIBC.strtod,
                    ),
                ],
            },
            "name": "C (glibc)",
            "tier": 4,
            "version": glibc_version(),
        },
        {
            "functions": {
                "safeParseInteger": [
                    cxx_function(
                        call="std::stoi(value)",
                        function=cxx.probe_stoi,
                        result_type=ctypes.c_int64,
                    ),
                    cxx_function(
                        call="std::from_chars(first, last, int64_t&)",
                        function=cxx.probe_from_chars_int64,
                        result_type=ctypes.c_int64,
                    ),
                ],
                "safeParseNumber": [
                    cxx_function(
                        call="std::stod(value)",
                        function=cxx.probe_stod,
                        result_type=ctypes.c_double,
                    ),
                    cxx_function(
                        call="std::from_chars(first, last, double&)",
                        function=cxx.probe_from_chars_double,
                        result_type=ctypes.c_double,
                    ),
                ],
            },
            "name": "C++ (libstdc++)",
            "tier": 4,
            "version": gxx_version(),
        },
    ]


if __name__ == "__main__":
    run_adapter(tools=tools())
