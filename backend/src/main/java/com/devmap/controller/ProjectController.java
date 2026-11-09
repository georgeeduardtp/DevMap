package com.devmap.controller;

import com.devmap.dto.request.ScanFolderRequest;
import com.devmap.dto.request.ScanProjectRequest;
import com.devmap.dto.response.ProjectResponse;
import com.devmap.mapper.ProjectMapper;
import com.devmap.service.ProjectService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {
    private final ProjectService service;
    private final ProjectMapper mapper;

    public ProjectController(ProjectService service, ProjectMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @GetMapping
    public List<ProjectResponse> projects() {
        return service.findAll().stream().map(mapper::toResponse).toList();
    }

    @GetMapping("/{id}")
    public ProjectResponse project(@PathVariable String id) {
        return mapper.toResponse(service.findById(id));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        service.delete(id);
    }

    @PostMapping(value = "/scan", consumes = "application/json")
    public ProjectResponse scan(@Valid @RequestBody ScanProjectRequest request) {
        return mapper.toResponse(service.scan(request.path()));
    }

    @PostMapping(value = "/scan-folder", consumes = "application/json")
    public ProjectResponse scanFolder(@RequestBody ScanFolderRequest request) {
        return mapper.toResponse(service.scanFolder(request.name(), request.manifests()));
    }
}
