package com.devmap.dto.response;

import java.util.List;

public record TechnologyResponse(String name, String category, List<EvidenceResponse> evidence) {}
