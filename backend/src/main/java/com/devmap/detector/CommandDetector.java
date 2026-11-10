package com.devmap.detector;

import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Stream;

@Component
public class CommandDetector implements TechnologyDetector {
    private static final Set<String> README_NAMES = Set.of("readme", "readme.md", "readme.markdown");
    private static final Set<String> MAKE_NAMES = Set.of("makefile", "gnumakefile");
    private static final Set<String> SHELL_LANGUAGES = Set.of(
        "sh", "bash", "shell", "zsh", "fish", "powershell", "pwsh", "ps1", "cmd", "bat", "batch");
    private static final Pattern FENCE = Pattern.compile("^ {0,3}(`{3,}|~{3,})(.*)$");
    private static final Pattern PHONY = Pattern.compile("^ *\\.PHONY[ \\t]*:[ \\t]*([^#]*)");
    private static final Pattern MAKE_TARGET = Pattern.compile("[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}");
    private static final Pattern INSTRUCTION = Pattern.compile("^([a-zA-Z]+)[ \\t]+(.+)$");
    private static final Pattern HEREDOC = Pattern.compile("(?<!<)<<-?[ \\t]*['\"]?([a-zA-Z_][\\w.-]*)");

    @Override public boolean supports(String filename) {
        String name = filename.toLowerCase(Locale.ROOT);
        return README_NAMES.contains(name) || MAKE_NAMES.contains(name)
            || !name.startsWith(".") && !name.endsWith(".dockerignore") && (name.equals("dockerfile") || name.equals("containerfile")
                || name.startsWith("dockerfile.") && name.length() > "dockerfile.".length()
                || name.startsWith("containerfile.") && name.length() > "containerfile.".length()
                || name.endsWith(".dockerfile") || name.endsWith(".containerfile"));
    }

    @Override public Detection detect(String filename, String content) {
        String name = filename.toLowerCase(Locale.ROOT);
        if (README_NAMES.contains(name)) return new Detection(List.of(), List.of(), List.of(), null, readmeCommands(content));
        if (MAKE_NAMES.contains(name)) return new Detection(List.of(), List.of(), List.of(), null, makeCommands(content, filename));

        var instructions = containerInstructions(content);
        var commands = new ArrayList<Command>();
        for (var instruction : instructions) {
            switch (instruction.keyword()) {
                case "FROM" -> commands.clear();
                case "CMD", "ENTRYPOINT" -> {
                    commands.removeIf(command -> command.label().equals(instruction.keyword()));
                    commands.add(new Command("container", instruction.keyword(), instruction.value()));
                }
                default -> { }
            }
        }
        return new Detection(List.of(), List.of(), List.of(), null, List.copyOf(commands), new DockerRecipe(instructions));
    }

    private static List<Command> readmeCommands(String content) {
        var commands = new LinkedHashSet<Command>();
        String fence = "";
        String language = "";
        var block = new StringBuilder();
        var lines = content.lines().iterator();
        while (lines.hasNext() && commands.size() <= 200) {
            String line = lines.next();
            var marker = FENCE.matcher(line);
            if (marker.matches()) {
                String run = marker.group(1);
                String info = marker.group(2).strip();
                if (fence.isEmpty()) {
                    fence = run;
                    language = info.split("\\s+", 2)[0].toLowerCase(Locale.ROOT);
                    continue;
                }
                if (run.charAt(0) == fence.charAt(0) && run.length() >= fence.length() && info.isEmpty()) {
                    String text = block.toString().strip();
                    if (!text.isEmpty()) commands.add(new Command("documented", language, text));
                    block.setLength(0);
                    fence = "";
                    continue;
                }
            }
            if (!fence.isEmpty() && SHELL_LANGUAGES.contains(language) && block.length() <= 4096) {
                block.append(line).append('\n');
            }
        }
        return List.copyOf(commands);
    }

    private static List<Command> makeCommands(String content, String filename) {
        String invocation = Set.of("Makefile", "makefile", "GNUmakefile").contains(filename)
            ? "make " : "make -f " + filename + " ";
        return content.replaceAll("\\\\\\R", " ").lines().flatMap(line -> {
            var rule = PHONY.matcher(line);
            return rule.find() ? Arrays.stream(rule.group(1).strip().split("\\s+")) : Stream.empty();
        }).filter(target -> MAKE_TARGET.matcher(target).matches()).distinct().limit(201)
            .map(target -> new Command("script", target, invocation + target)).toList();
    }

    private static List<DockerRecipe.Instruction> containerInstructions(String content) {
        var instructions = new ArrayList<DockerRecipe.Instruction>();
        var continuation = new StringBuilder();
        var heredocs = new ArrayDeque<String>();
        char escape = '\\';
        var lines = content.lines().iterator();
        while (lines.hasNext()) {
            String line = lines.next().strip();
            if (!heredocs.isEmpty()) {
                if (line.equals(heredocs.peek())) heredocs.remove();
                continue;
            }
            if (line.startsWith("#")) {
                if (line.matches("(?i)#\\s*escape\\s*=\\s*`")) escape = '`';
                continue;
            }
            if (line.isEmpty()) continue;
            if (line.charAt(line.length() - 1) == escape) {
                continuation.append(line, 0, line.length() - 1);
                continue;
            }
            String logicalLine = continuation.append(line).toString();
            continuation.setLength(0);
            var instruction = INSTRUCTION.matcher(logicalLine);
            if (!instruction.matches()) continue;
            String keyword = instruction.group(1).toUpperCase(Locale.ROOT);
            String value = instruction.group(2).strip();
            if (keyword.equals("RUN") || keyword.equals("COPY") || keyword.equals("ADD")) {
                var heredoc = HEREDOC.matcher(value);
                while (heredoc.find()) heredocs.add(heredoc.group(1));
            }
            if (heredocs.isEmpty()) instructions.add(new DockerRecipe.Instruction(keyword, value));
        }
        return instructions;
    }
}
