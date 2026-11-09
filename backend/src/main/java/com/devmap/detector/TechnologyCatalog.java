package com.devmap.detector;

import com.devmap.detector.TechnologyDetector.Technology;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

final class TechnologyCatalog {
    private record Rule(String name, String category, String... dependencies) {}

    private static final List<Rule> NPM = List.of(
        new Rule("TypeScript", "language", "typescript"),
        new Rule("Next.js", "framework", "next"),
        new Rule("Angular", "framework", "@angular/core"),
        new Rule("Vue", "framework", "vue"),
        new Rule("Nuxt", "framework", "nuxt"),
        new Rule("Svelte", "framework", "svelte"),
        new Rule("SvelteKit", "framework", "@sveltejs/kit"),
        new Rule("Astro", "framework", "astro"),
        new Rule("Express", "framework", "express"),
        new Rule("NestJS", "framework", "@nestjs/core"),
        new Rule("React", "library", "react"),
        new Rule("React Flow", "library", "@xyflow/react", "reactflow", "react-flow-renderer"),
        new Rule("MapTiler", "library", "@maptiler/sdk", "@maptiler/client", "@maptiler/leaflet-maptilersdk"),
        new Rule("MapLibre GL JS", "library", "maplibre-gl"),
        new Rule("Leaflet", "library", "leaflet"),
        new Rule("Tailwind CSS", "tool", "tailwindcss"),
        new Rule("Vite", "tool", "vite"),
        new Rule("ESLint", "tool", "eslint"),
        new Rule("Prettier", "tool", "prettier"),
        new Rule("Vitest", "tool", "vitest"),
        new Rule("Jest", "tool", "jest"),
        new Rule("Playwright", "tool", "@playwright/test", "playwright")
    );

    private static final List<Rule> MAVEN = List.of(
        new Rule("Kotlin", "language", "kotlin-stdlib", "kotlin-stdlib-jdk8", "kotlin-maven-plugin"),
        new Rule("Quarkus", "framework", "quarkus-core", "quarkus-rest", "quarkus-resteasy"),
        new Rule("Micronaut", "framework", "micronaut-runtime", "micronaut-http-server-netty"),
        new Rule("Spring Data JPA", "library", "spring-boot-starter-data-jpa", "spring-data-jpa"),
        new Rule("Hibernate", "library", "hibernate-core"),
        new Rule("Jackson", "library", "jackson-databind"),
        new Rule("JUnit", "tool", "junit-jupiter", "junit-jupiter-api", "junit"),
        new Rule("Lombok", "tool", "lombok")
    );

    private TechnologyCatalog() {}

    static List<Technology> npm(Set<String> dependencies) {
        var technologies = matches(NPM, dependencies);
        technologies.add(new Technology("Node.js", "runtime", "Node.js ecosystem inferred from package.json"));
        if (!dependencies.contains("typescript")) {
            technologies.add(new Technology("JavaScript", "language", "JavaScript ecosystem inferred from package.json"));
        }
        return technologies;
    }

    static List<Technology> maven(Set<String> artifacts, String springBootEvidence) {
        var technologies = matches(MAVEN, artifacts);
        technologies.add(new Technology("Maven", "tool", "Maven project manifest"));
        if (technologies.stream().noneMatch(technology -> technology.category().equals("language"))) {
            technologies.add(new Technology("Java", "language", "Java ecosystem inferred from pom.xml"));
        }
        if (springBootEvidence != null) {
            technologies.add(new Technology("Spring Boot", "framework", springBootEvidence));
        }
        return technologies;
    }

    private static List<Technology> matches(List<Rule> rules, Set<String> declarations) {
        List<Technology> technologies = new ArrayList<>();
        for (var rule : rules) {
            Arrays.stream(rule.dependencies()).filter(declarations::contains).findFirst().ifPresent(declaration ->
                technologies.add(new Technology(rule.name(), rule.category(), "Manifest declares: " + declaration)));
        }
        return technologies;
    }
}
