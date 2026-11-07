import { PhotoStep } from "@/components/PhotoStep";
import { APP_NAME } from "@/config/app";

export default function Home() {
  return (
    <main>
      <h1>{APP_NAME}</h1>
      <p className="muted">
        Add your trip photos. They stay on this device: Inkreel reads when each was taken and groups them into moments.
      </p>
      <PhotoStep />
    </main>
  );
}
