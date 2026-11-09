package com.devmap.dto.request;

import java.util.Map;

public record ScanFolderRequest(String name, Map<String, String> manifests) {}
