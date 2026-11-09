package com.devmap.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ScanProjectRequest(@NotBlank @Size(max = 4096) String path) {}
