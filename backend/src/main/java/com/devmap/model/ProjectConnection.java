package com.devmap.model;

import java.util.List;

public record ProjectConnection(String id, String source, String target, String label, String confidence, List<Evidence> evidence) {
    public ProjectConnection {
        evidence = evidence == null ? List.of() : List.copyOf(evidence);
    }

    public ProjectConnection(String id, String source, String target, String label, String confidence) {
        this(id, source, target, label, confidence, List.of());
    }
}
