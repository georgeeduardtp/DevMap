package com.devmap.model;

import java.util.List;

public record ProjectComponent(String id, String label, String kind, String technology,
                               String status, List<Evidence> evidence) {}
