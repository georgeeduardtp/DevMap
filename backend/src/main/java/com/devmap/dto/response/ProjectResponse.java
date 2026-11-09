package com.devmap.dto.response;

import java.time.Instant;
import java.util.List;

public record ProjectResponse(String id, String name, Instant scannedAt, String mode,
                              int filesInspected, List<ComponentResponse> nodes,
                              List<ConnectionResponse> edges, List<String> warnings) {}
