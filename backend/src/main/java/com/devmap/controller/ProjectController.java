package com.devmap.controller;

import com.devmap.dto.request.ScanProjectRequest;
import com.devmap.dto.response.ProjectResponse;
import com.devmap.mapper.ProjectMapper;
import com.devmap.service.ProjectService;
import jakarta.validation.Valid;
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

    @PostMapping(value = "/scan", consumes = "application/json")
    public ProjectResponse scan(@Valid @RequestBody ScanProjectRequest request) {
        return mapper.toResponse(service.scan(request.path()));
    }
}
