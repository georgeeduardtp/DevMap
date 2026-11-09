package com.devmap.detector;

import java.util.List;

/** Detectors only receive bounded text, never a repository process or executable. */
public interface TechnologyDetector {
    boolean supports(String filename);
    Detection detect(String filename, String content) throws Exception;

    record Component(String key, String label, String kind, String technology, String description) {}
    record Connection(String source, String target, String label, String confidence) {}
    record Technology(String name, String category, String description) {}
    record Detection(List<Component> components, List<Connection> connections, List<Technology> technologies) {}
}
