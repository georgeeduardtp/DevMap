package com.devmap.model;

import java.util.List;

public record ProjectComponent(String id, String label, String kind, String technology,
                               String status, List<Evidence> evidence, RuntimeEndpoint runtimeEndpoint) {
    public ProjectComponent(String id, String label, String kind, String technology, String status, List<Evidence> evidence) {
        this(id, label, kind, technology, status, evidence, null);
    }

    public record RuntimeEndpoint(String url, String file) {}
}
