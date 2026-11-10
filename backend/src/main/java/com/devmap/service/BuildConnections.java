package com.devmap.service;

import com.devmap.detector.DockerRecipe;
import com.devmap.detector.TechnologyDetector;
import com.devmap.model.Evidence;
import com.devmap.model.ProjectComponent;
import com.devmap.model.ProjectConnection;

import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class BuildConnections {
    record Build(String serviceId, String composeFile, String context, String dockerfile, String target) {}
    record Application(String id, String manifest, String directory) {}
    private record Match(Application application, String copiedPath) {}

    private BuildConnections() {}

    static Build resolve(String serviceId, String composeFile, TechnologyDetector.Build build) {
        String context = resolveInside(directory(composeFile), build.context());
        if (context == null) return null;
        String dockerfile = resolveInside(context, build.dockerfile());
        if (dockerfile == null || dockerfile.isEmpty()) return null;
        return new Build(serviceId, composeFile, context, dockerfile, build.target());
    }

    static List<Application> applications(List<ProjectComponent> components) {
        return components.stream().filter(component -> component.kind().equals("application"))
            .map(component -> {
                String manifest = component.evidence().getFirst().file();
                return new Application(component.id(), manifest, directory(manifest));
            }).toList();
    }

    static ProjectConnection find(Build build, Map<String, DockerRecipe> recipes, List<Application> applications) {
        if (build.target() != null && !build.target().matches("[a-zA-Z0-9_.-]+")) return null;
        var inContext = applications.stream().filter(app -> inside(app.directory(), build.context())).toList();
        if (inContext.isEmpty()) return null;
        var recipe = recipes.get(build.dockerfile());
        var matches = new ArrayList<Match>();
        if (recipe != null) {
            var sources = recipe.sourcesFor(build.target());
            if (sources.isEmpty()) return null;
            var copied = new HashSet<String>();
            for (String source : sources.get()) {
                String path = resolveInside(build.context(), source);
                if (path != null && !path.equals(build.context()) && inside(path, build.context())) copied.add(path);
            }
            for (var app : inContext) {
                String path = copiedPath(app, copied, build.context());
                if (path != null) matches.add(new Match(app, path));
            }
        }

        if (matches.isEmpty()) {
            String recipeDirectory = directory(build.dockerfile());
            for (var app : inContext) {
                if ((app.directory().equals(recipeDirectory) && !recipeDirectory.equals(build.context()))
                    || (inContext.size() == 1 && app.directory().equals(build.context()))) {
                    matches.add(new Match(app, null));
                }
            }
        }
        if (matches.size() != 1) return null;

        var match = matches.getFirst();
        var application = match.application();
        boolean declared = application.manifest().equals(match.copiedPath());
        String description = match.copiedPath() == null
            ? "Application shares the build context or Dockerfile directory"
            : "Local build input: " + match.copiedPath();
        return new ProjectConnection(build.serviceId() + "->" + application.id(), build.serviceId(), application.id(),
            "packages", declared ? "declared" : "inferred", List.of(
                new Evidence(build.composeFile(), "Build declared for this service"),
                new Evidence(build.dockerfile(), description),
                new Evidence(application.manifest(), "Application manifest")));
    }

    private static String copiedPath(Application app, Set<String> copied, String context) {
        if (copied.contains(app.manifest())) return app.manifest();
        for (String path = app.directory(); !path.equals(context); path = directory(path)) {
            if (copied.contains(path)) return path;
        }
        return null;
    }

    private static boolean inside(String path, String context) {
        return context.isEmpty() || path.equals(context) || path.startsWith(context + "/");
    }

    private static String directory(String path) {
        int slash = path.lastIndexOf('/');
        return slash < 0 ? "" : path.substring(0, slash);
    }

    private static String resolveInside(String base, String relative) {
        try {
            Path path = Path.of(base).resolve(relative).normalize();
            return path.isAbsolute() || path.startsWith("..") ? null : path.toString().replace('\\', '/');
        } catch (InvalidPathException ignored) {
            return null;
        }
    }
}
