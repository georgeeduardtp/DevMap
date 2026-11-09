package com.devmap.dto.response;

import java.util.List;

public record ComponentResponse(String id, String label, String kind, String technology,
                                String status, List<EvidenceResponse> evidence) {}
