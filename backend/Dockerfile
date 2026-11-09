FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /build
COPY backend/pom.xml ./pom.xml
RUN mvn -B -ntp dependency:go-offline
COPY backend/src ./src
RUN mvn -B -ntp verify

FROM eclipse-temurin:21-jre-jammy AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /build/target/devmap-backend-0.1.0.jar ./devmap.jar
USER 10001:10001
ENV DEVMAP_SCAN_ROOT=/workspace
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/devmap.jar"]
