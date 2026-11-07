import { PhotoStep } from "@/components/PhotoStep";
import { APP_NAME } from "@/config/app";

export default function Home() {
  return (
    <main>
      <p className="wordmark">{APP_NAME}</p>
      <h1>Bring in the whole trip</h1>
      <p className="lede">
        Choose every photo from the trip, even hundreds. Inkreel sorts them into moments, so your words can find the
        right ones.
      </p>
      <p className="muted">
        A moment is a run of photos taken close together: a morning at the market, an evening by the river. Your
        words are matched to moments, and you pick the photo.
      </p>
      <p className="muted small">Your photos stay on your phone.</p>
      <PhotoStep />
    </main>
  );
}
