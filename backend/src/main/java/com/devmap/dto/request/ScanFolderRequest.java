package com.devmap.dto.request;

import java.util.List;
import java.util.Map;

public record ScanFolderRequest(String name, Map<String, String> manifests, FolderSchemeRequest folderScheme) {
    public record FolderSchemeRequest(List<String> directories, boolean partial) {}
}
