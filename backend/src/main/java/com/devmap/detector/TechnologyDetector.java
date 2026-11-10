package com.devmap.detector;

import java.util.List;

/** Detectors only receive bounded text, never a repository process or executable. */
public interface TechnologyDetector {
    boolean supports(String filename);
    Detection detect(String filename, String content) throws Exception;

    record Component(String key, String label, String kind, String technology, String description, Build build) {
        public Component(String key, String label, String kind, String technology, String description) {
            this(key, label, kind, technology, description, null);
        }
    }
    record Build(String context, String dockerfile, String target) {}
    record Connection(String source, String target, String label, String confidence) {}
    record Technology(String name, String category, String description) {}
    record Command(String kind, String label, String text, String componentKey) {
        public Command(String kind, String label, String text) {
            this(kind, label, text, null);
        }
    }
    record Detection(List<Component> components, List<Connection> connections, List<Technology> technologies,
                     String composeName, List<Command> commands, DockerRecipe dockerRecipe) {
        public Detection(List<Component> components, List<Connection> connections, List<Technology> technologies,
                         String composeName, List<Command> commands) {
            this(components, connections, technologies, composeName, commands, null);
        }
        public Detection(List<Component> components, List<Connection> connections, List<Technology> technologies) {
            this(components, connections, technologies, null, List.of());
        }
    }
}
