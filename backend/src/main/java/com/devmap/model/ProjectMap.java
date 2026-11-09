package com.devmap.model;

import java.time.Instant;
import java.util.List;

/** Internal result of local discovery; independent of the HTTP response format. */
public record ProjectMap(String id, String name, Instant scannedAt, String mode,
                         int filesInspected, List<ProjectComponent> components,
                         List<ProjectConnection> connections, List<String> warnings) {}
