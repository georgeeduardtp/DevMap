package com.devmap.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record ProjectResponse(String id, String name, Instant scannedAt, String mode,
                              int filesInspected, List<ComponentResponse> nodes,
                              List<ConnectionResponse> edges, List<String> warnings,
                              List<TechnologyResponse> technologies, Map<String, String> composeNames,
                              List<CommandResponse> commands, FolderSchemeResponse folderScheme) {
    public record FolderSchemeResponse(List<String> directories, boolean partial) {}
}
