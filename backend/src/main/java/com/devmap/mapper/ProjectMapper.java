package com.devmap.mapper;

import com.devmap.dto.response.CommandResponse;
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
        var nodes = project.components().stream().map(component -> {
            var endpoint = component.runtimeEndpoint();
            return new ComponentResponse(component.id(), component.label(), component.kind(), component.technology(),
                component.status(), toEvidenceResponse(component.evidence()), endpoint == null ? null
                    : new ComponentResponse.RuntimeEndpointResponse(endpoint.url(), endpoint.file()));
        }).toList();
        var edges = project.connections().stream().map(connection -> new ConnectionResponse(
            connection.id(), connection.source(), connection.target(), connection.label(), connection.confidence(),
            toEvidenceResponse(connection.evidence()))).toList();
        var technologies = project.technologies().stream().map(technology -> new TechnologyResponse(
            technology.name(), technology.category(), toEvidenceResponse(technology.evidence()))).toList();
        var commands = project.commands().stream()
            .filter(command -> !"plugin".equals(command.kind()))
            .map(command -> new CommandResponse(command.kind(), command.label(), command.text(),
                command.file(), command.componentId())).toList();
        var scheme = project.folderScheme();
        return new ProjectResponse(project.id(), project.name(), project.scannedAt(), project.mode(),
            project.filesInspected(), nodes, edges, project.warnings(), technologies, project.composeNames(), commands,
            scheme == null ? null : new ProjectResponse.FolderSchemeResponse(scheme.directories(), scheme.partial()));
    }

    private List<EvidenceResponse> toEvidenceResponse(List<Evidence> evidence) {
        return evidence.stream().map(entry -> new EvidenceResponse(entry.file(), entry.description())).toList();
    }
}
