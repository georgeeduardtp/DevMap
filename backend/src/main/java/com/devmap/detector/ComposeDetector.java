package com.devmap.detector;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@Component
public class ComposeDetector implements TechnologyDetector {
    private static final Pattern PROJECT_NAME = Pattern.compile("[a-z0-9][a-z0-9_-]{0,254}");
    private static final Map<String, String> KNOWN_IMAGES = Map.of(
        "redis", "Redis", "postgres", "PostgreSQL", "mongo", "MongoDB", "mysql", "MySQL",
        "rabbitmq", "RabbitMQ", "kafka", "Kafka"
    );

    @Override public boolean supports(String filename) {
        return List.of("compose.yml", "compose.yaml", "docker-compose.yml", "docker-compose.yaml").contains(filename);
    }

    @Override public Detection detect(String filename, String content) {
        LoaderOptions options = new LoaderOptions();
        options.setMaxAliasesForCollections(20);
        options.setNestingDepthLimit(30);
        options.setCodePointLimit(1_048_576);
        options.setAllowDuplicateKeys(false);
        Object parsed = new Yaml(new SafeConstructor(options)).load(content);
        if (!(parsed instanceof Map<?, ?> root) || !(root.get("services") instanceof Map<?, ?> services)) {
            return new Detection(List.of(), List.of(), List.of());
        }
        if (services.size() > 200) throw new IllegalArgumentException("Too many Compose services");
        List<TechnologyDetector.Component> nodes = new ArrayList<>();
        List<Connection> edges = new ArrayList<>();
        List<Technology> technologies = new ArrayList<>();
        List<Command> commands = new ArrayList<>();
        technologies.add(new Technology("Docker Compose", "tool", "Services declared in a Compose manifest"));
        services.forEach((name, value) -> {
            if (!(name instanceof String key) || !(value instanceof Map<?, ?> config)) return;
            // Only allowlisted image names become technology labels. Never return raw config or credentials.
            String image = config.get("image") instanceof String s ? s : "";
            String base = image.substring(image.lastIndexOf('/') + 1).split(":|@", 2)[0];
            String detected = KNOWN_IMAGES.get(base);
            String technology = detected == null ? "Container" : base;
            if (detected != null) technologies.add(new Technology(detected, "infrastructure", "Compose image: " + base));
            nodes.add(new TechnologyDetector.Component(key, key, "container", technology,
                "Service declared in Compose; runtime unverified", buildFile(config.get("build"))));
            for (String field : List.of("entrypoint", "command")) {
                Object valueToRun = config.get(field);
                String text = valueToRun instanceof String shell ? shell : null;
                if (valueToRun instanceof List<?> args && !args.isEmpty() && args.stream().allMatch(String.class::isInstance)) {
                    var array = JsonNodeFactory.instance.arrayNode();
                    args.forEach(arg -> array.add((String) arg));
                    text = array.toString();
                }
                if (text != null && !text.isBlank()) {
                    commands.add(new Command("container", key + " · " + field, text, key));
                }
            }
            Object depends = config.get("depends_on");
            Iterable<?> targets = depends instanceof Map<?, ?> m ? m.keySet() : depends instanceof List<?> l ? l : List.of();
            for (Object target : targets) {
                if (target instanceof String t && services.get(t) instanceof Map<?, ?>) {
                    edges.add(new Connection(key, t, "depends on", "declared"));
                }
            }
        });
        String composeName = root.get("name") instanceof String name && PROJECT_NAME.matcher(name).matches() ? name : null;
        return new Detection(nodes, edges, technologies, composeName, commands);
    }

    private static String buildFile(Object build) {
        String context;
        String dockerfile = "Dockerfile";
        if (build instanceof String path) {
            context = relativePath(path);
        } else if (build instanceof Map<?, ?> config && !config.containsKey("dockerfile_inline")) {
            context = config.containsKey("context") ? relativePath(config.get("context")) : ".";
            dockerfile = config.containsKey("dockerfile") ? relativePath(config.get("dockerfile")) : "Dockerfile";
        } else {
            return null;
        }

        if (context == null || dockerfile == null) return null;
        try {
            return Path.of(context).resolve(dockerfile).normalize().toString().replace('\\', '/');
        } catch (InvalidPathException ignored) {
            return null;
        }
    }

    private static String relativePath(Object value) {
        if (!(value instanceof String path) || path.isBlank() || path.length() > 1024
            || path.contains(":") || path.contains("$") || path.startsWith("~") || path.startsWith("git@")
            || path.chars().anyMatch(Character::isISOControl)) return null;
        String normalized = path.replace('\\', '/');
        return normalized.startsWith("/") ? null : normalized;
    }
}
