import { redirect } from "next/navigation";

export default async function PatternsPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  redirect(topic ? `/progress?view=patterns&topic=${encodeURIComponent(topic)}` : "/progress?view=patterns");
}
