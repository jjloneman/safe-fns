package com.jjloneman.safefns.research

import groovy.transform.CompileStatic

/**
 * The JVM adapter's entry point: every JVM tool, in one process.
 *
 * Written in Groovy because Groovy compiles last, after Java and Kotlin, so
 * only here can every tool's class be seen.
 */
@CompileStatic
final class Main {

    private Main() { }

    /**
     * Run the case files named on the command line.
     *
     * @param args the case files' paths
     */
    static void main(final String[] args) {
        ResearchCodec.runAdapter(
            args.toList(),
            [
                CommonsLangTools.TOOL,
                GroovyTools.TOOL,
                GuavaTools.TOOL,
                JavaTools.TOOL,
                KotlinTools.TOOL,
                SpringTools.TOOL,
            ]
        )
    }

}
