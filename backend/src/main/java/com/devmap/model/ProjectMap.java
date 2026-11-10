package com.devmap.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Internal result of local discovery; independent of the HTTP response format. */
public record ProjectMap(String id, String name, Instant scannedAt, String mode,
                         int filesInspected, List<ProjectComponent> components,
                         List<ProjectConnection> connections, List<String> warnings,
                         List<DetectedTechnology> technologies, Map<String, String> composeNames,
                         List<ProjectCommand> commands, FolderScheme folderScheme) {}
