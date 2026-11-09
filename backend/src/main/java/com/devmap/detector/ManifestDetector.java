package com.devmap.detector;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;
import org.xml.sax.helpers.DefaultHandler;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Component
public class ManifestDetector implements TechnologyDetector {
    private static final Pattern WORKSPACE_SCRIPT = Pattern.compile(
        "npm\\s+run\\s+[\\w:-]+\\s+(?:--workspaces|(?:--workspace|-w)(?:\\s+|=)[\\w@./-]+)"
    );
    private static final Set<String> APPLICATION_SCRIPTS = Set.of("start", "dev", "serve", "preview");

    private final ObjectMapper json;
    public ManifestDetector(ObjectMapper json) { this.json = json; }

    @Override public boolean supports(String filename) {
        return filename.equals("package.json") || filename.equals("pom.xml");
    }

    @Override public Detection detect(String filename, String content) throws Exception {
        Set<String> dependencies = new HashSet<>();
        String technology;
        String label;
        boolean application;
        List<Technology> technologies;
        if (filename.equals("package.json")) {
            JsonNode manifest = json.readTree(content);
            for (String section : List.of("dependencies", "devDependencies")) {
                manifest.path(section).fieldNames().forEachRemaining(dependencies::add);
            }
            technology = dependencies.contains("next") ? "Next.js" : dependencies.contains("react") ? "React" : "Node.js";
            label = technology + " application";
            technologies = TechnologyCatalog.npm(dependencies);
            boolean workspace = declaresWorkspaces(manifest);
            application = !workspace || hasApplicationSignals(manifest);
            if (workspace) {
                technologies.add(new Technology("Workspaces", "tool", "Workspace packages declared in package.json"));
            }
        } else {
            var factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            var builder = factory.newDocumentBuilder();
            builder.setErrorHandler(new DefaultHandler());
            var document = builder.parse(new InputSource(new StringReader(content)));
            dependencies.addAll(artifactIds(document.getElementsByTagName("dependency")));
            boolean springBoot = dependencies.stream().anyMatch(d -> d.startsWith("spring-boot"));
            technology = springBoot ? "Spring Boot" : "Java / Maven";
            label = technology + " application";
            application = true;
            var artifacts = new HashSet<>(dependencies);
            artifacts.addAll(artifactIds(document.getElementsByTagName("plugin")));
            String bootEvidence = springBoot ? "Spring Boot dependency declared" : null;
            if (bootEvidence == null && artifactIds(document.getElementsByTagName("parent")).contains("spring-boot-starter-parent")) {
                bootEvidence = "Parent declared: spring-boot-starter-parent";
            }
            technologies = TechnologyCatalog.maven(artifacts, bootEvidence);
        }
        List<TechnologyDetector.Component> nodes = new ArrayList<>();
        List<Connection> edges = new ArrayList<>();
        if (application) {
            nodes.add(new TechnologyDetector.Component("app", label, "application", technology, "Application manifest"));
        }
        var signals = Map.of(
            "Redis", List.of("spring-boot-starter-data-redis", "spring-boot-starter-data-redis-reactive", "redis", "ioredis"),
            "MongoDB", List.of("spring-boot-starter-data-mongodb", "spring-boot-starter-data-mongodb-reactive", "mongodb", "mongoose"),
            "PostgreSQL", List.of("postgresql", "pg", "postgres"),
            "MySQL", List.of("mysql-connector-j", "mysql2", "mysql"),
            "RabbitMQ", List.of("spring-boot-starter-amqp", "amqplib"),
            "Kafka", List.of("spring-kafka", "kafkajs")
        );
        signals.entrySet().stream().sorted(Map.Entry.comparingByKey()).forEach(signal -> {
            String dependency = signal.getValue().stream().filter(dependencies::contains).findFirst().orElse(null);
            if (dependency != null) {
                if (application) {
                    String kind = List.of("RabbitMQ", "Kafka").contains(signal.getKey()) ? "broker" : "data";
                    nodes.add(new TechnologyDetector.Component(signal.getKey(), signal.getKey(), kind, signal.getKey(),
                        "Dependency declared: " + dependency + "; usage and deployment unverified"));
                    edges.add(new Connection("app", signal.getKey(), "may use", "inferred"));
                }
                technologies.add(new Technology(signal.getKey(), "infrastructure", "Dependency declared: " + dependency));
            }
        });
        return new Detection(nodes, edges, technologies);
    }

    private static boolean declaresWorkspaces(JsonNode manifest) {
        var workspaces = manifest.path("workspaces");
        var packages = workspaces.isObject() ? workspaces.path("packages") : workspaces;
        return packages.isArray() && !packages.isEmpty();
    }

    private static boolean hasApplicationSignals(JsonNode manifest) {
        if (List.of("dependencies", "optionalDependencies").stream().anyMatch(key -> !manifest.path(key).isEmpty())
            || List.of("main", "module", "exports", "bin").stream().anyMatch(manifest::hasNonNull)) {
            return true;
        }

        var scripts = manifest.path("scripts");
        for (var entry : scripts.properties()) {
            String name = entry.getKey().split(":", 2)[0];
            String command = entry.getValue().asText("").strip();
            if (APPLICATION_SCRIPTS.contains(name) && !command.isEmpty() && !WORKSPACE_SCRIPT.matcher(command).matches()) {
                return true;
            }
        }
        return false;
    }

    private static Set<String> artifactIds(NodeList elements) {
        Set<String> ids = new HashSet<>();
        for (int i = 0; i < elements.getLength(); i++) {
            var children = elements.item(i).getChildNodes();
            for (int j = 0; j < children.getLength(); j++) {
                var child = children.item(j);
                if (child.getNodeName().equals("artifactId")) ids.add(child.getTextContent().strip());
            }
        }
        return ids;
    }
}
