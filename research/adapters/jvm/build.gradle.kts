/*
 * The JVM adapter: Java's standard library, Commons Lang, Gson, Guava, Jackson,
 * Spring, Kotlin, Groovy, and Xerces-J, compiled into one image so the JVM
 * starts once per run.
 *
 * - Every version is exact and at least 7 days old; Renovate's
 *   `minimumReleaseAge` keeps the bumps there, since Maven has no floor.
 */
plugins {
    application
    groovy
    kotlin("jvm") version "2.4.21"
}

repositories { mavenCentral() }

dependencies {
    implementation("com.google.code.gson:gson:2.14.0")
    implementation("com.google.guava:guava:33.7.2-jre")
    implementation("org.apache.commons:commons-lang3:3.21.0")
    implementation("org.apache.groovy:groovy:6.0.0")
    implementation("org.springframework:spring-core:7.0.9")
    implementation("org.springframework:spring-web:7.0.9")
    implementation("tools.jackson.core:jackson-databind:3.2.3")

    // `xml-apis` repeats the JDK's own `java.xml` packages, which win anyway.
    implementation("xerces:xercesImpl:2.12.2") {
        exclude(group = "xml-apis", module = "xml-apis")
    }
}

application { mainClass = "com.safefns.research.Main" }

java { toolchain { languageVersion = JavaLanguageVersion.of(25) } }

// Groovy compiles last and sees Java's classes by default, but not Kotlin's;
// `Main.groovy` needs both.
tasks.compileGroovy {
    classpath += files(tasks.compileKotlin.flatMap { it.destinationDirectory })
}

// Downloads every jar the build needs, so the image caches them in a layer of
// their own before the sources are copied in; the Groovy compiler's classpath
// is resolved apart from any configuration.
tasks.register("resolveDependencies") {
    val classpaths = configurations.filter { it.isCanBeResolved }
    val groovyCompiler = tasks.compileGroovy.map { it.groovyClasspath }

    doLast {
        classpaths.forEach { it.resolve() }
        groovyCompiler.get().files
    }
}
