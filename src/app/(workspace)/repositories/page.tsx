import { redirect } from "next/navigation";
import { repo } from "@/mock/workspace";

export default function RepositoriesIndex() {
  redirect(`/repositories/${repo.slug}`);
}
