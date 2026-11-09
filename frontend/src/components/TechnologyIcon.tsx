import Image from "next/image";

const logos = new Map(Object.entries({
  "next.js": "nextdotjs",
  "spring boot": "springboot",
  postgres: "postgresql",
  postgresql: "postgresql",
  react: "react",
  "node.js": "nodedotjs",
  "java / maven": "apachemaven",
  redis: "redis",
  mongo: "mongodb",
  mongodb: "mongodb",
  mysql: "mysql",
  rabbitmq: "rabbitmq",
  kafka: "apachekafka",
  container: "docker",
}));

export default function TechnologyIcon({ technology }: { technology: string }) {
  const logo = logos.get(technology.trim().toLowerCase());

  return <span className="technology-icon" aria-hidden="true">
    {logo ? (
      <Image src={`/technologies/${logo}.svg`} alt="" width={18} height={18} unoptimized />
    ) : (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5m8 4.5v9" />
      </svg>
    )}
  </span>;
}
