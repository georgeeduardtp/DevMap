package com.devmap.detector;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/** Local sources in the stages required by a Dockerfile build target. */
public final class DockerRecipe {
    private static final int MAX_BUILD_INPUTS = 2048;
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Pattern OPTION = Pattern.compile("^--([^=\\s]+)(?:=([^\\s]+))?\\s+");
    private static final Pattern STAGE_NAME = Pattern.compile("[a-zA-Z0-9_.-]+");

    record Instruction(String keyword, String value) {}
    private record Stage(Set<String> sources, Set<String> dependencies) {
        Stage() { this(new LinkedHashSet<>(), new LinkedHashSet<>()); }
    }

    private final List<Stage> stages = new ArrayList<>();
    private final Map<String, Integer> aliases = new HashMap<>();

    DockerRecipe(List<Instruction> instructions) {
        for (var instruction : instructions) {
            if (instruction.keyword().equals("FROM")) {
                var words = Arrays.stream(instruction.value().split("\\s+"))
                    .dropWhile(word -> word.startsWith("--")).toList();
                if (words.isEmpty()) continue;
                if (words.size() == 3 && words.get(1).equalsIgnoreCase("as")) {
                    aliases.put(words.get(2).toLowerCase(Locale.ROOT), stages.size());
                }
                var stage = new Stage();
                if (STAGE_NAME.matcher(words.getFirst()).matches()) stage.dependencies().add(words.getFirst());
                stages.add(stage);
            } else if (!stages.isEmpty() && (instruction.keyword().equals("COPY") || instruction.keyword().equals("ADD"))) {
                readCopy(stages.getLast(), instruction.value());
            }
        }
    }

    public Optional<Set<String>> sourcesFor(String target) {
        Integer selected = target == null ? Integer.valueOf(stages.size() - 1) : aliases.get(target.toLowerCase(Locale.ROOT));
        if (selected == null || selected < 0) return Optional.empty();

        var pending = new ArrayDeque<Integer>();
        var visited = new HashSet<Integer>();
        var sources = new LinkedHashSet<String>();
        pending.add(selected);
        while (!pending.isEmpty()) {
            int index = pending.remove();
            if (!visited.add(index)) continue;
            var stage = stages.get(index);
            sources.addAll(stage.sources());
            if (sources.size() > MAX_BUILD_INPUTS || visited.size() > MAX_BUILD_INPUTS) return Optional.empty();
            for (String dependency : stage.dependencies()) {
                Integer resolved = aliases.get(dependency.toLowerCase(Locale.ROOT));
                if (resolved == null && dependency.matches("[0-9]{1,6}")) resolved = Integer.valueOf(dependency);
                if (resolved != null && resolved < stages.size()) pending.add(resolved);
            }
        }
        return Optional.of(sources);
    }

    private static void readCopy(Stage stage, String value) {
        var option = OPTION.matcher(value);
        while (option.lookingAt()) {
            if (option.group(1).equals("from")) {
                String from = option.group(2);
                if (from != null && STAGE_NAME.matcher(from).matches()) stage.dependencies().add(from);
                return;
            }
            if (option.group(1).equals("exclude")) return;
            value = value.substring(option.end());
            option.reset(value);
        }
        List<String> arguments = copyArguments(value);
        for (int i = 0; i < arguments.size() - 1; i++) {
            String source = arguments.get(i);
            if (!source.isBlank() && source.length() <= 1024 && !source.startsWith("/")
                && source.chars().noneMatch(c -> Character.isISOControl(c) || ":$*?[]\\\"'".indexOf(c) >= 0)) {
                stage.sources().add(source);
            }
        }
    }

    private static List<String> copyArguments(String value) {
        if (!value.startsWith("[")) return Arrays.asList(value.split("\\s+"));
        try {
            var array = JSON.readTree(value);
            if (array == null || !array.isArray()) return List.of();
            var arguments = new ArrayList<String>();
            for (var argument : array) {
                if (!argument.isTextual()) return List.of();
                arguments.add(argument.textValue());
            }
            return arguments;
        } catch (JsonProcessingException ignored) {
            return List.of();
        }
    }
}
