package com.devmap.model;

import java.util.List;

public record DetectedTechnology(String name, String category, List<Evidence> evidence) {}
