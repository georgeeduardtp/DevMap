package com.devmap.detector;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Pattern;

@Component
public class ApplicationPortDetector implements TechnologyDetector {
    private static final int UNRESOLVED_PORT = 0;
    private static final Pattern SPRING_CONFIG = Pattern.compile("application(?:-[a-zA-Z0-9_-]+)?\\.(?:properties|yaml|yml)");
    private static final Pattern SPRING_FALLBACK = Pattern.compile("\\$\\{[A-Za-z0-9_.-]+:([0-9]{1,5})}");
    private static final Pattern NEXT_COMMAND = Pattern.compile(
        "^(?:(?:cross-env\\s+)?PORT=(\\S+)\\s+)?(?:next|(?:npx|pnpm exec|yarn|bunx)\\s+next|node\\s+[^\\s;&|]*[/\\\\]next\\.mjs)\\s+(?:dev|start)(?=\\s|$)(.*)$");
    private static final Pattern NEXT_PORT = Pattern.compile("(?:^|\\s)(?:--port|-p)(?==|\\s|$)(?:[=\\s]+(\\S+))?");

    @Override public boolean supports(String filename) {
        return SPRING_CONFIG.matcher(filename).matches();
    }

    @Override public Detection detect(String filename, String content) throws Exception {
        var ports = new ArrayList<Integer>();
        boolean basePort = false;
        if (filename.endsWith(".properties")) {
            for (String document : content.split("(?m)^[#!]---[ \\t]*$")) {
                var properties = new Properties();
                properties.load(new StringReader(document));
                String port = properties.getProperty("server.port");
                if (port == null) continue;
                ports.add(springPort(port, properties.getProperty("server.ssl.enabled")));
                basePort |= !properties.containsKey("spring.config.activate.on-profile") && !properties.containsKey("spring.profiles");
            }
        } else {
            LoaderOptions options = new LoaderOptions();
            options.setMaxAliasesForCollections(20);
            options.setNestingDepthLimit(30);
            options.setCodePointLimit(1_048_576);
            options.setAllowDuplicateKeys(false);
            for (Object document : new Yaml(new SafeConstructor(options)).loadAll(content)) {
                if (!(document instanceof Map<?, ?> yaml)) continue;
                Object port = property(yaml, "server.port");
                if (port == null) continue;
                ports.add(springPort(port, property(yaml, "server.ssl.enabled")));
                basePort |= property(yaml, "spring.config.activate.on-profile") == null
                    && property(yaml, "spring.profiles") == null;
            }
        }
        if (!ports.isEmpty() && !basePort && !filename.startsWith("application-")) ports.add(UNRESOLVED_PORT);
        return new Detection(List.of(), List.of(), List.of(), null, List.of(), null, List.copyOf(ports));
    }

    private static Object property(Map<?, ?> root, String key) {
        if (root.containsKey(key)) return root.get(key);
        Object value = root;
        for (String part : key.split("\\.")) {
            if (!(value instanceof Map<?, ?> map)) return null;
            value = map.get(part);
        }
        return value;
    }

    private static int springPort(Object value, Object ssl) {
        if (ssl != null && !"false".equalsIgnoreCase(ssl.toString().strip())) return UNRESOLVED_PORT;
        String text = value.toString().strip();
        var fallback = SPRING_FALLBACK.matcher(text);
        return parsePort(fallback.matches() ? fallback.group(1) : text);
    }

    static List<Integer> nextPorts(JsonNode scripts) {
        var ports = new ArrayList<Integer>();
        for (var script : scripts.properties()) {
            if (!script.getValue().isTextual()) continue;
            String command = script.getValue().textValue().strip();
            var startup = NEXT_COMMAND.matcher(command);
            if (!startup.matches()) continue;
            String arguments = startup.group(2).split("[;&|]", 2)[0];
            var flags = NEXT_PORT.matcher(arguments);
            if (arguments.contains("--experimental-https")) ports.add(UNRESOLVED_PORT);
            else if (!flags.find()) ports.add(parsePort(startup.group(1)));
            else {
                int port = parsePort(flags.group(1));
                ports.add(flags.find() ? UNRESOLVED_PORT : port);
            }
        }
        return List.copyOf(ports);
    }

    private static int parsePort(String value) {
        if (value == null) return UNRESOLVED_PORT;
        if (value.length() >= 2 && (value.startsWith("\"") && value.endsWith("\"")
            || value.startsWith("'") && value.endsWith("'"))) value = value.substring(1, value.length() - 1);
        if (!value.matches("[0-9]{1,5}")) return UNRESOLVED_PORT;
        int port = Integer.parseInt(value);
        return port <= 65535 ? port : UNRESOLVED_PORT;
    }
}
