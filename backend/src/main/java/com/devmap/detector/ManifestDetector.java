package com.devmap.detector;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
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

@Component
public class ManifestDetector implements TechnologyDetector {
    private final ObjectMapper json;
    public ManifestDetector(ObjectMapper json) { this.json = json; }

    @Override public boolean supports(String filename) {
        return filename.equals("package.json") || filename.equals("pom.xml");
    }

    @Override public Detection detect(String filename, String content) throws Exception {
        Set<String> dependencies = new HashSet<>();
        String technology;
        String label;
        if (filename.equals("package.json")) {
            JsonNode manifest = json.readTree(content);
            for (String section : List.of("dependencies", "devDependencies")) {
                manifest.path(section).fieldNames().forEachRemaining(dependencies::add);
            }
            technology = dependencies.contains("next") ? "Next.js" : dependencies.contains("react") ? "React" : "Node.js";
            label = technology + " application";
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
            var elements = document.getElementsByTagName("dependency");
            for (int i = 0; i < elements.getLength(); i++) {
                var children = elements.item(i).getChildNodes();
                for (int j = 0; j < children.getLength(); j++) {
                    if (children.item(j).getNodeName().equals("artifactId")) {
                        dependencies.add(children.item(j).getTextContent().strip());
                    }
                }
            }
            technology = dependencies.stream().anyMatch(d -> d.startsWith("spring-boot")) ? "Spring Boot" : "Java / Maven";
            label = technology + " application";
        }
        List<TechnologyDetector.Component> nodes = new ArrayList<>();
        List<Connection> edges = new ArrayList<>();
        nodes.add(new TechnologyDetector.Component("app", label, "application", technology, "Application manifest"));
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
                String kind = List.of("RabbitMQ", "Kafka").contains(signal.getKey()) ? "broker" : "data";
                nodes.add(new TechnologyDetector.Component(signal.getKey(), signal.getKey(), kind, signal.getKey(),
                    "Dependency declared: " + dependency + "; usage and deployment unverified"));
                edges.add(new Connection("app", signal.getKey(), "may use", "inferred"));
            }
        });
        return new Detection(nodes, edges);
    }
}
