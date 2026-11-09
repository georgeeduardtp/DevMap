package com.devmap.model;

public record ProjectCommand(String kind, String label, String text, String file, String componentId) {}
