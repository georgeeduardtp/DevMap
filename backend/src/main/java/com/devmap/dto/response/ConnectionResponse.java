package com.devmap.dto.response;

import java.util.List;

public record ConnectionResponse(String id, String source, String target, String label, String confidence,
                                 List<EvidenceResponse> evidence) {}
