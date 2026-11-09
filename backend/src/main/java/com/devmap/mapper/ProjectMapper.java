package com.devmap.mapper;

import com.devmap.dto.response.ComponentResponse;
import com.devmap.dto.response.ConnectionResponse;
import com.devmap.dto.response.EvidenceResponse;
import com.devmap.dto.response.ProjectResponse;
import com.devmap.model.ProjectMap;
import org.springframework.stereotype.Component;

@Component
public class ProjectMapper {
    public ProjectResponse toResponse(ProjectMap project) {
        var nodes = project.components().stream().map(component -> new ComponentResponse(
            component.id(), component.label(), component.kind(), component.technology(), component.status(),
            component.evidence().stream().map(evidence -> new EvidenceResponse(
                evidence.file(), evidence.description())).toList())).toList();
        var edges = project.connections().stream().map(connection -> new ConnectionResponse(
            connection.id(), connection.source(), connection.target(), connection.label(), connection.confidence())).toList();
        return new ProjectResponse(project.id(), project.name(), project.scannedAt(), project.mode(),
            project.filesInspected(), nodes, edges, project.warnings());
    }
}
