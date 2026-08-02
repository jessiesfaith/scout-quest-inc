import type { Metadata } from "next";
import { Landing } from "./landing";

export const metadata: Metadata = {
  title: "Scout Quest Inc — AI Platform Studio",
  description:
    "Scout Quest Inc is an AI-native studio building education, tutoring, and clinical-speech products where safety comes first.",
};

export default function LandingPage() {
  return <Landing />;
}
