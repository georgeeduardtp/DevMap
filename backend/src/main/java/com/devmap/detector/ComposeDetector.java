package com.devmap.detector;

import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class ComposeDetector implements TechnologyDetector {
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
            return new Detection(List.of(), List.of());
        }
        if (services.size() > 200) throw new IllegalArgumentException("Too many Compose services");
        List<TechnologyDetector.Component> nodes = new ArrayList<>();
        List<Connection> edges = new ArrayList<>();
        services.forEach((name, value) -> {
            if (!(name instanceof String key) || !(value instanceof Map<?, ?> config)) return;
            // Only allowlisted image names become technology labels. Never return raw config or credentials.
            String image = config.get("image") instanceof String s ? s : "";
            String technology = "Container";
            for (String known : List.of("redis", "postgres", "mongo", "mysql", "rabbitmq", "kafka")) {
                String base = image.substring(image.lastIndexOf('/') + 1).split(":|@", 2)[0];
                if (base.equals(known)) { technology = known; break; }
            }
            nodes.add(new TechnologyDetector.Component(key, key, "container", technology,
                "Service declared in Compose; runtime unverified"));
            Object depends = config.get("depends_on");
            Iterable<?> targets = depends instanceof Map<?, ?> m ? m.keySet() : depends instanceof List<?> l ? l : List.of();
            for (Object target : targets) {
                if (target instanceof String t && services.get(t) instanceof Map<?, ?>) {
                    edges.add(new Connection(key, t, "depends on", "declared"));
                }
            }
        });
        return new Detection(nodes, edges);
    }
}
