import Image from "next/image";

const logos = new Map(Object.entries({
  "next.js": "nextdotjs",
  "spring boot": "springboot",
  postgres: "postgresql",
  postgresql: "postgresql",
  react: "react",
  "node.js": "nodedotjs",
  "java / maven": "apachemaven",
  java: "openjdk",
  maven: "apachemaven",
  typescript: "typescript",
  javascript: "javascript",
  "react flow": "xyflow",
  maptiler: "maptiler",
  "maplibre gl js": "maplibre",
  "tailwind css": "tailwindcss",
  vite: "vite",
  eslint: "eslint",
  "docker compose": "docker",
  redis: "redis",
  mongo: "mongodb",
  mongodb: "mongodb",
  mysql: "mysql",
  rabbitmq: "rabbitmq",
  kafka: "apachekafka",
  container: "docker",
}));

const logoColors = new Map(Object.entries({
  springboot: "#87c752",
  docker: "#62abef",
  postgresql: "#7faed8",
  react: "#61dafb",
  nodedotjs: "#8abe69",
  apachemaven: "#e6837c",
  openjdk: "#e9aa76",
  typescript: "#74ace8",
  javascript: "#e7d460",
  xyflow: "#e78cb0",
  maptiler: "#86b3f1",
  maplibre: "#68c8bd",
  tailwindcss: "#63cbe0",
  vite: "#ad96f1",
  eslint: "#aa98ec",
  redis: "#ee827a",
  mongodb: "#73cd8e",
  mysql: "#76b3d0",
  rabbitmq: "#f39a67",
}));

export default function TechnologyIcon({ technology, colored = false }: { technology: string; colored?: boolean }) {
  const logo = logos.get(technology.trim().toLowerCase());
  const color = logo && colored ? (logoColors.get(logo) ?? "#d5e0d8") : undefined;

  return <span className="technology-icon" aria-hidden="true">
    {color ? (
      <span className="technology-icon-color"
        style={{ backgroundColor: color, maskImage: `url(/technologies/${logo}.svg)` }} />
    ) : logo ? (
      <Image src={`/technologies/${logo}.svg`} alt="" width={18} height={18} unoptimized />
    ) : (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5m8 4.5v9" />
      </svg>
    )}
  </span>;
}
