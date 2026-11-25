import { createFileRoute } from "@tanstack/react-router";
import { CruzingBird } from "@/components/voxfly/Voxfly";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <CruzingBird />;
}
