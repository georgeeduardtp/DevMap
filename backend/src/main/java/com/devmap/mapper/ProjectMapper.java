package com.devmap.mapper;

import com.devmap.dto.response.ComponentResponse;
import com.devmap.dto.response.ConnectionResponse;
import com.devmap.dto.response.EvidenceResponse;
import com.devmap.dto.response.ProjectResponse;
import com.devmap.dto.response.TechnologyResponse;
import com.devmap.model.Evidence;
import com.devmap.model.ProjectMap;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ProjectMapper {
    public ProjectResponse toResponse(ProjectMap project) {
        var nodes = project.components().stream().map(component -> new ComponentResponse(
            component.id(), component.label(), component.kind(), component.technology(), component.status(),
            toEvidenceResponse(component.evidence()))).toList();
        var edges = project.connections().stream().map(connection -> new ConnectionResponse(
            connection.id(), connection.source(), connection.target(), connection.label(), connection.confidence())).toList();
        var technologies = project.technologies().stream().map(technology -> new TechnologyResponse(
            technology.name(), technology.category(), toEvidenceResponse(technology.evidence()))).toList();
        return new ProjectResponse(project.id(), project.name(), project.scannedAt(), project.mode(),
            project.filesInspected(), nodes, edges, project.warnings(), technologies);
    }

    private List<EvidenceResponse> toEvidenceResponse(List<Evidence> evidence) {
        return evidence.stream().map(entry -> new EvidenceResponse(entry.file(), entry.description())).toList();
    }
}
